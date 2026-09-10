import type {
  PiWebPlugin,
  QualifiedContributionId,
  WorkspacePanelContext,
} from "@jmfederico/pi-web/plugin-api";

interface SourceSummary {
  id: string;
  displayName: string;
  kind: string;
  archivedAt: string | null;
  versionCount: number;
  latestVersionId: string | null;
}

interface ArtifactSummary {
  id: string;
  sourceVersionId: string;
  parserVersion: string;
  createdAt: string;
}

interface SourceVersionSummary {
  id: string;
  contentSha256: string;
  byteLength: number;
  createdAt: string;
  parsedArtifacts: ArtifactSummary[];
}

interface SourceDetail {
  id: string;
  displayName: string;
  kind: string;
  archivedAt: string | null;
  versions: SourceVersionSummary[];
}

interface ArtifactDocument {
  source: { id: string; displayName: string; kind: string };
  sourceVersion: { id: string; contentSha256: string; byteLength: number; createdAt: string };
  parsedArtifact: ArtifactSummary & { canonicalTextSha256: string };
  text: string;
  byteLength: number;
  truncated: boolean;
  highlight: null | {
    evidenceId: string;
    startByte: number;
    endByte: number;
    startByteInDocument: number;
    endByteInDocument: number;
    exactQuote: string;
    quoteHash: string;
  };
}

interface ViewerState {
  loading: boolean;
  sources: SourceSummary[];
  selectedSource?: SourceDetail | undefined;
  document?: ArtifactDocument | undefined;
  evidenceId: string;
  error?: string | undefined;
}

type ViewerRequestInput = null | Record<string, string | number>;

const states = new Map<string, ViewerState>();

const plugin: PiWebPlugin = {
  apiVersion: 2,
  name: "Knowledge",
  activate: ({ runtimePluginId, html, svg }) => {
    const panelId: QualifiedContributionId = `${runtimePluginId}:workspace.knowledge`;

    return {
      contributions: {
        actions: [{
          id: "view.knowledge",
          title: "Go to Knowledge",
          description: "Open the Knowledge workspace panel.",
          group: "Navigation",
          enabled: (context) => context.state.selectedWorkspace !== undefined,
          run: (context) => {
            if (context.state.selectedWorkspace !== undefined) context.selectWorkspaceTool(panelId);
          },
        }],
        workspacePanels: [{
          id: "workspace.knowledge",
          title: "Knowledge",
          icon: svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
          order: 35,
          routeAliases: ["knowledge"],
          render: (context) => {
            const key = workspaceKey(context);
            const state = getState(key);
            const selectedSummary = state.selectedSource === undefined
              ? undefined
              : state.sources.find((source) => source.id === state.selectedSource?.id);
            const segments = state.document?.highlight === null || state.document?.highlight === undefined
              ? undefined
              : splitByUtf8ByteRange(
                  state.document.text,
                  state.document.highlight.startByteInDocument,
                  state.document.highlight.endByteInDocument,
                );

            return html`
              <section style="display:flex;flex-direction:column;gap:14px;padding:18px;min-height:0;">
                <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
                  <div>
                    <h2 style="margin:0 0 5px;font-size:1.2rem;">Knowledge Sources</h2>
                    <p style="margin:0;opacity:.72;">Selected Machine / Workspace authority is supplied by PI WEB. Historical Evidence opens its recorded SourceVersion.</p>
                  </div>
                  <button type="button" ?disabled=${state.loading} @click=${() => { void loadSources(context); }}>
                    ${state.loading ? "Loading…" : "Refresh"}
                  </button>
                </header>

                ${state.error === undefined ? "" : html`<div role="alert" style="padding:10px;border:1px solid currentColor;border-radius:8px;">${state.error}</div>`}

                <div style="display:grid;grid-template-columns:minmax(190px,0.75fr) minmax(250px,1fr) minmax(0,2fr);gap:12px;min-height:520px;">
                  <aside style="border:1px solid var(--border-color,currentColor);border-radius:10px;padding:10px;overflow:auto;">
                    <strong>Sources</strong>
                    ${state.sources.length === 0
                      ? html`<p style="opacity:.65;">No Sources loaded.</p>`
                      : state.sources.map((source) => html`
                          <button
                            type="button"
                            style="display:block;width:100%;text-align:left;margin-top:8px;padding:9px;border-radius:8px;border:1px solid var(--border-color,currentColor);background:${state.selectedSource?.id === source.id ? "var(--surface-hover,rgba(127,127,127,.15))" : "transparent"};"
                            @click=${() => { void loadSource(context, source.id); }}
                          >
                            <div>${source.displayName}</div>
                            <small style="opacity:.65;">${source.kind} · ${String(source.versionCount)} version${source.versionCount === 1 ? "" : "s"}${source.archivedAt === null ? "" : " · archived"}</small>
                          </button>
                        `)}
                  </aside>

                  <aside style="border:1px solid var(--border-color,currentColor);border-radius:10px;padding:10px;overflow:auto;">
                    <strong>Version history</strong>
                    ${state.selectedSource === undefined
                      ? html`<p style="opacity:.65;">Select a Source.</p>`
                      : state.selectedSource.versions.length === 0
                        ? html`<p style="opacity:.65;">No SourceVersion captured.</p>`
                        : state.selectedSource.versions.map((version) => html`
                            <div style="margin-top:9px;padding:9px;border:1px solid var(--border-color,currentColor);border-radius:8px;">
                              <div style="display:flex;justify-content:space-between;gap:8px;">
                                <code style="font-size:.76rem;overflow-wrap:anywhere;">${version.id}</code>
                                ${selectedSummary?.latestVersionId === version.id ? html`<small>latest</small>` : html`<small>historical</small>`}
                              </div>
                              <small style="opacity:.65;">${version.createdAt} · ${String(version.byteLength)} B</small>
                              ${version.parsedArtifacts.map((artifact) => html`
                                <button
                                  type="button"
                                  style="display:block;width:100%;margin-top:7px;text-align:left;"
                                  @click=${() => { void openArtifact(context, artifact.id, state.evidenceId); }}
                                >Open artifact · ${artifact.parserVersion}</button>
                              `)}
                            </div>
                          `)}
                  </aside>

                  <main style="border:1px solid var(--border-color,currentColor);border-radius:10px;padding:12px;overflow:auto;min-width:0;">
                    <div style="display:flex;align-items:end;gap:8px;margin-bottom:12px;">
                      <label style="flex:1;">Evidence ID (optional)
                        <input
                          style="display:block;width:100%;box-sizing:border-box;margin-top:4px;"
                          .value=${state.evidenceId}
                          @input=${(event: Event) => {
                            state.evidenceId = (event.currentTarget as HTMLInputElement).value;
                          }}
                          placeholder="Paste a historical Evidence id before opening an artifact"
                        />
                      </label>
                    </div>

                    ${state.document === undefined
                      ? html`<p style="opacity:.65;">Choose a ParsedArtifact from a SourceVersion.</p>`
                      : html`
                          <div style="margin-bottom:10px;">
                            <strong>${state.document.source.displayName}</strong>
                            <div style="font-size:.78rem;opacity:.7;overflow-wrap:anywhere;">
                              SourceVersion <code>${state.document.sourceVersion.id}</code><br/>
                              ParsedArtifact <code>${state.document.parsedArtifact.id}</code>
                              ${selectedSummary?.latestVersionId === state.document.sourceVersion.id ? " · latest" : " · historical"}
                              ${state.document.truncated ? " · bounded view" : ""}
                            </div>
                          </div>
                          ${state.document.highlight === null
                            ? html`<pre style="white-space:pre-wrap;overflow-wrap:anywhere;margin:0;">${state.document.text}</pre>`
                            : html`
                                <div style="margin-bottom:10px;padding:9px;border-left:3px solid currentColor;background:rgba(127,127,127,.12);">
                                  Evidence <code>${state.document.highlight.evidenceId}</code> · bytes
                                  ${String(state.document.highlight.startByte)}–${String(state.document.highlight.endByte)}
                                </div>
                                <pre style="white-space:pre-wrap;overflow-wrap:anywhere;margin:0;">${segments?.before}<mark>${segments?.highlight}</mark>${segments?.after}</pre>
                              `}
                        `}
                  </main>
                </div>
              </section>
            `;
          },
        }],
      },
    };
  },
};

export default plugin;

function getState(key: string): ViewerState {
  const existing = states.get(key);
  if (existing !== undefined) return existing;
  const created: ViewerState = { loading: false, sources: [], evidenceId: "" };
  states.set(key, created);
  return created;
}

async function loadSources(context: WorkspacePanelContext): Promise<void> {
  const state = getState(workspaceKey(context));
  state.loading = true;
  state.error = undefined;
  context.host.requestRender();
  try {
    const response = await requestBackend(context, "knowledge.viewer.sources.list", null);
    state.sources = parseSources(response);
    if (state.selectedSource !== undefined && !state.sources.some((source) => source.id === state.selectedSource?.id)) {
      state.selectedSource = undefined;
      state.document = undefined;
    }
  } catch (error) {
    state.error = boundedErrorMessage(error);
  } finally {
    state.loading = false;
    context.host.requestRender();
  }
}

async function loadSource(context: WorkspacePanelContext, sourceId: string): Promise<void> {
  const state = getState(workspaceKey(context));
  state.loading = true;
  state.error = undefined;
  context.host.requestRender();
  try {
    state.selectedSource = parseSource(await requestBackend(context, "knowledge.viewer.source.get", { sourceId }));
    state.document = undefined;
  } catch (error) {
    state.error = boundedErrorMessage(error);
  } finally {
    state.loading = false;
    context.host.requestRender();
  }
}

async function openArtifact(context: WorkspacePanelContext, parsedArtifactId: string, evidenceId: string): Promise<void> {
  const state = getState(workspaceKey(context));
  state.loading = true;
  state.error = undefined;
  context.host.requestRender();
  try {
    state.document = parseDocument(await requestBackend(context, "knowledge.viewer.artifact.open", {
      parsedArtifactId,
      ...(evidenceId.trim().length === 0 ? {} : { evidenceId: evidenceId.trim() }),
      maxBytes: 40 * 1024,
    }));
  } catch (error) {
    state.error = boundedErrorMessage(error);
  } finally {
    state.loading = false;
    context.host.requestRender();
  }
}

async function requestBackend(
  context: WorkspacePanelContext,
  operation: string,
  input: ViewerRequestInput,
): Promise<unknown> {
  const backend = context.pairedBackend;
  if (backend?.requestVersion !== 1) throw new Error("Paired backend request capability is unavailable");
  return await backend.request(operation, input);
}

function parseSources(value: unknown): SourceSummary[] {
  const root = requireRecord(value, "Sources response");
  if (root["version"] !== 1 || !Array.isArray(root["sources"])) throw new Error("Sources response is invalid");
  return root["sources"].map((item) => {
    const row = requireRecord(item, "Source summary");
    return {
      id: requireString(row, "id"), displayName: requireString(row, "displayName"), kind: requireString(row, "kind"),
      archivedAt: nullableString(row, "archivedAt"), versionCount: requireInteger(row, "versionCount"),
      latestVersionId: nullableString(row, "latestVersionId"),
    };
  });
}

function parseSource(value: unknown): SourceDetail {
  const root = requireRecord(value, "Source response");
  if (root["version"] !== 1) throw new Error("Source response version must be 1");
  const source = requireRecord(root["source"], "Source detail");
  const versions = source["versions"];
  if (!Array.isArray(versions)) throw new Error("Source versions must be an array");
  return {
    id: requireString(source, "id"), displayName: requireString(source, "displayName"), kind: requireString(source, "kind"),
    archivedAt: nullableString(source, "archivedAt"),
    versions: versions.map((item) => {
      const version = requireRecord(item, "SourceVersion");
      const artifacts = version["parsedArtifacts"];
      if (!Array.isArray(artifacts)) throw new Error("ParsedArtifacts must be an array");
      return {
        id: requireString(version, "id"), contentSha256: requireString(version, "contentSha256"),
        byteLength: requireInteger(version, "byteLength"), createdAt: requireString(version, "createdAt"),
        parsedArtifacts: artifacts.map((entry) => {
          const artifact = requireRecord(entry, "ParsedArtifact");
          return {
            id: requireString(artifact, "id"), sourceVersionId: requireString(artifact, "sourceVersionId"),
            parserVersion: requireString(artifact, "parserVersion"), createdAt: requireString(artifact, "createdAt"),
          };
        }),
      };
    }),
  };
}

function parseDocument(value: unknown): ArtifactDocument {
  const root = requireRecord(value, "Artifact response");
  if (root["version"] !== 1) throw new Error("Artifact response version must be 1");
  const document = requireRecord(root["document"], "Artifact document");
  const source = requireRecord(document["source"], "Artifact source");
  const version = requireRecord(document["sourceVersion"], "Artifact SourceVersion");
  const artifact = requireRecord(document["parsedArtifact"], "ParsedArtifact");
  const rawHighlight = document["highlight"];
  const highlight = rawHighlight === null ? null : parseHighlight(rawHighlight);
  const text = document["text"];
  const truncated = document["truncated"];
  if (typeof text !== "string" || typeof truncated !== "boolean") {
    throw new Error("Artifact document text/truncation metadata is invalid");
  }
  return {
    source: { id: requireString(source, "id"), displayName: requireString(source, "displayName"), kind: requireString(source, "kind") },
    sourceVersion: {
      id: requireString(version, "id"), contentSha256: requireString(version, "contentSha256"),
      byteLength: requireInteger(version, "byteLength"), createdAt: requireString(version, "createdAt"),
    },
    parsedArtifact: {
      id: requireString(artifact, "id"), sourceVersionId: requireString(artifact, "sourceVersionId"),
      parserVersion: requireString(artifact, "parserVersion"), canonicalTextSha256: requireString(artifact, "canonicalTextSha256"),
      createdAt: requireString(artifact, "createdAt"),
    },
    text,
    byteLength: requireInteger(document, "byteLength"),
    truncated,
    highlight,
  };
}

function parseHighlight(value: unknown): NonNullable<ArtifactDocument["highlight"]> {
  const row = requireRecord(value, "Evidence highlight");
  return {
    evidenceId: requireString(row, "evidenceId"), startByte: requireInteger(row, "startByte"),
    endByte: requireInteger(row, "endByte"), startByteInDocument: requireInteger(row, "startByteInDocument"),
    endByteInDocument: requireInteger(row, "endByteInDocument"), exactQuote: requireString(row, "exactQuote"),
    quoteHash: requireString(row, "quoteHash"),
  };
}

function splitByUtf8ByteRange(text: string, startByte: number, endByte: number): { before: string; highlight: string; after: string } {
  const bytes = new TextEncoder().encode(text);
  if (startByte < 0 || endByte <= startByte || endByte > bytes.byteLength) throw new Error("Evidence highlight byte range is invalid");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return {
    before: decoder.decode(bytes.slice(0, startByte)),
    highlight: decoder.decode(bytes.slice(startByte, endByte)),
    after: decoder.decode(bytes.slice(endByte)),
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}
function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} must be null or a non-empty string`);
  return value;
}
function requireInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${key} must be a non-negative integer`);
  return value;
}
function workspaceKey(context: WorkspacePanelContext): string {
  return `${context.machine.id}\u0000${context.workspace.projectId}\u0000${context.workspace.id}`;
}
function boundedErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= 1_024 ? message : `${message.slice(0, 1_021)}...`;
}
