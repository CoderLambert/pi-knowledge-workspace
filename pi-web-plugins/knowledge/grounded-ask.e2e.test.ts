// @vitest-environment happy-dom

import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Fastify, { type FastifyInstance } from "fastify";
import { html, render, svg } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JsonValue, Workspace, WorkspacePanelContext } from "@jmfederico/pi-web/plugin-api";

import { buildKnowledgeApp } from "../../src/knowledge/service/app.js";
import {
  createKnowledgeImportPort,
  createKnowledgeServiceComposition,
  createReliableKnowledgePublishPort,
} from "../../src/knowledge/service/composition.js";
import {
  GroundedAskService,
  createGroundedAskProvider,
} from "../../src/knowledge/service/groundedAsk.js";
import {
  createKnowledgeViewerDispatch,
  createKnowledgeWorkspaceScopeResolver,
} from "../../src/knowledge/service/viewerDispatch.js";
import { ContentAddressedBlobStore } from "../../src/knowledge/storage/blobStore.js";
import {
  KNOWLEDGE_SCHEMA_VERSION,
  type KnowledgeDatabase,
  type SqliteStatement,
} from "../../src/knowledge/storage/database.js";
import { Fts5BaselineIndex } from "../../src/knowledge/storage/fts5Index.js";
import { GroundedAskStore } from "../../src/knowledge/storage/groundedAsk.js";
import { IndexBuildPublisher } from "../../src/knowledge/storage/indexBuildPublication.js";
import { IndexBuildRetention } from "../../src/knowledge/storage/indexBuildRetention.js";
import { MdTextImportJobs } from "../../src/knowledge/storage/importJobs.js";
import { applyMigrations } from "../../src/knowledge/storage/migrations.js";
import {
  ParsedArtifactCanonicalizer,
  SqliteParsedArtifactStore,
} from "../../src/knowledge/storage/parsedArtifact.js";
import { ReliableKnowledgePublisher } from "../../src/knowledge/storage/reliableKnowledge.js";
import { SourceDomain } from "../../src/knowledge/storage/sourceDomain.js";
import { PluginBackendRegistry } from "../../src/server/plugins/pluginBackendRegistry.js";
import type { ServerPluginPairedBackendContribution } from "../../src/server/plugins/serverPluginRuntime.js";
import { registerPairedPluginBackendRoutes } from "../../src/server/sessiond/pluginBackendRoutes.js";
import type { Project } from "../../src/server/types.js";
import { WorkspaceProviderRegistry } from "../../src/server/workspaces/workspaceProviderRegistry.js";
import browserPlugin from "./browser/pi-web-plugin.js";
import { createKnowledgeBackend } from "./server-plugin.js";
import { createKnowledgeServiceClient } from "./service-client.js";

const SERVICE_TOKEN = "grounded-ask-e2e-service-token";
const MODULE_REVISION = "knowledge-grounded-ask-e2e-r1";
const cleanup: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const close of cleanup.splice(0)) await close();
  document.body.replaceChildren();
});

describe("Grounded Ask Product Preview E2E", () => {
  it("runs Import → Publish → Ask → Answer → Citation → exact historical Evidence", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "grounded-ask-product-preview-"));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    await writeFile(path.join(root, "handbook.md"), "# Deployment\n\nAlpha deployment uses the blue release train.\n");

    const runtime = await startKnowledgeRuntime();
    const fixture = await createHostFixture(root, runtime.app);
    const container = document.createElement("div");
    render(requiredPanel().render(fixture.panelContext), container);
    const preview = container.querySelector("pi-web-knowledge-product-preview");
    if (!(preview instanceof HTMLElement) || preview.shadowRoot === null) {
      throw new Error("Grounded Ask Product Preview is missing");
    }

    click(preview, "[data-file-picker-trigger]");
    await settleUi();
    click(preview, "[data-file-picker-file='handbook.md']");
    click(preview, "[data-import]");
    await fixture.bridge.waitForLastRequest();
    await settleUi();
    expect(preview.shadowRoot.textContent).toContain("Source imported and ready to publish");

    click(preview, "[data-publish]");
    await fixture.bridge.waitForLastRequest();
    await settleUi();
    expect(preview.shadowRoot.textContent).toContain("Published snapshot");

    setValue(preview, "[data-question]", "How does alpha deploy?");
    click(preview, "[data-ask]");
    await fixture.bridge.waitForLastRequest();
    await settleUi();
    expect(preview.shadowRoot.textContent).toContain("Alpha deploys using the blue release train");
    expect(preview.shadowRoot.textContent).toContain("fixture/grounded-e2e");
    expect(preview.shadowRoot.querySelector("[data-citation-id]")).not.toBeNull();

    const first = activeSelection(runtime.db);
    await writeFile(path.join(root, "handbook.md"), "# Deployment\n\nAlpha deployment now uses the red release train.\n");
    const imported = requireRecord(await fixture.bridge.request("knowledge.import.submit", {
      relativePath: "handbook.md",
      idempotencyKey: "handbook:red",
      sourceId: first.sourceId,
    }), "updated import response");
    const updatedVersionId = importVersionId(imported);
    await fixture.bridge.request("knowledge.publish", {
      sourceIds: [first.sourceId],
      sourceVersionIds: [updatedVersionId],
    });
    expect(activeSelection(runtime.db).sourceVersionId).toBe(updatedVersionId);
    expect(new IndexBuildRetention(runtime.db).gcRetained(first.knowledgeWorkspaceId)).toEqual([first.indexBuildId]);

    click(preview, "[data-citation-id]");
    await fixture.bridge.waitForLastRequest();
    await settleUi();
    expect(preview.shadowRoot.textContent).toContain("Historical Evidence");
    expect(preview.shadowRoot.textContent).toContain(first.sourceVersionId);
    expect(preview.shadowRoot.textContent).toContain("blue release train");
    expect(preview.shadowRoot.textContent).not.toContain("red release train");
    expect(runtime.providerCalls).toBe(1);
  });
});

async function startKnowledgeRuntime(): Promise<{
  app: FastifyInstance;
  db: KnowledgeDatabase;
  providerCalls: number;
}> {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "grounded-ask-storage-"));
  const db = new NodeDatabase(path.join(storageRoot, "knowledge.sqlite"));
  applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
  db.exec("PRAGMA foreign_keys=ON");
  const blobs = new ContentAddressedBlobStore(path.join(storageRoot, "blobs"));
  const sources = new SourceDomain(db, blobs);
  const artifacts = new SqliteParsedArtifactStore(db);
  const reliable = new ReliableKnowledgePublisher(
    new ParsedArtifactCanonicalizer(blobs),
    artifacts,
    new Fts5BaselineIndex(db),
    new IndexBuildPublisher(db),
  );
  let providerCalls = 0;
  const provider = createGroundedAskProvider((input) => {
    providerCalls += 1;
    const evidence = input.deliveredEvidence.evidence[0];
    if (evidence === undefined) throw new Error("No grounded Evidence was delivered");
    return Promise.resolve({
      text: "Alpha deploys using the blue release train [1].",
      citations: [{ label: "[1]", evidenceId: evidence.id }],
    });
  });
  const groundedAsk = new GroundedAskService(new GroundedAskStore(db), provider);
  const scopeResolver = createKnowledgeWorkspaceScopeResolver(db);
  const composition = createKnowledgeServiceComposition({
    groundedAsk,
    importJobs: createKnowledgeImportPort(new MdTextImportJobs(db, sources)),
    publish: createReliableKnowledgePublishPort(db, sources, reliable),
    scopeResolver,
    modelIdentity: { provider: "fixture", model: "grounded-e2e", modelRevision: "v1" },
  });
  const app = await buildKnowledgeApp({
    token: SERVICE_TOKEN,
    viewer: createKnowledgeViewerDispatch(db, artifacts),
    ...composition,
  });
  cleanup.push(async () => {
    await app.close();
    db.close();
    await rm(storageRoot, { recursive: true, force: true });
  });
  return {
    app,
    db,
    get providerCalls() {
      return providerCalls;
    },
  };
}

async function createHostFixture(workspaceRoot: string, service: FastifyInstance): Promise<{
  panelContext: WorkspacePanelContext;
  bridge: ReturnType<typeof createSessiondBridge>;
}> {
  const backend = createKnowledgeBackend(createKnowledgeServiceClient({
    host: "127.0.0.1",
    port: 8515,
    token: SERVICE_TOKEN,
    fetchImpl: createFastifyFetch(service),
  }));
  const project: Project = {
    id: "project-grounded-ask",
    name: "Grounded Ask",
    path: workspaceRoot,
    createdAt: "2026-09-10T00:00:00.000Z",
  };
  const workspaces = new WorkspaceProviderRegistry({
    contributions: [],
    logger: { warn: () => undefined },
    pathInspector: () => true,
  });
  const resolved = await workspaces.resolve(project);
  const resolvedWorkspace = resolved.workspaces[0];
  if (resolvedWorkspace === undefined) throw new Error("Expected host folder Workspace");
  const contribution: ServerPluginPairedBackendContribution = {
    pluginId: "knowledge",
    pluginName: "Knowledge",
    packageRoot: "/plugins/knowledge",
    source: "fixture",
    scope: "local",
    moduleRevision: MODULE_REVISION,
    backend,
  };
  const registry = new PluginBackendRegistry({ contributions: [contribution], workspaces });
  const sessiond = Fastify({ logger: false });
  registerPairedPluginBackendRoutes(sessiond, {
    projects: { requireProject: (projectId: string) => projectId === project.id
      ? Promise.resolve(project)
      : Promise.reject(new Error("Project not found")) },
    backends: registry,
    onWorkspacesMutated: () => undefined,
  });
  await sessiond.ready();
  cleanup.push(() => sessiond.close());
  const bridge = createSessiondBridge(sessiond, project, resolvedWorkspace.id);
  const workspace: Workspace = {
    id: resolvedWorkspace.id,
    projectId: resolvedWorkspace.projectId,
    path: resolvedWorkspace.path,
    label: resolvedWorkspace.label,
    isMain: resolvedWorkspace.isMain,
  };
  return { panelContext: panelContext(workspace, bridge.request), bridge };
}

function createFastifyFetch(app: FastifyInstance): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const headers = new Headers(init?.headers);
    const method = init?.method?.toUpperCase() === "POST" ? "POST" : "GET";
    const injected = await app.inject({
      method,
      url: `${url.pathname}${url.search}`,
      headers: Object.fromEntries(headers.entries()),
      ...(typeof init?.body === "string" ? { payload: init.body } : {}),
    });
    const responseHeaders = new Headers();
    for (const [name, value] of Object.entries(injected.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) responseHeaders.append(name, item);
      } else {
        responseHeaders.set(name, String(value));
      }
    }
    return new Response(injected.body, { status: injected.statusCode, headers: responseHeaders });
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
  return { request, waitForLastRequest: () => lastSettled };
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
    payload: { revision: MODULE_REVISION, input },
  });
  const parsed: unknown = JSON.parse(response.body);
  if (!isJsonValue(parsed)) throw new Error("sessiond returned non-JSON plugin data");
  if (response.statusCode < 200 || response.statusCode >= 300) {
    if (isRecord(parsed) && typeof parsed["error"] === "string") throw new Error(parsed["error"]);
    throw new Error(`sessiond request failed with HTTP ${String(response.statusCode)}`);
  }
  return parsed;
}

function requiredPanel() {
  const panel = browserPlugin.activate({ apiVersion: 2, pluginId: "knowledge", runtimePluginId: "knowledge", html, svg })
    .contributions.workspacePanels?.[0];
  if (panel === undefined) throw new Error("Expected Knowledge Workspace panel");
  return panel;
}

function panelContext(
  workspace: Workspace,
  request: (operation: string, input: JsonValue) => Promise<JsonValue>,
): WorkspacePanelContext {
  return {
    machine: { id: "local", name: "Local", kind: "local" },
    workspace,
    state: { selectedWorkspace: workspace, workspaceTool: "knowledge:workspace.knowledge", mainView: "knowledge:workspace.knowledge" },
    files: {
      readFile: () => Promise.reject(new Error("not implemented")),
      listFiles: (path) => Promise.resolve({
        path,
        entries: path === "" ? [{ name: "handbook.md", path: "handbook.md", type: "file" }] : [],
        scannedAt: "2026-09-10T00:00:00.000Z",
        truncated: false,
      }),
      writeFile: () => Promise.reject(new Error("not implemented")),
      deleteFile: () => Promise.reject(new Error("not implemented")),
      moveFile: () => Promise.reject(new Error("not implemented")),
    },
    pairedBackend: { version: 1, requestVersion: 1, request },
    host: { requestRender: () => undefined },
    prompt: { insertText: () => undefined, getText: () => "", getSelection: () => null },
    terminal: { open: () => undefined, runCommand: () => Promise.reject(new Error("not implemented")) },
  };
}

function setValue(root: HTMLElement, selector: string, value: string): void {
  const input = root.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (input === null || input === undefined) throw new Error(`Input ${selector} is missing`);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function click(root: HTMLElement, selector: string): void {
  const button = root.shadowRoot?.querySelector<HTMLButtonElement>(selector);
  if (button === null || button === undefined) throw new Error(`Button ${selector} is missing`);
  button.click();
}

async function settleUi(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function activeSelection(db: KnowledgeDatabase): {
  knowledgeWorkspaceId: string;
  sourceId: string;
  sourceVersionId: string;
  indexBuildId: string;
} {
  const row = db.prepare(`SELECT publication.knowledge_workspace_id, publication.index_build_id,
      selection.source_id, selection.source_version_id
    FROM knowledge_workspaces workspace
    JOIN knowledge_publications publication ON publication.id=workspace.active_knowledge_publication_id
    JOIN knowledge_publication_selections selection ON selection.publication_id=publication.id`).get();
  const record = requireRecord(row, "active Knowledge selection");
  return {
    knowledgeWorkspaceId: requireString(record, "knowledge_workspace_id"),
    sourceId: requireString(record, "source_id"),
    sourceVersionId: requireString(record, "source_version_id"),
    indexBuildId: requireString(record, "index_build_id"),
  };
}

function importVersionId(response: Record<string, unknown>): string {
  const job = requireRecord(response["job"], "import job");
  const result = requireRecord(job["result"], "import result");
  return requireString(result, "sourceVersionId");
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) throw new Error(`${key} must be a string`);
  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

class NodeDatabase implements KnowledgeDatabase {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  close(): void {
    this.database.close();
  }

  pragma(sql: string, options?: { simple?: boolean }): unknown {
    const row = this.database.prepare(`PRAGMA ${sql}`).get();
    return options?.simple === true && row !== undefined ? Object.values(row)[0] : row;
  }

  prepare(sql: string): SqliteStatement {
    const statement = this.database.prepare(sql);
    return {
      run: (...params) => statement.run(...sqlValues(params)),
      get: (...params) => statement.get(...sqlValues(params)),
      all: (...params) => statement.all(...sqlValues(params)),
    };
  }
}

function sqlValues(values: unknown[]): SQLInputValue[] {
  return values.map((value) => {
    if (
      value === null
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "bigint"
      || value instanceof Uint8Array
    ) return value;
    throw new TypeError("Invalid SQLite fixture parameter");
  });
}
