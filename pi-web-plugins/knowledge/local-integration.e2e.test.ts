// @vitest-environment happy-dom

import { Buffer } from "node:buffer";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { html, render, svg } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  JsonValue,
  Workspace,
  WorkspacePanelContext,
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
import browserPlugin from "./browser/pi-web-plugin.js";
import serverPlugin from "./server-plugin.js";

const SERVICE_TOKEN = "p0-t05-local-integration-service-token";
const KNOWLEDGE_REVISION = "knowledge-p0-t05-r1";
const closeables: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(closeables.splice(0).map((close) => close()));
  document.body.replaceChildren();
});

describe("P0-T05 local Knowledge integration", () => {
  it("runs Browser panel → sessiond route → host workspace authority → adapter → real pi-knowledge → UI", async () => {
    const service = await startKnowledgeService(SERVICE_TOKEN);
    const fixture = await createIntegrationFixture(service.port, SERVICE_TOKEN);
    const panel = requiredPanel();
    const container = document.createElement("div");

    render(panel.render(fixture.panelContext), container);
    clickIntegrationCheck(container);
    await fixture.bridge.waitForLastRequest();
    render(panel.render(fixture.panelContext), container);

    expect(fixture.bridge.request).toHaveBeenCalledOnce();
    expect(fixture.bridge.request).toHaveBeenCalledWith("knowledge.status", null);
    expect(container.textContent).toContain("ready");
    expect(container.textContent).toContain(fixture.project.id);
    expect(container.textContent).toContain(fixture.workspace.id);
    expect(container.textContent).toContain(fixture.workspace.path);
    expect(container.textContent).toContain(fixture.workspace.label);
  });

  it("shows an explicit backend error when pi-knowledge is unavailable and recovers after service restart", async () => {
    const service = await startKnowledgeService(SERVICE_TOKEN);
    const fixture = await createIntegrationFixture(service.port, SERVICE_TOKEN);
    const panel = requiredPanel();
    const container = document.createElement("div");

    await service.close();

    render(panel.render(fixture.panelContext), container);
    clickIntegrationCheck(container);
    await fixture.bridge.waitForLastRequest();
    render(panel.render(fixture.panelContext), container);
    expect(container.textContent).toContain("Knowledge backend error");
    expect(container.textContent).toContain("pi-knowledge service is unavailable");
    expect(container.textContent).not.toContain(SERVICE_TOKEN);

    const restarted = await startKnowledgeService(SERVICE_TOKEN, service.port);
    expect(restarted.port).toBe(service.port);

    clickIntegrationCheck(container);
    await fixture.bridge.waitForLastRequest();
    render(panel.render(fixture.panelContext), container);
    expect(container.textContent).toContain("ready");
    expect(container.textContent).not.toContain("Knowledge backend error");
  });

  it("fails closed when sessiond/server-plugin and pi-knowledge use different tokens", async () => {
    const service = await startKnowledgeService(SERVICE_TOKEN);
    const wrongToken = "p0-t05-server-plugin-wrong-token";
    const fixture = await createIntegrationFixture(service.port, wrongToken);
    const panel = requiredPanel();
    const container = document.createElement("div");

    render(panel.render(fixture.panelContext), container);
    clickIntegrationCheck(container);
    await fixture.bridge.waitForLastRequest();
    render(panel.render(fixture.panelContext), container);

    expect(container.textContent).toContain("Knowledge backend error");
    expect(container.textContent).toContain("AUTH_INVALID");
    expect(container.textContent).not.toContain(SERVICE_TOKEN);
    expect(container.textContent).not.toContain(wrongToken);
  });

  it("rejects a version-incompatible service response before the UI can render ready", async () => {
    const incompatible = await startIncompatibleProtocolService();
    const fixture = await createIntegrationFixture(incompatible.port, SERVICE_TOKEN);
    const panel = requiredPanel();
    const container = document.createElement("div");

    render(panel.render(fixture.panelContext), container);
    clickIntegrationCheck(container);
    await fixture.bridge.waitForLastRequest();
    render(panel.render(fixture.panelContext), container);

    expect(container.textContent).toContain("Knowledge backend error");
    expect(container.textContent).toContain("protocol mismatch");
    expect(container.textContent).not.toContain("Statusready");
  });
});

async function createIntegrationFixture(port: number, token: string): Promise<{
  project: Project;
  workspace: Workspace;
  panelContext: WorkspacePanelContext;
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
    panelContext: panelContext(workspace, bridge.request),
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

function requiredPanel() {
  const contributions = browserPlugin.activate({
    apiVersion: 2,
    pluginId: "knowledge",
    runtimePluginId: "knowledge",
    html,
    svg,
  }).contributions;
  const panel = contributions.workspacePanels?.[0];
  if (panel === undefined) throw new Error("Expected Knowledge workspace panel");
  return panel;
}

function panelContext(
  workspace: Workspace,
  request: (operation: string, input: JsonValue) => Promise<JsonValue>,
): WorkspacePanelContext {
  const noop = () => undefined;
  return {
    machine: { id: "local", name: "Local", kind: "local" },
    workspace,
    state: {
      selectedWorkspace: workspace,
      workspaceTool: "knowledge:workspace.knowledge",
      mainView: "knowledge:workspace.knowledge",
    },
    files: {
      readFile: () => Promise.reject(new Error("not implemented")),
      listFiles: () => Promise.reject(new Error("not implemented")),
      writeFile: () => Promise.reject(new Error("not implemented")),
      deleteFile: () => Promise.reject(new Error("not implemented")),
      moveFile: () => Promise.reject(new Error("not implemented")),
    },
    pairedBackend: {
      version: 1,
      requestVersion: 1,
      request,
    },
    host: { requestRender: noop },
    prompt: { insertText: noop, getText: () => "", getSelection: () => null },
    terminal: {
      open: noop,
      runCommand: () => Promise.reject(new Error("not implemented")),
    },
  };
}

function clickIntegrationCheck(container: ParentNode): void {
  const button = container.querySelector("button");
  if (button === null) throw new Error("Expected Knowledge integration check button");
  button.click();
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
        if (isRecord(parsed)) {
          const rawRequestId = parsed["requestId"];
          const rawOperation = parsed["operation"];
          if (typeof rawRequestId === "string") requestId = rawRequestId;
          if (typeof rawOperation === "string") operation = rawOperation;
        }
      }
      response.setHeader("content-type", "application/json");
      response.setHeader("x-request-id", requestId);
      response.statusCode = 200;
      response.end(JSON.stringify(operation === undefined
        ? { protocolVersion: 999, requestId, ok: true, service: "pi-knowledge", status: "healthy" }
        : { protocolVersion: 999, requestId, ok: true, operation, result: {} }));
    });
  });
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectReady);
      resolveReady();
    });
  });
  closeables.push(() => closeServer(server));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected TCP server address");
  return { port: address.port, close: () => closeServer(server) };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error === undefined) resolveClose();
      else rejectClose(error);
    });
  });
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
