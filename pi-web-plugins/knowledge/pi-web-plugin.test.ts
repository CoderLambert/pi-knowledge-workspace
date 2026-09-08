// @vitest-environment happy-dom

import { html, render, svg } from "lit";
import { describe, expect, it, vi } from "vitest";
import type {
  JsonValue,
  Workspace,
  WorkspacePanelContext,
} from "@jmfederico/pi-web/plugin-api";
import plugin from "./browser/pi-web-plugin.js";

const workspace: Workspace = {
  id: "workspace-1",
  projectId: "project-1",
  path: "/work/project-one/worktree",
  label: "feature/p0",
  isMain: false,
};

function activate(runtimePluginId = "knowledge") {
  return plugin.activate({
    apiVersion: 2,
    pluginId: "knowledge",
    runtimePluginId,
    html,
    svg,
  }).contributions;
}

describe("Knowledge browser plugin", () => {
  it("contributes one Knowledge workspace panel without a core navigation patch", () => {
    const panel = activate().workspacePanels?.[0];

    expect(panel?.id).toBe("workspace.knowledge");
    expect(panel?.title).toBe("Knowledge");
    expect(panel?.order).toBe(35);
    expect(panel?.routeAliases).toEqual(["knowledge"]);
  });

  it("uses runtime plugin identity when opening the workspace tool", () => {
    const runtimePluginId = "machine.72656d6f74652d31.knowledge";
    const action = activate(runtimePluginId).actions?.[0];
    let selected: string | undefined;

    action?.run({
      state: { selectedWorkspace: workspace },
      selectWorkspaceTool: (id) => { selected = id; },
    } as never);

    expect(selected).toBe(`${runtimePluginId}:workspace.knowledge`);
  });

  it("checks integration through the paired backend and renders host scope", async () => {
    const request = vi.fn((operation: string, input: JsonValue): Promise<JsonValue> => {
      expect(operation).toBe("knowledge.status");
      expect(input).toBeNull();
      return Promise.resolve({
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
    const context = panelContext(request);
    const panel = requiredPanel();
    const container = document.createElement("div");

    render(panel.render(context), container);
    clickIntegrationCheck(container);
    await settleBackend();
    render(panel.render(context), container);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("knowledge.status", null);
    expect(container.textContent).toContain("ready");
    expect(container.textContent).toContain("project-1");
    expect(container.textContent).toContain("workspace-1");
    expect(container.textContent).toContain("/work/project-one/worktree");
  });

  it("keeps the panel visible and reports a missing paired backend capability", async () => {
    const context = panelContext();
    const panel = requiredPanel();
    const container = document.createElement("div");

    expect(panel.visible).toBeUndefined();
    render(panel.render(context), container);
    clickIntegrationCheck(container);
    await settleBackend();
    render(panel.render(context), container);

    expect(container.textContent).toContain("Paired backend request capability is unavailable");
  });
});

function requiredPanel() {
  const panel = activate().workspacePanels?.[0];
  if (panel === undefined) throw new Error("Expected Knowledge workspace panel");
  return panel;
}

function clickIntegrationCheck(container: ParentNode): void {
  const button = container.querySelector("button");
  if (button === null) throw new Error("Expected Knowledge integration check button");
  button.click();
}

function panelContext(
  request?: (operation: string, input: JsonValue) => Promise<JsonValue>,
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
    ...(request === undefined
      ? {}
      : {
          pairedBackend: {
            version: 1 as const,
            requestVersion: 1 as const,
            request,
          },
        }),
    host: { requestRender: noop },
    prompt: { insertText: noop, getText: () => "", getSelection: () => null },
    terminal: {
      open: noop,
      runCommand: () => Promise.reject(new Error("not implemented")),
    },
  };
}

async function settleBackend(): Promise<void> {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}
