import { describe, expect, it } from "vitest";
import type {
  PiWebPlugin,
  PluginActivationContext,
} from "@jmfederico/pi-web/plugin-api";
import plugin from "./browser/pi-web-plugin.js";

function activationContext(): PluginActivationContext {
  const template = (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) as never;
  return {
    apiVersion: 2,
    pluginId: "knowledge",
    runtimePluginId: "knowledge",
    html: template,
    svg: template,
  };
}

function activate(value: PiWebPlugin = plugin) {
  return value.activate(activationContext());
}

describe("Knowledge browser plugin", () => {
  it("contributes one Knowledge workspace panel without a core navigation patch", () => {
    const result = activate();
    const panel = result.contributions.workspacePanels?.[0];

    expect(panel?.id).toBe("workspace.knowledge");
    expect(panel?.title).toBe("Knowledge");
    expect(panel?.order).toBe(35);
    expect(panel?.routeAliases).toEqual(["knowledge"]);
  });

  it("contributes an action that opens the Knowledge workspace tool", () => {
    const result = activate();
    const action = result.contributions.actions?.[0];
    let selected: string | undefined;

    action?.run({
      state: { selectedWorkspace: { id: "workspace-1" } },
      selectWorkspaceTool: (id) => { selected = id; },
    } as never);

    expect(selected).toBe("knowledge:workspace.knowledge");
  });
});
