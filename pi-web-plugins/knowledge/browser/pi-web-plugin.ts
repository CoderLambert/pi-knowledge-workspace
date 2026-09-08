import type {
  PiWebPlugin,
  QualifiedContributionId,
  WorkspacePanelContext,
} from "@jmfederico/pi-web/plugin-api";

interface KnowledgeStatus {
  readonly version: 1;
  readonly status: "ready";
  readonly scope: {
    readonly projectId: string;
    readonly workspaceId: string;
    readonly workspacePath: string;
    readonly workspaceLabel: string;
  };
}

interface KnowledgePanelState {
  loading: boolean;
  result?: KnowledgeStatus;
  error?: string;
}

const states = new Map<string, KnowledgePanelState>();

const plugin: PiWebPlugin = {
  apiVersion: 2,
  name: "Knowledge",
  activate: ({ runtimePluginId, html, svg }) => {
    const panelId: QualifiedContributionId = `${runtimePluginId}:workspace.knowledge`;

    return {
      contributions: {
        actions: [
          {
            id: "view.knowledge",
            title: "Go to Knowledge",
            description: "Open the Knowledge workspace panel.",
            group: "Navigation",
            enabled: (context) => context.state.selectedWorkspace !== undefined,
            run: (context) => {
              if (context.state.selectedWorkspace === undefined) return;
              context.selectWorkspaceTool(panelId);
            },
          },
        ],
        workspacePanels: [
          {
            id: "workspace.knowledge",
            title: "Knowledge",
            icon: svg`
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            `,
            order: 35,
            routeAliases: ["knowledge"],
            render: (context) => {
              const key = workspaceKey(context);
              const state = states.get(key) ?? { loading: false };
              const result = state.result;

              return html`
                <section style="display:flex;flex-direction:column;gap:16px;padding:20px;max-width:920px;margin:0 auto;">
                  <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
                    <div>
                      <h2 style="margin:0 0 6px;font-size:1.2rem;">Knowledge</h2>
                      <p style="margin:0;opacity:.72;">
                        P0 integration skeleton. Requests are scoped by PI WEB to the selected Machine and Workspace.
                      </p>
                    </div>
                    <button
                      type="button"
                      ?disabled=${state.loading}
                      @click=${() => { void refreshKnowledgeStatus(context); }}
                    >
                      ${state.loading ? "Checking…" : "Check integration"}
                    </button>
                  </header>

                  <div style="border:1px solid var(--border-color, currentColor);border-radius:10px;padding:16px;opacity:${state.error === undefined ? "1" : ".92"};">
                    ${state.error !== undefined
                      ? html`<p style="margin:0;">Knowledge backend error: ${state.error}</p>`
                      : result === undefined
                        ? html`<p style="margin:0;opacity:.72;">Run the integration check to verify the paired backend scope.</p>`
                        : html`
                            <dl style="display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 16px;margin:0;">
                              <dt>Status</dt><dd style="margin:0;">${result.status}</dd>
                              <dt>Machine</dt><dd style="margin:0;">${context.machine.name} (${context.machine.id})</dd>
                              <dt>Project</dt><dd style="margin:0;">${result.scope.projectId}</dd>
                              <dt>Workspace</dt><dd style="margin:0;">${result.scope.workspaceLabel} (${result.scope.workspaceId})</dd>
                              <dt>Path</dt><dd style="margin:0;overflow-wrap:anywhere;"><code>${result.scope.workspacePath}</code></dd>
                            </dl>
                          `}
                  </div>
                </section>
              `;
            },
          },
        ],
      },
    };
  },
};

export default plugin;

async function refreshKnowledgeStatus(context: WorkspacePanelContext): Promise<void> {
  const key = workspaceKey(context);
  const backend = context.pairedBackend;
  if (backend?.requestVersion !== 1) {
    states.set(key, { loading: false, error: "Paired backend request capability is unavailable" });
    context.host.requestRender();
    return;
  }

  states.set(key, { loading: true });
  context.host.requestRender();

  try {
    const response = await backend.request("knowledge.status", null);
    states.set(key, { loading: false, result: parseKnowledgeStatus(response) });
  } catch (error) {
    states.set(key, { loading: false, error: boundedErrorMessage(error) });
  }
  context.host.requestRender();
}

function parseKnowledgeStatus(value: unknown): KnowledgeStatus {
  const root = requireRecord(value, "Knowledge status response");
  if (root["version"] !== 1) throw new Error("Knowledge status response version must be 1");
  if (root["status"] !== "ready") throw new Error("Knowledge status response must be ready");
  const scope = requireRecord(root["scope"], "Knowledge status scope");

  return {
    version: 1,
    status: "ready",
    scope: {
      projectId: requireString(scope, "projectId"),
      workspaceId: requireString(scope, "workspaceId"),
      workspacePath: requireString(scope, "workspacePath"),
      workspaceLabel: requireString(scope, "workspaceLabel"),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value === "") throw new Error(`Knowledge status ${key} must be a non-empty string`);
  return value;
}

function workspaceKey(context: WorkspacePanelContext): string {
  return `${context.machine.id}\u0000${context.workspace.projectId}\u0000${context.workspace.id}`;
}

function boundedErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= 1_024 ? message : `${message.slice(0, 1_021)}...`;
}
