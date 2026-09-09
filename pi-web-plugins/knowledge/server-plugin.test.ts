import { describe, expect, it } from "vitest";
import type {
  PairedPluginRequestContext,
} from "@jmfederico/pi-web/server-plugin-api";
import type {
  KnowledgeServiceClient,
  KnowledgeServiceOperation,
} from "./service-client.js";
import {
  createKnowledgeBackend,
  KNOWLEDGE_STATUS_OPERATION,
} from "./server-plugin.js";

class RecordingKnowledgeServiceClient implements KnowledgeServiceClient {
  readonly dispatchCalls: {
    operation: KnowledgeServiceOperation;
    input: unknown;
    signal: AbortSignal;
  }[] = [];

  dispatchResult: Record<string, unknown> = {
    projectId: "project-1",
    workspaceId: "workspace-1",
    workspacePath: "/work/project-one/worktree",
    workspaceLabel: "feature/p0",
  };

  dispatch(
    operation: KnowledgeServiceOperation,
    input: unknown,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    this.dispatchCalls.push({ operation, input, signal });
    return Promise.resolve(this.dispatchResult);
  }

  health(): Promise<Record<string, unknown>> {
    return Promise.resolve({ status: "healthy" });
  }
}

function context(
  overrides: Partial<PairedPluginRequestContext> = {},
): PairedPluginRequestContext {
  return {
    project: {
      id: "project-1",
      name: "Project One",
      path: "/work/project-one",
    },
    workspace: {
      id: "workspace-1",
      projectId: "project-1",
      path: "/work/project-one/worktree",
      label: "feature/p0",
      isMain: false,
    },
    operation: KNOWLEDGE_STATUS_OPERATION,
    input: null,
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("Knowledge server plugin", () => {
  it("forwards only host-authoritative scope through workspace.echo", async () => {
    const client = new RecordingKnowledgeServiceClient();
    const backend = createKnowledgeBackend(client);
    const result = await backend.request(context({
      input: {
        projectId: "spoofed-project",
        workspaceId: "spoofed-workspace",
        workspacePath: "/tmp/spoofed",
      },
    }));

    expect(client.dispatchCalls).toHaveLength(1);
    expect(client.dispatchCalls[0]).toEqual({
      operation: "workspace.echo",
      input: {
        projectId: "project-1",
        workspaceId: "workspace-1",
        workspacePath: "/work/project-one/worktree",
        workspaceLabel: "feature/p0",
      },
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      version: 1,
      status: "ready",
      scope: client.dispatchResult,
    });
  });

  it("fails closed when pi-knowledge returns mismatched authoritative scope", async () => {
    const client = new RecordingKnowledgeServiceClient();
    client.dispatchResult = {
      projectId: "project-1",
      workspaceId: "workspace-1",
      workspacePath: "/work/project-one/other",
      workspaceLabel: "feature/p0",
    };
    const backend = createKnowledgeBackend(client);

    await expect(backend.request(context())).rejects.toThrow(/does not match the host-authoritative scope/);
  });

  it("rejects host Project/Workspace mismatch before reaching pi-knowledge", async () => {
    const client = new RecordingKnowledgeServiceClient();
    const backend = createKnowledgeBackend(client);

    await expect(backend.request(context({
      workspace: {
        id: "workspace-1",
        projectId: "different-project",
        path: "/work/project-one/worktree",
        label: "feature/p0",
        isMain: false,
      },
    }))).rejects.toThrow(/does not match the host project/);
    expect(client.dispatchCalls).toHaveLength(0);
  });

  it("rejects unsupported operation rather than proxying arbitrary input", async () => {
    const client = new RecordingKnowledgeServiceClient();
    const backend = createKnowledgeBackend(client);

    await expect(backend.request(context({ operation: "knowledge.shell" }))).rejects.toThrow(
      "Unsupported Knowledge operation",
    );
    expect(client.dispatchCalls).toHaveLength(0);
  });
});
