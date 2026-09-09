import { describe, expect, it } from "vitest";
import type { PairedPluginRequestContext } from "@jmfederico/pi-web/server-plugin-api";
import type { KnowledgeServiceClient, KnowledgeServiceOperation } from "./service-client.js";
import {
  createKnowledgeBackend,
  KNOWLEDGE_ARTIFACT_OPEN_OPERATION,
  KNOWLEDGE_SOURCE_GET_OPERATION,
  KNOWLEDGE_SOURCES_LIST_OPERATION,
} from "./server-plugin.js";

class RecordingClient implements KnowledgeServiceClient {
  calls: { operation: string; input: unknown }[] = [];
  result: Record<string, unknown> = { version: 1, sources: [] };

  dispatch(operation: KnowledgeServiceOperation, input: unknown): Promise<Record<string, unknown>> {
    this.calls.push({ operation, input });
    return Promise.resolve(this.result);
  }
  health(): Promise<Record<string, unknown>> { return Promise.resolve({ status: "healthy" }); }
}

function ctx(operation: string, input: PairedPluginRequestContext["input"]): PairedPluginRequestContext {
  return {
    project: { id: "project-1", name: "P", path: "/work/project" },
    workspace: {
      id: "workspace-1", projectId: "project-1", path: "/work/project/feature", label: "feature", isMain: false,
    },
    operation,
    input,
    signal: new AbortController().signal,
  };
}

async function request(client: KnowledgeServiceClient, context: PairedPluginRequestContext): Promise<unknown> {
  const backend = createKnowledgeBackend(client);
  if (backend.request === undefined) throw new Error("missing request capability");
  return await backend.request(context);
}

const expectedScope = {
  projectId: "project-1",
  workspaceId: "workspace-1",
  workspacePath: "/work/project/feature",
  workspaceLabel: "feature",
};

describe("Knowledge Source/Evidence viewer transport", () => {
  it("injects host Workspace scope for Source list", async () => {
    const client = new RecordingClient();
    await request(client, ctx(KNOWLEDGE_SOURCES_LIST_OPERATION, null));
    expect(client.calls).toEqual([{ operation: "viewer.sources.list", input: { scope: expectedScope } }]);
  });

  it("allows only a Source id from the browser and injects host scope", async () => {
    const client = new RecordingClient();
    await request(client, ctx(KNOWLEDGE_SOURCE_GET_OPERATION, { sourceId: "source-1" }));
    expect(client.calls).toEqual([{
      operation: "viewer.source.get",
      input: { scope: expectedScope, sourceId: "source-1" },
    }]);
  });

  it("passes historical artifact/evidence ids without accepting browser-authored Workspace authority", async () => {
    const client = new RecordingClient();
    await request(client, ctx(KNOWLEDGE_ARTIFACT_OPEN_OPERATION, {
      parsedArtifactId: "artifact-old",
      evidenceId: "evidence-old",
      maxBytes: 49152,
    }));
    expect(client.calls).toEqual([{
      operation: "viewer.artifact.open",
      input: {
        scope: expectedScope,
        parsedArtifactId: "artifact-old",
        evidenceId: "evidence-old",
        maxBytes: 49152,
      },
    }]);
  });

  it("rejects scope/path injection before contacting pi-knowledge", async () => {
    const client = new RecordingClient();
    await expect(request(client, ctx(KNOWLEDGE_SOURCE_GET_OPERATION, {
      sourceId: "source-1",
      workspacePath: "/tmp/spoofed",
    }))).rejects.toThrow(/unsupported field/);
    expect(client.calls).toHaveLength(0);
  });

  it("rejects artifact-open target URLs and other proxy-shaped input", async () => {
    const client = new RecordingClient();
    await expect(request(client, ctx(KNOWLEDGE_ARTIFACT_OPEN_OPERATION, {
      parsedArtifactId: "artifact-old",
      targetUrl: "http://127.0.0.1:9999",
    }))).rejects.toThrow(/unsupported field/);
    expect(client.calls).toHaveLength(0);
  });
});
