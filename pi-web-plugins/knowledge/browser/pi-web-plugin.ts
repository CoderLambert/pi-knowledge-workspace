import type { PiWebPlugin, QualifiedContributionId } from "@jmfederico/pi-web/plugin-api";
import { defineKnowledgeProductPreview } from "./ProductPreview.js";

const plugin: PiWebPlugin = {
  apiVersion: 2,
  name: "Knowledge",
  activate: ({ runtimePluginId, html, svg }) => {
    defineKnowledgeProductPreview();
    const panelId: QualifiedContributionId = `${runtimePluginId}:workspace.knowledge`;

    return {
      contributions: {
        actions: [{
          id: "view.knowledge",
          title: "Go to Knowledge",
          description: "Open the Grounded Ask workspace panel.",
          group: "Navigation",
          enabled: (context) => context.state.selectedWorkspace !== undefined,
          run: (context) => {
            if (context.state.selectedWorkspace !== undefined) context.selectWorkspaceTool(panelId);
          },
        }],
        workspacePanels: [{
          id: "workspace.knowledge",
          title: "Knowledge",
          icon: svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
          order: 35,
          routeAliases: ["knowledge"],
          render: (context) => html`<pi-web-knowledge-product-preview .context=${context}></pi-web-knowledge-product-preview>`,
        }],
      },
    };
  },
};

export default plugin;
