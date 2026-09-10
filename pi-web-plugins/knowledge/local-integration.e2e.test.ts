import { Buffer } from "node:buffer";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  JsonValue,
  Workspace,
} from "@jmfederico/pi-web/plugin-api";
import type {
  ServerPluginActivationContext,
} from "@jmfederico/pi-web/server-plugin-api";
import { buildKnowledgeApp } from "../../src/knowledge/service/app.js";
import { PluginBackendRegistry } from "../../src/server/plugins/pluginBackendRegistry.js";
import type { ServerPluginPairedBackendContribution } from "../../src/server/plugins/serverPluginRuntime.js";
import { registerPairedPluginBackendRoutes } from "../../src/server/sessiond/pluginBackendRoutes.js";
import type { Project } from "../../src/server/types.js";
import { WorkspaceProviderRegistry } from "../../src/server/workspaces/workspaceProviderRegistry.js";
import serverPlugin from "./server-plugin.js";

const SERVICE_TOKEN = "p0-t05-local-integration-service-token";
const KNOWLEDGE_REVISION = "knowledge-p0-t05-r1";
const closeables: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(closeables.splice(0).map((close) => close()));
});

describe("P0-T05 local Knowledge integration", () => {
  it("runs paired backend → sessiond route → host workspace authority → adapter → real pi-knowledge", async () => {
    const service = await startKnowledgeService(SERVICE_TOKEN);
    const fixture = await createIntegrationFixture(service.port, SERVICE_TOKEN);
    const result = await fixture.bridge.request("knowledge.status", null);
    const record = requireRecord(result, "Knowledge status");
    const scope = requireRecord(record["scope"], "Knowledge status scope");

    expect(fixture.bridge.request).toHaveBeenCalledOnce();
    expect(fixture.bridge.request).toHaveBeenCalledWith("knowledge.status", null);
    expect(record["status"]).toBe("ready");
    expect(scope).toMatchObject({
      projectId: fixture.project.id,
      workspaceId: fixture.workspace.id,
      workspacePath: fixture.workspace.path,
      workspaceLabel: fixture.workspace.label,
    });
  });

  it("shows an explicit backend error when pi-knowledge is unavailable and recovers after service restart", async () => {
    const service = await startKnowledgeService(SERVICE_TOKEN);
    const fixture = await createIntegrationFixture(service.port, SERVICE_TOKEN);
    await service.close();
    await expect(fixture.bridge.request("knowledge.status", null)).rejects.toThrow("pi-knowledge service is unavailable");

    const restarted = await startKnowledgeService(SERVICE_TOKEN, service.port);
    expect(restarted.port).toBe(service.port);
    await expect(fixture.bridge.request("knowledge.status", null)).resolves.toMatchObject({ status: "ready" });
  });

  it("fails closed when sessiond/server-plugin and pi-knowledge use different tokens", async () => {
    const service = await startKnowledgeService(SERVICE_TOKEN);
    const wrongToken = "p0-t05-server-plugin-wrong-token";
    const fixture = await createIntegrationFixture(service.port, wrongToken);
    await expect(fixture.bridge.request("knowledge.status", null)).rejects.toThrow("AUTH_INVALID");
  });

  it("rejects a version-incompatible service response before the UI can render ready", async () => {
    const incompatible = await startIncompatibleProtocolService();
    const fixture = await createIntegrationFixture(incompatible.port, SERVICE_TOKEN);
    await expect(fixture.bridge.request("knowledge.status", null)).rejects.toThrow("protocol mismatch");
  });
});

async function createIntegrationFixture(port: number, token: string): Promise<{
  project: Project;
  workspace: Workspace;
  bridge: ReturnType<typeof createSessiondBridge>;
}> {
  vi.stubEnv("PI_KNOWLEDGE_HOST", "127.0.0.1");
  vi.stubEnv("PI_KNOWLEDGE_PORT", String(port));
  vi.stubEnv("PI_KNOWLEDGE_TOKEN", token);

  const activationContext: ServerPluginActivationContext = {
    apiVersion: 1,
    pluginId: "knowledge",
    packageRoot: "/plugins/knowledge",
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    settings: {},
    execFile: () => Promise.reject(new Error("Knowledge integration fixture does not execute commands")),
    signal: new AbortController().signal,
  };
  const activation = await serverPlugin.activate(activationContext);
  const backend = activation.pairedBackend;
  if (backend === undefined) throw new Error("Knowledge paired backend is missing");

  const project: Project = {
    id: "project-p0-t05",
    name: "P0 T05 Project",
    path: resolve("/repo/p0-t05"),
    createdAt: "2026-09-09T00:00:00.000Z",
  };
  const workspaces = new WorkspaceProviderRegistry({
    contributions: [],
    logger: { warn: () => undefined },
    pathInspector: () => true,
  });
  const resolved = await workspaces.resolve(project);
  const resolvedWorkspace = resolved.workspaces[0];
  if (resolvedWorkspace === undefined) throw new Error("Expected host folder workspace");

  const contribution: ServerPluginPairedBackendContribution = {
    pluginId: "knowledge",
    pluginName: "Knowledge",
    packageRoot: "/plugins/knowledge",
    source: "fixture",
    scope: "local",
    moduleRevision: KNOWLEDGE_REVISION,
    backend,
  };
  const registry = new PluginBackendRegistry({ contributions: [contribution], workspaces });
  const sessiond = Fastify({ logger: false });
  registerPairedPluginBackendRoutes(sessiond, {
    projects: projectReader(project),
    backends: registry,
    onWorkspacesMutated: () => undefined,
  });
  await sessiond.ready();
  closeables.push(() => sessiond.close());

  const bridge = createSessiondBridge(sessiond, project, resolvedWorkspace.id);
  const workspace: Workspace = {
    id: resolvedWorkspace.id,
    projectId: resolvedWorkspace.projectId,
    path: resolvedWorkspace.path,
    label: resolvedWorkspace.label,
    isMain: resolvedWorkspace.isMain,
  };

  return {
    project,
    workspace,
    bridge,
  };
}

function createSessiondBridge(
  sessiond: FastifyInstance,
  project: Project,
  workspaceId: string,
): {
  request: (operation: string, input: JsonValue) => Promise<JsonValue>;
  waitForLastRequest: () => Promise<void>;
} {
  let lastSettled = Promise.resolve();
  const request = vi.fn((operation: string, input: JsonValue): Promise<JsonValue> => {
    const pending = dispatchSessiondRequest(sessiond, project, workspaceId, operation, input);
    lastSettled = pending.then(() => undefined, () => undefined);
    return pending;
  });
  return {
    request,
    waitForLastRequest: () => lastSettled,
  };
}

async function dispatchSessiondRequest(
  sessiond: FastifyInstance,
  project: Project,
  workspaceId: string,
  operation: string,
  input: JsonValue,
): Promise<JsonValue> {
  const response = await sessiond.inject({
    method: "POST",
    url: `/paired-plugin-backends/knowledge/projects/${encodeURIComponent(project.id)}/workspaces/${encodeURIComponent(workspaceId)}/${encodeURIComponent(operation)}`,
    payload: { revision: KNOWLEDGE_REVISION, input },
  });
  const parsed: unknown = JSON.parse(response.body);
  if (!isJsonValue(parsed)) throw new Error("sessiond returned non-JSON plugin data");

  if (response.statusCode < 200 || response.statusCode >= 300) {
    if (isRecord(parsed) && typeof parsed["error"] === "string") throw new Error(parsed["error"]);
    throw new Error(`sessiond Knowledge request failed with HTTP ${String(response.statusCode)}`);
  }
  return parsed;
}

function projectReader(project: Project): {
  requireProject: (projectId: string) => Promise<Project>;
} {
  return {
    requireProject: (projectId: string) => projectId === project.id
      ? Promise.resolve(project)
      : Promise.reject(new Error("Project not found")),
  };
}

async function startKnowledgeService(
  token: string,
  port = 0,
): Promise<{ port: number; close: () => Promise<void> }> {
  const app = await buildKnowledgeApp({ token });
  const address = await app.listen({ host: "127.0.0.1", port });
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await app.close();
  };
  closeables.push(close);
  return { port: Number(new URL(address).port), close };
}

async function startIncompatibleProtocolService(): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => { chunks.push(chunk); });
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let requestId = "health-version-fixture";
      let operation: string | undefined;
      if (raw !== "") {
        const parsed: unknown = JSON.parse(raw);
        if (isRecord(parsed) && typeof parsed["requestId"] === "string") requestId = parsed["requestId"];
        if (isRecord(parsed) && typeof parsed["operation"] === "string") operation = parsed["operation"];
      }
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.setHeader("x-request-id", requestId);
      response.end(JSON.stringify({
        ok: true,
        protocolVersion: 2,
        requestId,
        ...(operation === undefined ? { service: "pi-knowledge", status: "healthy" } : { operation, result: {} }),
      }));
    });
  });
  const port = await listen(server);
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error) => {
        if (error === undefined) resolvePromise();
        else rejectPromise(error);
      });
    });
  };
  closeables.push(close);
  return { port, close };
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected TCP listener address");
  return address.port;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry));
  if (isRecord(value)) return Object.values(value).every((entry) => isJsonValue(entry));
  return false;
}
