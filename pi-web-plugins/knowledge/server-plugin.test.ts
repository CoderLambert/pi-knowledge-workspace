import { describe, expect, it } from "vitest";
import type {
  PairedPluginRequestContext,
} from "@jmfederico/pi-web/server-plugin-api";
import {
  createKnowledgeBackend,
  KNOWLEDGE_STATUS_OPERATION,
} from "./server-plugin.js";

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

async function request(input: PairedPluginRequestContext): Promise<unknown> {
  const backend = createKnowledgeBackend();
  if (backend.request === undefined) throw new Error("Knowledge request capability is missing");
  return await backend.request(input);
}

describe("Knowledge paired backend", () => {
  it("returns the host-resolved project and workspace scope", async () => {
    await expect(request(context())).resolves.toEqual({
      version: 1,
      status: "ready",
      scope: {
        projectId: "project-1",
        workspaceId: "workspace-1",
        workspacePath: "/work/project-one/worktree",
        workspaceLabel: "feature/p0",
      },
    });
  });

  it("rejects browser-authored scope fields instead of trusting them", async () => {
    await expect(request(context({
      input: {
        projectId: "spoofed-project",
        workspaceId: "spoofed-workspace",
        workspacePath: "/tmp/spoofed",
      },
    }))).rejects.toThrow("knowledge.status input must be null or an empty object");
  });

  it("rejects a mismatched host project/workspace scope", async () => {
    await expect(request(context({
      workspace: {
        id: "workspace-1",
        projectId: "another-project",
        path: "/work/project-one/worktree",
        label: "feature/p0",
        isMain: false,
      },
    }))).rejects.toThrow("Knowledge workspace project scope does not match the host project");
  });

  it("rejects unsupported operations", async () => {
    await expect(request(context({ operation: "knowledge.unknown" })))
      .rejects.toThrow("Unsupported Knowledge operation: knowledge.unknown");
  });
});
