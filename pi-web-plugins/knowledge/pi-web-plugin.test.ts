// @vitest-environment happy-dom

import { html, render, svg } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import type {
  JsonValue,
  PluginRuntimeContext,
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

afterEach(() => {
  document.body.replaceChildren();
});

describe("Knowledge browser plugin", () => {
  it("contributes one Knowledge workspace panel without a core navigation patch", () => {
    const panel = activate().workspacePanels?.[0];

    expect(panel?.id).toBe("workspace.knowledge");
    expect(panel?.title).toBe("Knowledge");
    expect(panel?.order).toBe(35);
    expect(panel?.routeAliases).toEqual(["knowledge"]);
  });

  it("uses runtime plugin identity when opening the workspace tool", async () => {
    const runtimePluginId = "machine.72656d6f74652d31.knowledge";
    const action = activate(runtimePluginId).actions?.[0];
    if (action === undefined) throw new Error("Expected Knowledge action");
    let selected: string | undefined;

    await action.run(runtimeContext((id) => { selected = id; }));

    expect(selected).toBe(`${runtimePluginId}:workspace.knowledge`);
  });

  it("renders the Product Preview inside the Knowledge panel", async () => {
    const context = panelContext();
    const panel = requiredPanel();
    const container = document.createElement("div");
    document.body.append(container);

    render(panel.render(context), container);
    await settleBackend();
    const preview = container.querySelector("pi-web-knowledge-product-preview");
    expect(preview).not.toBeNull();
    expect(preview?.shadowRoot?.textContent).toContain("Grounded Ask");
  });

  it("keeps the panel actionable when the paired backend is unavailable", async () => {
    const context = panelContext();
    const panel = requiredPanel();
    const container = document.createElement("div");
    document.body.append(container);

    expect(panel.visible).toBeUndefined();
    render(panel.render(context), container);
    await settleBackend();
    const preview = container.querySelector("pi-web-knowledge-product-preview");
    const filePicker = preview?.shadowRoot?.querySelector<HTMLButtonElement>("[data-file-picker-trigger]");
    const importButton = preview?.shadowRoot?.querySelector<HTMLButtonElement>("[data-import]");
    if (filePicker === null || filePicker === undefined || importButton === null || importButton === undefined) throw new Error("Product Preview import controls are missing");
    filePicker.click();
    await settleBackend();
    const file = preview?.shadowRoot?.querySelector<HTMLButtonElement>("[data-file-picker-file='docs/readme.md']");
    if (file === null || file === undefined) throw new Error("Workspace source file is missing");
    file.click();
    await settleBackend();
    const selectedImportButton = preview?.shadowRoot?.querySelector<HTMLButtonElement>("[data-import]");
    if (selectedImportButton === null || selectedImportButton === undefined) throw new Error("Product Preview import action is missing");
    selectedImportButton.click();
    await settleBackend();

    expect(preview?.shadowRoot?.textContent).toContain("Paired backend request capability is unavailable");
  });
});

function requiredPanel() {
  const panel = activate().workspacePanels?.[0];
  if (panel === undefined) throw new Error("Expected Knowledge workspace panel");
  return panel;
}

function runtimeContext(selectWorkspaceTool: PluginRuntimeContext["selectWorkspaceTool"]): PluginRuntimeContext {
  const noop = () => undefined;
  return {
    state: { selectedWorkspace: workspace },
    prompt: { insertText: noop, getText: () => "", getSelection: () => null },
    openActionPalette: noop,
    focusPrompt: noop,
    addProject: noop,
    configureAuth: noop,
    logoutAuth: noop,
    openThemePicker: noop,
    selectMainView: noop,
    selectWorkspaceTool,
    openTerminal: noop,
    refreshFiles: noop,
    refreshWorkspacePanels: noop,
    refreshAppData: noop,
    checkForPiWebUpdates: noop,
    reloadPage: noop,
    startSession: noop,
    archiveSession: noop,
    stopActiveWork: noop,
  };
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
      listFiles: (path) => Promise.resolve({
        path,
        entries: path === "" ? [{ name: "readme.md", path: "docs/readme.md", type: "file" }] : [],
        scannedAt: "2026-09-10T00:00:00.000Z",
        truncated: false,
      }),
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
