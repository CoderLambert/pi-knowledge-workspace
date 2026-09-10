import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { PI_KNOWLEDGE_PROTOCOL_VERSION } from "../contracts/protocol.js";
import { buildKnowledgeApp } from "./app.js";
import type { KnowledgeViewerDispatch, ViewerHostScope } from "./viewerDispatch.js";

const TOKEN = "0123456789abcdef0123456789abcdef";
const apps: FastifyInstance[] = [];

const scope: ViewerHostScope = {
  projectId: "project-1",
  workspaceId: "workspace-1",
  workspacePath: "/work/project/feature",
  workspaceLabel: "feature",
};

function viewer(): KnowledgeViewerDispatch {
  return {
    listSources(actual) {
      expect(actual).toEqual(scope);
      return { version: 1, knowledgeWorkspaceId: "kw-1", sources: [] };
    },
    getSource(actual, sourceId) {
      expect(actual).toEqual(scope);
      return { version: 1, source: { id: sourceId, versions: [] } };
    },
    openArtifact(actual, input) {
      expect(actual).toEqual(scope);
      return { version: 1, document: { parsedArtifactId: input.parsedArtifactId, evidenceId: input.evidenceId ?? null } };
    },
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function app(): Promise<FastifyInstance> {
  const instance = await buildKnowledgeApp({ token: TOKEN, viewer: viewer() });
  apps.push(instance);
  return instance;
}

async function dispatch(instance: FastifyInstance, operation: string, input: unknown) {
  return await instance.inject({
    method: "POST",
    url: "/v1/dispatch",
    headers: { authorization: `Bearer ${TOKEN}` },
    payload: { protocolVersion: PI_KNOWLEDGE_PROTOCOL_VERSION, requestId: `req-${operation}`, operation, input },
  });
}

describe("pi-knowledge viewer dispatch", () => {
  it("advertises viewer operations only when a viewer runtime is injected", async () => {
    const instance = await app();
    const response = await dispatch(instance, "capabilities.get", null);
    const body = JSON.parse(response.body) as { result: { operations: string[] } };
    expect(body.result.operations).toEqual([
      "capabilities.get",
      "workspace.echo",
      "viewer.sources.list",
      "viewer.source.get",
      "viewer.artifact.open",
    ]);
  });

  it("dispatches Source list and Source detail through the injected viewer boundary", async () => {
    const instance = await app();
    const list = await dispatch(instance, "viewer.sources.list", { scope });
    const detail = await dispatch(instance, "viewer.source.get", { scope, sourceId: "source-1" });
    expect(list.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
  });

  it("dispatches historical artifact + Evidence identity without replacing either with latest", async () => {
    const instance = await app();
    const response = await dispatch(instance, "viewer.artifact.open", {
      scope,
      parsedArtifactId: "artifact-old",
      evidenceId: "evidence-old",
      maxBytes: 49152,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { result: { document: Record<string, unknown> } };
    expect(body.result.document).toEqual({ parsedArtifactId: "artifact-old", evidenceId: "evidence-old" });
  });

  it("rejects extra authority-bearing fields", async () => {
    const instance = await app();
    const response = await dispatch(instance, "viewer.source.get", {
      scope,
      sourceId: "source-1",
      workspacePath: "/tmp/spoofed",
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_REQUEST");
  });
});
