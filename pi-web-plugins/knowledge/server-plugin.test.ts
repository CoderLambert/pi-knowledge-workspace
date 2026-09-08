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
  readonly dispatchCalls: Array<{
    operation: KnowledgeServiceOperation;
    input: unknown;
    signal: AbortSignal;
  }> = [];

  dispatchResult: Record<string, unknown> = {
    projectId: "project-1",
    workspaceId: "workspace-1",
    workspacePath: "/work/project-one/worktree",
    workspaceLabel: "feature/p0",
  };

  async dispatch(
    operation: KnowledgeServiceOperation,
    input: unknown,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    this.dispatchCalls.push({ operation, input, signal });
    return this.dispatchResult;
  }

  async health(): Promise<Record<string, unknown>> {
    return { status: "healthy" };
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

async function request(
  input: PairedPluginRequestContext,
  serviceClient: KnowledgeServiceClient,
): Promise<unknown> {
  const backend = createKnowledgeBackend(serviceClient);
  if (backend.request === undefined) throw new Error("Knowledge request capability is missing");
  return await backend.request(input);
}

describe("Knowledge paired backend", () => {
  it("dispatches host-authoritative scope to pi-knowledge and returns it only after an exact echo", async () => {
    const serviceClient = new RecordingKnowledgeServiceClient();
    const requestContext = context();

    await expect(request(requestContext, serviceClient)).resolves.toEqual({
      version: 1,
      status: "ready",
      scope: {
        projectId: "project-1",
        workspaceId: "workspace-1",
        workspacePath: "/work/project-one/worktree",
        workspaceLabel: "feature/p0",
      },
    });

    expect(serviceClient.dispatchCalls).toHaveLength(1);
    expect(serviceClient.dispatchCalls[0]).toEqual({
      operation: "workspace.echo",
      input: {
        projectId: "project-1",
        workspaceId: "workspace-1",
        workspacePath: "/work/project-one/worktree",
        workspaceLabel: "feature/p0",
      },
      signal: requestContext.signal,
    });
  });

  it("rejects browser-authored scope fields before contacting pi-knowledge", async () => {
    const serviceClient = new RecordingKnowledgeServiceClient();
    await expect(request(context({
      input: {
        projectId: "spoofed-project",
        workspaceId: "spoofed-workspace",
        workspacePath: "/tmp/spoofed",
      },
    }), serviceClient)).rejects.toThrow("knowledge.status input must be null or an empty object");
    expect(serviceClient.dispatchCalls).toHaveLength(0);
  });

  it("rejects a mismatched host project/workspace scope before contacting pi-knowledge", async () => {
    const serviceClient = new RecordingKnowledgeServiceClient();
    await expect(request(context({
      workspace: {
        id: "workspace-1",
        projectId: "another-project",
        path: "/work/project-one/worktree",
        label: "feature/p0",
        isMain: false,
      },
    }), serviceClient)).rejects.toThrow("Knowledge workspace project scope does not match the host project");
    expect(serviceClient.dispatchCalls).toHaveLength(0);
  });

  it("rejects unsupported browser operations before contacting pi-knowledge", async () => {
    const serviceClient = new RecordingKnowledgeServiceClient();
    await expect(request(context({ operation: "knowledge.unknown" }), serviceClient))
      .rejects.toThrow("Unsupported Knowledge operation: knowledge.unknown");
    expect(serviceClient.dispatchCalls).toHaveLength(0);
  });

  it("rejects a service response that does not exactly match host-authoritative scope", async () => {
    const serviceClient = new RecordingKnowledgeServiceClient();
    serviceClient.dispatchResult = {
      projectId: "project-1",
      workspaceId: "spoofed-workspace",
      workspacePath: "/tmp/spoofed",
      workspaceLabel: "feature/p0",
    };

    await expect(request(context(), serviceClient)).rejects.toThrow(
      "pi-knowledge returned workspace scope that does not match the host-authoritative scope",
    );
  });

  it("propagates a host cancellation without contacting pi-knowledge", async () => {
    const serviceClient = new RecordingKnowledgeServiceClient();
    const controller = new AbortController();
    controller.abort(new Error("host request cancelled"));

    await expect(request(context({ signal: controller.signal }), serviceClient))
      .rejects.toThrow("host request cancelled");
    expect(serviceClient.dispatchCalls).toHaveLength(0);
  });
});
