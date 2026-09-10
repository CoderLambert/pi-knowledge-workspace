import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import type { FileTreeEntry, JsonValue, WorkspacePanelContext } from "@jmfederico/pi-web/plugin-api";

export const knowledgeProductPreviewTagName = "pi-web-knowledge-product-preview";

/** Transport names are deliberately local until the service dispatch contract is shared. */
export const KNOWLEDGE_IMPORT_OPERATION = "knowledge.import.submit";
export const KNOWLEDGE_IMPORT_STATUS_OPERATION = "knowledge.import.status";
export const KNOWLEDGE_PUBLISH_OPERATION = "knowledge.publish";
export const KNOWLEDGE_ASK_OPERATION = "knowledge.ask";
export const KNOWLEDGE_CITATION_OPEN_OPERATION = "knowledge.citation.open";
export const KNOWLEDGE_VIEWER_ARTIFACT_OPEN_OPERATION = "knowledge.viewer.artifact.open";

type PreviewStatus = "idle" | "loading" | "success" | "error";

interface ProductCitation {
  id: string;
  label: string;
  evidenceId: string;
  parsedArtifactId: string;
  sourceVersionId: string | undefined;
  exactQuote: string | undefined;
}

interface ProductAnswer {
  id: string | undefined;
  text: string;
  citations: ProductCitation[];
  generationRunId: string | undefined;
  publicationId: string | undefined;
  provider: string | undefined;
  model: string | undefined;
  modelRevision: string | undefined;
}

interface ProductState {
  importPath: string;
  displayName: string;
  question: string;
  sourceId: string | undefined;
  sourceVersionId: string | undefined;
  importJobId: string | undefined;
  publicationId: string | undefined;
  generationRunId: string | undefined;
  answer: ProductAnswer | undefined;
  evidence: ArtifactDocument | undefined;
  sources: SourceSummary[];
  selectedSource: SourceDetail | undefined;
  sourceLoading: boolean;
  status: PreviewStatus;
  statusMessage: string | undefined;
  error: string | undefined;
}

interface ArtifactDocument {
  source: { displayName: string };
  sourceVersion: { id: string; createdAt: string };
  parsedArtifact: { id: string };
  text: string;
  highlight: null | { evidenceId: string; exactQuote: string; startByte: number; endByte: number };
}

interface SourceSummary {
  id: string;
  displayName: string;
  kind: string;
  versionCount: number;
  latestVersionId: string | null;
}

interface SourceDetail extends SourceSummary {
  versions: SourceVersionSummary[];
}

interface SourceVersionSummary {
  id: string;
  createdAt: string;
  byteLength: number;
  parsedArtifacts: { id: string; parserVersion: string }[];
}

const states = new Map<string, ProductState>();

export function defineKnowledgeProductPreview(): void {
  if (!customElements.get(knowledgeProductPreviewTagName)) {
    customElements.define(knowledgeProductPreviewTagName, KnowledgeProductPreview);
  }
}

export function knowledgePreviewStateKey(context: Pick<WorkspacePanelContext, "machine" | "workspace">): string {
  return `${context.machine.id}\u0000${context.workspace.projectId}\u0000${context.workspace.id}`;
}

export class KnowledgeProductPreview extends LitElement {
  private contextValue: WorkspacePanelContext | undefined;
  private contextKey: string | undefined;
  private state: ProductState = emptyState();
  private filePickerOpen = false;
  private filePickerRootEntries: FileTreeEntry[] = [];
  private readonly filePickerExpandedDirectories = new Map<string, FileTreeEntry[]>();
  private filePickerLoadingPath: string | undefined;
  private filePickerError: string | undefined;
  private filePickerRequest: { path: string; controller: AbortController } | undefined;

  get context(): WorkspacePanelContext | undefined {
    return this.contextValue;
  }

  set context(value: WorkspacePanelContext | undefined) {
    const nextKey = value === undefined ? undefined : knowledgePreviewStateKey(value);
    this.contextValue = value;
    if (nextKey !== this.contextKey) {
      this.resetFilePicker();
      this.contextKey = nextKey;
      this.state = nextKey === undefined ? emptyState() : stateForKey(nextKey);
    }
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.resetFilePicker();
    super.disconnectedCallback();
  }

  protected override updated(): void {
    this.showFilePickerDialog();
  }

  protected override render(): TemplateResult {
    const context = this.contextValue;
    if (context === undefined) {
      return html`<section class="empty" role="status">Select a workspace to ask against Knowledge.</section>`;
    }

    const state = this.state;
    return html`
      <section class="preview" aria-labelledby="knowledge-preview-title">
        <header class="hero">
          <div>
            <p class="eyebrow">Product Preview</p>
            <h2 id="knowledge-preview-title">Grounded Ask</h2>
            <p class="muted">Import a Markdown or TXT file, publish a fixed source snapshot, and ask with auditable citations.</p>
          </div>
          <span class="workspace-chip" title="Host-authoritative workspace">${context.workspace.label}</span>
        </header>

        <ol class="steps" aria-label="Grounded Ask progress">
          ${step("1", "Import", state.sourceId !== undefined)}
          ${step("2", "Publish", state.publicationId !== undefined)}
          ${step("3", "Ask", state.answer !== undefined)}
        </ol>

        ${this.renderSourceHistory(context)}
        ${state.error === undefined ? nothing : html`
          <div class="error" role="alert">
            <strong>Knowledge request failed</strong>
            <p>${state.error}</p>
            <button type="button" data-retry @click=${() => { void this.retry(context); }}>Try again</button>
          </div>
        `}
        ${state.statusMessage === undefined ? nothing : html`
          <p class="status ${state.status}" role="status" aria-live="polite">${state.statusMessage}</p>
        `}

        ${this.renderImport(context)}
        ${this.filePickerOpen ? this.renderFilePicker(context) : nothing}
        ${this.renderPublish(context)}
        ${this.renderAsk(context)}
        ${state.answer === undefined ? html`
          <section class="card answer-card empty-answer" aria-live="polite">
            <h3>Your answer will appear here</h3>
            <p class="muted">Citations will link to the exact historical Evidence used for this answer.</p>
          </section>
        ` : this.renderAnswer(context, state.answer)}
        ${state.evidence === undefined ? nothing : this.renderEvidence(state.evidence)}
      </section>
    `;
  }

  private renderSourceHistory(context: WorkspacePanelContext): TemplateResult {
    const state = this.state;
    return html`
      <section class="card source-history" aria-labelledby="source-history-title">
        <div class="card-heading">
          <div><h3 id="source-history-title">Source history</h3></div>
          <button class="secondary" type="button" data-sources-refresh
            ?disabled=${state.sourceLoading}
            @click=${() => { void this.loadSources(context); }}>
            ${state.sourceLoading ? "Loading…" : "Refresh sources"}
          </button>
        </div>
        ${state.sources.length === 0 ? html`
          <p class="empty-inline">No imported Sources are loaded yet. Refresh after an import to browse immutable versions.</p>
        ` : html`
          <div class="source-list">
            ${state.sources.map((source) => html`
              <button class="source-row" type="button" data-source-id=${source.id}
                aria-pressed=${String(state.selectedSource?.id === source.id)}
                @click=${() => { void this.loadSource(context, source.id); }}>
                <span>${source.displayName}</span>
                <small>${source.kind} · ${source.versionCount} version${source.versionCount === 1 ? "" : "s"}</small>
              </button>
            `)}
          </div>
        `}
        ${state.selectedSource === undefined ? nothing : html`
          <div class="version-list">
            <strong>${state.selectedSource.displayName} versions</strong>
            ${state.selectedSource.versions.length === 0 ? html`
              <p class="empty-inline">No ParsedArtifacts captured for this Source yet.</p>
            ` : state.selectedSource.versions.map((version) => html`
              <div class="version-row">
                <div>
                  <code>${version.id}</code>
                  <small>${version.createdAt} · ${version.byteLength} B${version.id === state.selectedSource?.latestVersionId ? " · latest" : " · historical"}</small>
                </div>
                ${version.parsedArtifacts.map((artifact) => html`
                  <button class="secondary" type="button" data-artifact-id=${artifact.id}
                    @click=${() => { void this.openHistoricalArtifact(context, artifact.id); }}>
                    Open artifact · ${artifact.parserVersion}
                  </button>
                `)}
              </div>
            `)}
          </div>
        `}
      </section>
    `;
  }

  private renderImport(context: WorkspacePanelContext): TemplateResult {
    const state = this.state;
    return html`
      <section class="card" aria-labelledby="import-title">
        <div class="card-heading">
          <div><span class="step-number">1</span><h3 id="import-title">Import source</h3></div>
          <small>Markdown / TXT</small>
        </div>
        <p class="muted">Use a workspace-relative path. The source is captured immutably before publishing.</p>
        <div class="form-row">
          <label>Source file
            <button class="path-picker-trigger" type="button" data-file-picker-trigger aria-haspopup="dialog"
              @click=${(event: Event) => { this.openFilePicker(context, event); }}>
              <span>${state.importPath.length === 0 ? "Choose a Markdown or TXT file" : state.importPath}</span>
              <strong>${state.importPath.length === 0 ? "Browse…" : "Change…"}</strong>
            </button>
          </label>
          <label>Display name <span class="optional">(from filename; editable)</span>
            <input data-display-name type="text" .value=${state.displayName} placeholder="handbook.md"
              @input=${this.onDisplayNameInput}>
          </label>
          <button class="primary" type="button" data-import
            ?disabled=${state.status === "loading" || state.importPath.length === 0}
            @click=${() => { void this.importSource(context); }}>
            ${state.status === "loading" ? "Importing…" : "Import"}
          </button>
        </div>
        ${state.importJobId === undefined ? nothing : html`
          <p class="metadata">Import job <code>${state.importJobId}</code>${state.sourceVersionId === undefined
            ? " is still being prepared."
            : html` · SourceVersion <code>${state.sourceVersionId}</code>`}</p>
        `}
        ${state.importJobId !== undefined && state.sourceVersionId === undefined ? html`
          <button class="secondary" type="button" data-import-status ?disabled=${state.status === "loading"}
            @click=${() => { void this.refreshImportStatus(context); }}>Check import status</button>
        ` : nothing}
      </section>
    `;
  }

  private renderPublish(context: WorkspacePanelContext): TemplateResult {
    const state = this.state;
    return html`
      <section class="card" aria-labelledby="publish-title">
        <div class="card-heading">
          <div><span class="step-number">2</span><h3 id="publish-title">Publish snapshot</h3></div>
          ${state.publicationId === undefined ? nothing : html`<small>published</small>`}
        </div>
        <p class="muted">Publishing freezes the selected SourceVersion and retrieval index for each Ask.</p>
        <button class="secondary" type="button" data-publish
          ?disabled=${state.sourceId === undefined || state.sourceVersionId === undefined || state.status === "loading"}
          @click=${() => { void this.publishSource(context); }}>
          ${state.publicationId === undefined ? "Publish selected source" : "Publish again"}
        </button>
        ${state.publicationId === undefined && state.sourceId === undefined ? html`
          <p class="empty-inline">Import a Markdown or TXT file to choose a source.</p>
        ` : nothing}
        ${state.publicationId === undefined && state.sourceId !== undefined ? html`
          <p class="metadata">Ready to publish Source <code>${state.sourceId}</code>.</p>
        ` : nothing}
      </section>
    `;
  }

  private renderAsk(context: WorkspacePanelContext): TemplateResult {
    const state = this.state;
    return html`
      <section class="card" aria-labelledby="ask-title">
        <div class="card-heading">
          <div><span class="step-number">3</span><h3 id="ask-title">Ask your knowledge</h3></div>
          ${state.generationRunId === undefined ? nothing : html`<small>run <code>${state.generationRunId}</code></small>`}
        </div>
        <label>Question
          <textarea data-question rows="3" placeholder="What does the handbook say about deployment?"
            .value=${state.question} @input=${this.onQuestionInput}></textarea>
        </label>
        <p class="muted">The top matching excerpts from this frozen publication are sent to the server-configured model provider.</p>
        <button class="primary" type="button" data-ask
          ?disabled=${state.publicationId === undefined || state.status === "loading"}
          @click=${() => { void this.ask(context, state.question); }}>
          ${state.status === "loading" && state.publicationId !== undefined ? "Asking…" : "Ask"}
        </button>
        ${state.answer === undefined && state.publicationId !== undefined ? html`
          <p class="metadata">This Ask uses only the published snapshot above.</p>
        ` : nothing}
      </section>
    `;
  }

  private renderFilePicker(context: WorkspacePanelContext): TemplateResult {
    const entries = supportedPickerEntries(this.filePickerRootEntries);
    const rootLoading = this.filePickerLoadingPath === "";
    return html`
      <dialog class="file-picker-dialog" data-file-picker aria-labelledby="knowledge-file-picker-title"
        @cancel=${this.onFilePickerCancel} @click=${this.onFilePickerBackdropClick}>
        <header class="file-picker-header">
          <div><p class="eyebrow">Workspace files</p><h3 id="knowledge-file-picker-title">Choose a source to import</h3></div>
          <button class="file-picker-close" type="button" data-file-picker-close aria-label="Close workspace file picker"
            @click=${() => { this.closeFilePicker(); }}>×</button>
        </header>
        <p class="muted">Select a Markdown or TXT file from ${context.workspace.label}.</p>
        ${this.filePickerError === undefined ? nothing : html`<p class="file-picker-error" role="alert">${this.filePickerError}</p>`}
        <div class="file-picker-tree" role="tree" aria-busy=${String(rootLoading)}>
          ${rootLoading ? html`<p class="empty-inline">Loading workspace files…</p>` : entries.length === 0 ? html`
            <p class="empty-inline">No Markdown or TXT files are available at this level.</p>
          ` : this.renderFilePickerEntries(context, entries, 0)}
        </div>
        <footer class="file-picker-footer">
          <span>Supported: .md, .markdown, .txt</span>
          <button type="button" data-file-picker-close @click=${() => { this.closeFilePicker(); }}>Cancel</button>
        </footer>
      </dialog>
    `;
  }

  private renderFilePickerEntries(
    context: WorkspacePanelContext,
    entries: readonly FileTreeEntry[],
    depth: number,
  ): TemplateResult[] {
    return supportedPickerEntries(entries).map((entry) => {
      const indent = `--picker-indent:${String(9 + depth * 18)}px`;
      if (entry.type === "directory") {
        const children = this.filePickerExpandedDirectories.get(entry.path);
        const expanded = children !== undefined;
        const loading = this.filePickerLoadingPath === entry.path;
        return html`
          <div role="treeitem" aria-expanded=${String(expanded)}>
            <button class="file-picker-row directory" type="button" data-file-picker-directory=${entry.path}
              style=${indent} @click=${() => { this.toggleFilePickerDirectory(context, entry.path); }}>
              <span class="file-picker-chevron">${loading ? "…" : expanded ? "▾" : "▸"}</span>
              <span>${entry.name}</span>
            </button>
            ${expanded ? html`<div role="group">${this.renderFilePickerEntries(context, children, depth + 1)}</div>` : nothing}
          </div>
        `;
      }
      return html`
        <button class="file-picker-row file" type="button" role="treeitem" data-file-picker-file=${entry.path}
          style=${indent} @click=${() => { this.selectFilePickerEntry(entry.path); }}>
          <span class="file-picker-chevron">·</span>
          <span>${entry.name}</span>
          <small>${entry.size === undefined ? "" : `${String(entry.size)} B`}</small>
        </button>
      `;
    });
  }

  private readonly onDisplayNameInput = (event: Event): void => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    this.state.displayName = input.value;
    this.persistState();
  };

  private readonly onQuestionInput = (event: Event): void => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLTextAreaElement)) return;
    this.state.question = input.value;
    this.persistState();
  };

  private readonly onFilePickerCancel = (event: Event): void => {
    event.preventDefault();
    this.closeFilePicker();
  };

  private readonly onFilePickerBackdropClick = (event: Event): void => {
    if (event.target === event.currentTarget) this.closeFilePicker();
  };

  private openFilePicker(context: WorkspacePanelContext, event: Event): void {
    event.preventDefault();
    this.resetFilePicker();
    this.filePickerOpen = true;
    this.requestUpdate();
    void this.loadFilePickerDirectory(context, "");
  }

  private toggleFilePickerDirectory(context: WorkspacePanelContext, path: string): void {
    if (path.length === 0 || this.filePickerLoadingPath !== undefined) return;
    if (this.filePickerExpandedDirectories.has(path)) {
      this.filePickerExpandedDirectories.delete(path);
      this.requestUpdate();
      return;
    }
    void this.loadFilePickerDirectory(context, path);
  }

  private async loadFilePickerDirectory(context: WorkspacePanelContext, path: string): Promise<void> {
    this.filePickerRequest?.controller.abort();
    const controller = new AbortController();
    const pendingRequest = { path, controller };
    this.filePickerRequest = pendingRequest;
    this.filePickerLoadingPath = path;
    this.filePickerError = undefined;
    this.requestUpdate();
    try {
      const files = context.files;
      const response = files.capabilityVersion === 1
        ? await files.listFiles(path, { signal: controller.signal })
        : await files.listFiles(path);
      if (!this.isCurrentFilePickerRequest(context, pendingRequest)) return;
      if (path.length === 0) this.filePickerRootEntries = response.entries;
      else this.filePickerExpandedDirectories.set(path, response.entries);
    } catch (error) {
      if (!this.isCurrentFilePickerRequest(context, pendingRequest) || isAbortError(error)) return;
      this.filePickerError = errorMessage(error);
    } finally {
      if (this.isCurrentFilePickerRequest(context, pendingRequest)) {
        this.filePickerRequest = undefined;
        this.filePickerLoadingPath = undefined;
        this.requestUpdate();
      }
    }
  }

  private isCurrentFilePickerRequest(
    context: WorkspacePanelContext,
    pendingRequest: { path: string; controller: AbortController },
  ): boolean {
    return this.filePickerOpen
      && this.filePickerRequest === pendingRequest
      && this.contextKey === knowledgePreviewStateKey(context);
  }

  private selectFilePickerEntry(path: string): void {
    if (!isSupportedImportPath(path)) return;
    this.state.importPath = path;
    this.state.displayName = workspaceFileName(path);
    this.state.status = "idle";
    this.state.statusMessage = undefined;
    this.state.error = undefined;
    this.resetFilePicker();
    this.persistAndUpdate();
    this.focusFilePickerTriggerAfterUpdate();
  }

  private closeFilePicker(): void {
    this.resetFilePicker();
    this.requestUpdate();
    this.focusFilePickerTriggerAfterUpdate();
  }

  private focusFilePickerTriggerAfterUpdate(): void {
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<HTMLButtonElement>("[data-file-picker-trigger]")?.focus();
    });
  }

  private resetFilePicker(): void {
    this.filePickerRequest?.controller.abort();
    this.filePickerRequest = undefined;
    this.filePickerOpen = false;
    this.filePickerRootEntries = [];
    this.filePickerExpandedDirectories.clear();
    this.filePickerLoadingPath = undefined;
    this.filePickerError = undefined;
  }

  private showFilePickerDialog(): void {
    if (!this.filePickerOpen) return;
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("[data-file-picker]");
    if (dialog === null || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  private async importSource(context: WorkspacePanelContext): Promise<void> {
    const relativePath = this.state.importPath.trim();
    if (relativePath.length === 0) {
      this.fail("Enter a workspace-relative Markdown or TXT path.");
      return;
    }
    if (!isSupportedImportPath(relativePath)) {
      this.fail("Only Markdown and TXT files can be imported.");
      return;
    }
    this.start("Importing source…");
    try {
      const result = await request(context, KNOWLEDGE_IMPORT_OPERATION, {
        relativePath,
        idempotencyKey: `preview:${relativePath}:${globalThis.crypto.randomUUID()}`,
        ...(this.state.displayName.trim().length === 0 ? {} : { displayName: this.state.displayName.trim() }),
        ...(this.state.sourceId === undefined ? {} : { sourceId: this.state.sourceId }),
      });
      const record = asRecord(result, "Import response");
      const job = record["job"] === undefined ? record : asRecord(record["job"], "Import job");
      const payload = isRecord(job["payload"]) ? job["payload"] : {};
      const importResult = isRecord(job["result"]) ? job["result"] : {};
      this.state.sourceId = optionalString(record, "sourceId") ?? optionalString(job, "sourceId") ?? optionalString(payload, "sourceId") ?? optionalString(importResult, "sourceId");
      this.state.sourceVersionId = optionalString(record, "sourceVersionId") ?? optionalString(job, "sourceVersionId") ?? optionalString(importResult, "sourceVersionId");
      this.state.importJobId = optionalString(record, "jobId") ?? optionalString(job, "jobId") ?? optionalString(job, "id");
      if (this.state.sourceId === undefined) throw new Error("Import response did not identify a Source");
      this.state.publicationId = undefined;
      this.state.answer = undefined;
      this.success(this.state.sourceVersionId === undefined ? "Source imported. Publish it when the import is ready." : "Source imported and ready to publish.");
    } catch (error) {
      this.fail(errorMessage(error));
    }
  }

  private async publishSource(context: WorkspacePanelContext): Promise<void> {
    const sourceId = this.state.sourceId;
    const sourceVersionId = this.state.sourceVersionId;
    if (sourceId === undefined || sourceVersionId === undefined) {
      this.fail("Import a source before publishing.");
      return;
    }
    this.start("Publishing a frozen Knowledge snapshot…");
    try {
      const result = await request(context, KNOWLEDGE_PUBLISH_OPERATION, {
        sourceIds: [sourceId],
        sourceVersionIds: [sourceVersionId],
      });
      const record = asRecord(result, "Publish response");
      const publication = record["publication"] === undefined ? record : asRecord(record["publication"], "Publication");
      this.state.publicationId = optionalString(record, "publicationId") ?? optionalString(publication, "publicationId") ?? optionalString(publication, "id");
      if (this.state.publicationId === undefined) throw new Error("Publish response did not identify a publication");
      this.state.answer = undefined;
      this.success(`Published snapshot ${this.state.publicationId}. It is ready for a grounded Ask.`);
    } catch (error) {
      this.fail(errorMessage(error));
    }
  }

  private async refreshImportStatus(context: WorkspacePanelContext): Promise<void> {
    const jobId = this.state.importJobId;
    if (jobId === undefined) return;
    this.start("Checking import status…");
    try {
      const result = await request(context, KNOWLEDGE_IMPORT_STATUS_OPERATION, { jobId });
      const record = asRecord(result, "Import status response");
      const job = record["job"] === undefined ? record : asRecord(record["job"], "Import job");
      const payload = isRecord(job["payload"]) ? job["payload"] : {};
      const importResult = isRecord(job["result"]) ? job["result"] : {};
      this.state.sourceId = this.state.sourceId ?? optionalString(payload, "sourceId") ?? optionalString(importResult, "sourceId");
      this.state.sourceVersionId = optionalString(importResult, "sourceVersionId") ?? optionalString(job, "sourceVersionId");
      const status = optionalString(job, "status");
      if (status === "failed" || status === "cancelled") throw new Error(`Import ${status}. Try importing the file again.`);
      this.success(this.state.sourceVersionId === undefined ? "Import is still running. Check again when the job finishes." : "Source import is ready to publish.");
    } catch (error) {
      this.fail(errorMessage(error));
    }
  }

  private async loadSources(context: WorkspacePanelContext): Promise<void> {
    this.state.sourceLoading = true;
    this.persistAndUpdate();
    try {
      const result = await request(context, "knowledge.viewer.sources.list", {});
      const record = asRecord(result, "Sources response");
      const values = record["sources"];
      if (!Array.isArray(values)) throw new Error("Sources response did not contain a source list");
      this.state.sources = values.map(parseSourceSummary);
      this.success(`Loaded ${String(this.state.sources.length)} source${this.state.sources.length === 1 ? "" : "s"}.`);
    } catch (error) {
      this.fail(errorMessage(error));
    } finally {
      this.state.sourceLoading = false;
      this.persistAndUpdate();
    }
  }

  private async loadSource(context: WorkspacePanelContext, sourceId: string): Promise<void> {
    if (sourceId.length === 0) return;
    this.state.sourceLoading = true;
    this.persistAndUpdate();
    try {
      const result = await request(context, "knowledge.viewer.source.get", { sourceId });
      const record = asRecord(result, "Source response");
      this.state.selectedSource = parseSourceDetail(record);
      this.success(`Loaded version history for ${this.state.selectedSource.displayName}.`);
    } catch (error) {
      this.fail(errorMessage(error));
    } finally {
      this.state.sourceLoading = false;
      this.persistAndUpdate();
    }
  }

  private async openHistoricalArtifact(context: WorkspacePanelContext, parsedArtifactId: string): Promise<void> {
    if (parsedArtifactId.length === 0) return;
    this.start("Opening historical ParsedArtifact…");
    try {
      this.state.evidence = parseArtifact(await request(context, KNOWLEDGE_VIEWER_ARTIFACT_OPEN_OPERATION, { parsedArtifactId, maxBytes: 40 * 1024 }));
      this.success(`Opened historical SourceVersion ${this.state.evidence.sourceVersion.id}.`);
    } catch (error) {
      this.fail(errorMessage(error));
    }
  }

  private async ask(context: WorkspacePanelContext, question: string): Promise<void> {
    if (this.state.publicationId === undefined) {
      this.fail("Publish a Knowledge snapshot before asking.");
      return;
    }
    if (question.trim().length === 0) {
      this.fail("Enter a question to ask.");
      return;
    }
    this.start("Retrieving evidence and generating an answer…");
    try {
      const result = await request(context, KNOWLEDGE_ASK_OPERATION, { question: question.trim() });
      this.state.answer = parseAnswer(result);
      this.state.generationRunId = this.state.answer.generationRunId;
      this.success(this.state.answer.citations.length === 0
        ? "Answer ready. No supporting Evidence was returned."
        : "Answer ready. Select a citation to inspect historical Evidence.");
    } catch (error) {
      this.fail(errorMessage(error));
    }
  }

  private async openCitation(context: WorkspacePanelContext, citationId: string): Promise<void> {
    const answerId = this.state.answer?.id;
    const citation = this.state.answer?.citations.find((item) => item.id === citationId);
    if (answerId === undefined || citation === undefined) {
      this.fail("That citation is no longer available.");
      return;
    }
    this.start("Opening historical Evidence…");
    try {
      this.state.evidence = parseArtifact(await request(context, KNOWLEDGE_CITATION_OPEN_OPERATION, {
        answerId,
        citationId: citation.id,
      }));
      this.success(`Opened Evidence ${citation.evidenceId} from SourceVersion ${this.state.evidence.sourceVersion.id}.`);
    } catch (error) {
      this.fail(errorMessage(error));
    }
  }

  private async retry(context: WorkspacePanelContext): Promise<void> {
    if (this.state.sourceId === undefined) return this.importSource(context);
    if (this.state.publicationId === undefined) return this.publishSource(context);
    return this.ask(context, this.state.question);
  }

  private start(message: string): void {
    this.state.status = "loading";
    this.state.statusMessage = message;
    this.state.error = undefined;
    this.persistAndUpdate();
  }

  private success(message: string): void {
    this.state.status = "success";
    this.state.statusMessage = message;
    this.state.error = undefined;
    this.persistAndUpdate();
  }

  private fail(message: string): void {
    this.state.status = "error";
    this.state.statusMessage = undefined;
    this.state.error = message;
    this.persistAndUpdate();
  }

  private persistState(): void {
    if (this.contextKey !== undefined) states.set(this.contextKey, this.state);
  }

  private persistAndUpdate(): void {
    this.persistState();
    this.requestUpdate();
  }

  private renderAnswer(context: WorkspacePanelContext, answer: ProductAnswer): TemplateResult {
    const model = answer.provider === undefined || answer.model === undefined
      ? nothing
      : html` · ${answer.provider}/${answer.model}${answer.modelRevision === undefined ? nothing : html` · ${answer.modelRevision}`}`;
    return html`
      <section class="card answer-card" aria-labelledby="answer-title">
        <div class="card-heading">
          <h3 id="answer-title">Answer</h3>
          ${answer.id === undefined ? nothing : html`<small>saved <code>${answer.id}</code>${model}</small>`}
        </div>
        <p class="answer-text">${answer.text}</p>
        ${answer.citations.length === 0 ? html`
          <p class="muted no-evidence">No citations were returned. Treat this answer as insufficiently supported.</p>
        ` : html`
          <div class="citations" aria-label="Answer citations">
            <strong>Evidence used</strong>
            ${answer.citations.map((citation) => html`
              <button type="button" class="citation" data-citation-id=${citation.id}
                aria-label=${`Open citation ${citation.label}`}
                @click=${() => { void this.openCitation(context, citation.id); }}>
                <span class="citation-label">${citation.label}</span>
                <span>${citation.exactQuote ?? citation.evidenceId}</span>
              </button>
            `)}
          </div>
        `}
      </section>
    `;
  }

  private renderEvidence(document: ArtifactDocument): TemplateResult {
    return html`
      <section class="card evidence-card" aria-labelledby="evidence-title">
        <div class="card-heading">
          <div><span class="step-number">↳</span><h3 id="evidence-title">Historical Evidence</h3></div>
          <small>immutable SourceVersion</small>
        </div>
        <p class="metadata">${document.source.displayName} · SourceVersion <code>${document.sourceVersion.id}</code> · ParsedArtifact <code>${document.parsedArtifact.id}</code></p>
        <pre>${highlightQuote(document.text, document.highlight?.exactQuote)}</pre>
      </section>
    `;
  }

  static override styles = css`
    :host { display:block; min-height:100%; color:var(--pi-text,inherit); }
    .preview { box-sizing:border-box; display:flex; flex-direction:column; gap:12px; padding:18px; min-height:100%; overflow:auto; }
    .hero { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
    .eyebrow { margin:0 0 4px; color:var(--pi-accent,#5b8def); font-size:.72rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    h2,h3,p { margin-top:0; } h2 { margin-bottom:5px; font-size:1.25rem; } h3 { margin:0; font-size:1rem; }
    .muted,.metadata { color:var(--pi-muted, #79808c); font-size:.82rem; line-height:1.45; } .metadata { margin:10px 0 0; }
    .workspace-chip, .steps li small { color:var(--pi-muted,#79808c); font-size:.75rem; }
    .steps { display:flex; gap:8px; margin:0; padding:0; list-style:none; color:var(--pi-muted,#79808c); font-size:.78rem; }
    .steps li { display:flex; align-items:center; gap:5px; } .steps li span,.step-number { display:inline-grid; place-items:center; width:21px; height:21px; border:1px solid var(--pi-border,#444); border-radius:50%; font-size:.7rem; }
    .steps li.complete { color:var(--pi-success,#5fcf91); } .steps li.complete span { border-color:currentColor; }
    .card { border:1px solid var(--pi-border,#444); border-radius:10px; padding:13px; background:var(--pi-surface,transparent); }
    .card-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; } .card-heading > div { display:flex; align-items:center; gap:8px; } .card-heading small { color:var(--pi-muted,#79808c); font-size:.72rem; }
    .form-row { display:grid; grid-template-columns:1.3fr 1fr auto; align-items:end; gap:8px; } label { display:flex; flex-direction:column; gap:5px; font-size:.78rem; } .optional { color:var(--pi-muted,#79808c); font-weight:normal; }
    input,textarea { box-sizing:border-box; width:100%; border:1px solid var(--pi-border,#444); border-radius:6px; padding:8px 9px; background:var(--pi-bg,transparent); color:inherit; font:inherit; } textarea { margin-bottom:8px; resize:vertical; }
    button { border:1px solid var(--pi-border,#555); border-radius:6px; padding:7px 11px; background:var(--pi-surface,transparent); color:inherit; cursor:pointer; font:inherit; } button:hover:not(:disabled) { background:var(--pi-surface-hover,rgba(127,127,127,.14)); } button:focus-visible,input:focus-visible,textarea:focus-visible { outline:2px solid var(--pi-accent,#5b8def); outline-offset:2px; } button:disabled { cursor:not-allowed; opacity:.55; }
    button.primary { border-color:var(--pi-accent-border,var(--pi-accent,#5b8def)); background:var(--pi-accent,#5b8def); color:var(--pi-bg,#101216); } .secondary { margin-top:4px; }
    .path-picker-trigger { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:34px; width:100%; text-align:left; } .path-picker-trigger span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .path-picker-trigger strong { flex:0 0 auto; color:var(--pi-accent,#5b8def); font-size:.75rem; }
    .file-picker-dialog { box-sizing:border-box; width:min(620px,calc(100vw - 32px)); max-height:min(720px,calc(100vh - 48px)); border:1px solid var(--pi-border,#444); border-radius:12px; padding:0; overflow:hidden; background:var(--pi-surface,#161b22); color:var(--pi-text,inherit); box-shadow:0 20px 60px var(--pi-overlay,rgba(0,0,0,.45)); } .file-picker-dialog::backdrop { background:var(--pi-overlay,rgba(0,0,0,.45)); }
    .file-picker-header,.file-picker-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 15px; border-bottom:1px solid var(--pi-border,#444); } .file-picker-header .eyebrow { margin-bottom:3px; } .file-picker-close { border:0; padding:4px 8px; font-size:1.25rem; line-height:1; } .file-picker-dialog > .muted,.file-picker-dialog > .file-picker-error { margin:0; padding:10px 15px; border-bottom:1px solid var(--pi-border-muted,#333); }
    .file-picker-error { color:var(--pi-danger,#d96c6c); font-size:.8rem; } .file-picker-tree { min-height:180px; max-height:min(480px,55vh); overflow:auto; padding:8px; } .file-picker-tree > .empty-inline { margin:12px; }
    .file-picker-row { display:grid; grid-template-columns:18px minmax(0,1fr) auto; align-items:center; gap:7px; width:100%; padding:7px 9px 7px var(--picker-indent); border-color:transparent; text-align:left; } .file-picker-row span:nth-child(2) { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .file-picker-row small { color:var(--pi-muted,#79808c); font-size:.7rem; } .file-picker-row.file:hover { border-color:var(--pi-accent-border,var(--pi-accent,#5b8def)); } .file-picker-chevron { color:var(--pi-muted,#79808c); }
    .file-picker-footer { border-top:1px solid var(--pi-border,#444); border-bottom:0; color:var(--pi-muted,#79808c); font-size:.72rem; }
    .status { margin:0; padding:8px 10px; border-radius:7px; background:var(--pi-surface-hover,rgba(127,127,127,.1)); font-size:.8rem; } .status.error,.error { border:1px solid var(--pi-danger,#d96c6c); color:var(--pi-danger,#d96c6c); } .error { padding:10px; border-radius:7px; } .error p { margin:5px 0 8px; font-size:.8rem; }
    .empty-inline,.empty-answer,.empty { color:var(--pi-muted,#79808c); } .empty-inline { margin:10px 0 0; font-size:.8rem; } .empty { padding:22px; }
    .answer-text { white-space:pre-wrap; line-height:1.55; } .no-evidence { margin-bottom:0; }
    .citations { display:flex; flex-direction:column; gap:7px; margin-top:12px; } .citation { display:flex; align-items:flex-start; gap:10px; width:100%; text-align:left; } .citation-label { flex:0 0 auto; color:var(--pi-accent,#5b8def); font-weight:700; }
    .source-list,.version-list { display:flex; flex-direction:column; gap:6px; } .source-row { display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; text-align:left; } .source-row[aria-pressed="true"] { border-color:var(--pi-accent-border,var(--pi-accent,#5b8def)); background:var(--pi-surface-hover,rgba(127,127,127,.14)); } .source-row small,.version-row small { color:var(--pi-muted,#79808c); font-size:.72rem; } .version-list { margin-top:10px; padding-top:10px; border-top:1px solid var(--pi-border,#444); } .version-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 0; border-bottom:1px solid var(--pi-border-muted,#333); } .version-row > div { display:flex; flex-direction:column; gap:3px; min-width:0; }
    .evidence-card pre { max-height:360px; overflow:auto; margin:10px 0 0; padding:10px; border-radius:6px; background:var(--pi-bg,#101216); white-space:pre-wrap; overflow-wrap:anywhere; font: .78rem/1.55 ui-monospace,SFMono-Regular,monospace; } mark { padding:1px 2px; border-radius:2px; background:var(--pi-warning-surface,rgba(224,181,73,.35)); color:inherit; }
    code { overflow-wrap:anywhere; font-size:.75em; }
    @media (max-width: 700px) { .form-row { grid-template-columns:1fr; } .hero { flex-direction:column; } .workspace-chip { align-self:flex-start; } }
  `;
}

function emptyState(): ProductState {
  return {
    importPath: "",
    displayName: "",
    question: "",
    sourceId: undefined,
    sourceVersionId: undefined,
    importJobId: undefined,
    publicationId: undefined,
    generationRunId: undefined,
    answer: undefined,
    evidence: undefined,
    sources: [],
    selectedSource: undefined,
    sourceLoading: false,
    status: "idle",
    statusMessage: undefined,
    error: undefined,
  };
}

function stateForKey(key: string): ProductState {
  const existing = states.get(key);
  if (existing !== undefined) return existing;
  const created = emptyState();
  states.set(key, created);
  return created;
}

export function isSupportedImportPath(path: string): boolean {
  return /\.(?:md|markdown|txt)$/iu.test(path);
}

export function workspaceFileName(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function supportedPickerEntries(entries: readonly FileTreeEntry[]): FileTreeEntry[] {
  return entries.filter((entry) => entry.type === "directory" || (entry.type === "file" && isSupportedImportPath(entry.path)));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function step(number: string, label: string, complete: boolean): TemplateResult {
  return html`<li class=${complete ? "complete" : ""}><span>${complete ? "✓" : number}</span>${label}</li>`;
}

async function request(context: WorkspacePanelContext, operation: string, input: Record<string, JsonValue>): Promise<unknown> {
  const backend = context.pairedBackend;
  if (backend?.requestVersion !== 1) throw new Error("Paired backend request capability is unavailable");
  return backend.request(operation, input);
}

function parseAnswer(value: unknown): ProductAnswer {
  const record = asRecord(value, "Answer response");
  const answerValue = record["answer"] === undefined ? record : asRecord(record["answer"], "Answer");
  const text = optionalString(answerValue, "text") ?? optionalString(answerValue, "answer");
  if (text === undefined) throw new Error("Answer response did not contain answer text");
  const rawCitations = answerValue["citations"] ?? answerValue["citationRefs"] ?? [];
  if (!Array.isArray(rawCitations)) throw new Error("Answer citations must be an array");
  const deliveredEvidence = isRecord(record["deliveredEvidence"]) ? record["deliveredEvidence"] : {};
  const run = isRecord(record["run"]) ? record["run"] : {};
  const evidenceById = new Map<string, Record<string, unknown>>();
  if (Array.isArray(deliveredEvidence["evidence"])) {
    for (const item of deliveredEvidence["evidence"]) {
      if (!isRecord(item)) continue;
      const evidenceId = optionalString(item, "id");
      if (evidenceId !== undefined) evidenceById.set(evidenceId, item);
    }
  }
  return {
    id: optionalString(answerValue, "id"),
    text,
    generationRunId: optionalString(record, "generationRunId") ?? optionalString(answerValue, "generationRunId"),
    publicationId: optionalString(record, "publicationId"),
    provider: optionalString(run, "provider"),
    model: optionalString(run, "model"),
    modelRevision: optionalString(run, "modelRevision"),
    citations: rawCitations.map((item, index) => parseCitation(item, index, evidenceById)),
  };
}

function parseCitation(value: unknown, index: number, evidenceById: ReadonlyMap<string, Record<string, unknown>>): ProductCitation {
  const record = asRecord(value, "Citation");
  const evidenceId = optionalString(record, "evidenceId");
  const evidence = evidenceId === undefined ? undefined : evidenceById.get(evidenceId);
  const parsedArtifactId = optionalString(record, "parsedArtifactId") ?? (evidence === undefined ? undefined : optionalString(evidence, "parsedArtifactId"));
  if (evidenceId === undefined || parsedArtifactId === undefined) throw new Error("Citation is missing historical Evidence identity");
  return {
    id: optionalString(record, "id") ?? evidenceId,
    label: optionalString(record, "label") ?? `[${String(index + 1)}]`,
    evidenceId,
    parsedArtifactId,
    sourceVersionId: optionalString(record, "sourceVersionId"),
    exactQuote: optionalString(record, "exactQuote") ?? (evidence === undefined ? undefined : optionalString(evidence, "exactQuote")),
  };
}

function parseArtifact(value: unknown): ArtifactDocument {
  const root = asRecord(value, "Evidence response");
  const document = asRecord(root["document"] ?? root, "Evidence document");
  const source = asRecord(document["source"], "Evidence source");
  const sourceVersion = asRecord(document["sourceVersion"], "Evidence SourceVersion");
  const artifact = asRecord(document["parsedArtifact"], "Evidence ParsedArtifact");
  const text = document["text"];
  if (typeof text !== "string") throw new Error("Evidence document text is invalid");
  const rawHighlight = document["highlight"];
  const highlight = rawHighlight === null || rawHighlight === undefined ? null : (() => {
    const item = asRecord(rawHighlight, "Evidence highlight");
    const exactQuote = optionalString(item, "exactQuote");
    const evidenceId = optionalString(item, "evidenceId");
    const startByte = item["startByte"];
    const endByte = item["endByte"];
    if (exactQuote === undefined || evidenceId === undefined || typeof startByte !== "number" || typeof endByte !== "number") {
      throw new Error("Evidence highlight is invalid");
    }
    return { evidenceId, exactQuote, startByte, endByte };
  })();
  return {
    source: { displayName: requiredString(source, "displayName") },
    sourceVersion: { id: requiredString(sourceVersion, "id"), createdAt: requiredString(sourceVersion, "createdAt") },
    parsedArtifact: { id: requiredString(artifact, "id") },
    text,
    highlight,
  };
}

function parseSourceSummary(value: unknown): SourceSummary {
  const record = asRecord(value, "Source summary");
  const versionCount = record["versionCount"];
  if (typeof versionCount !== "number" || !Number.isSafeInteger(versionCount) || versionCount < 0) throw new Error("Source version count is invalid");
  const latestVersionId = record["latestVersionId"];
  if (latestVersionId !== null && typeof latestVersionId !== "string") throw new Error("Source latest version id is invalid");
  return {
    id: requiredString(record, "id"),
    displayName: requiredString(record, "displayName"),
    kind: requiredString(record, "kind"),
    versionCount,
    latestVersionId,
  };
}

function parseSourceDetail(value: Record<string, unknown>): SourceDetail {
  const source = asRecord(value["source"], "Source detail");
  const rawVersions = source["versions"];
  if (!Array.isArray(rawVersions)) throw new Error("Source versions are invalid");
  const summary: SourceSummary = {
    id: requiredString(source, "id"),
    displayName: requiredString(source, "displayName"),
    kind: requiredString(source, "kind"),
    versionCount: rawVersions.length,
    latestVersionId: rawVersions.length === 0 ? null : requiredString(asRecord(rawVersions[0], "SourceVersion"), "id"),
  };
  return {
    ...summary,
    versions: rawVersions.map((rawVersion) => {
      const version = asRecord(rawVersion, "SourceVersion");
      const rawArtifacts = version["parsedArtifacts"];
      if (!Array.isArray(rawArtifacts)) throw new Error("ParsedArtifacts are invalid");
      const byteLength = version["byteLength"];
      if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 0) throw new Error("SourceVersion byte length is invalid");
      return {
        id: requiredString(version, "id"),
        createdAt: requiredString(version, "createdAt"),
        byteLength,
        parsedArtifacts: rawArtifacts.map((rawArtifact) => {
          const artifact = asRecord(rawArtifact, "ParsedArtifact");
          return { id: requiredString(artifact, "id"), parserVersion: requiredString(artifact, "parserVersion") };
        }),
      };
    }),
  };
}

function highlightQuote(text: string, quote: string | undefined): TemplateResult | string {
  if (quote === undefined) return text;
  const index = text.indexOf(quote);
  if (index < 0) return text;
  return html`${text.slice(0, index)}<mark>${quote}</mark>${text.slice(index + quote.length)}`;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = optionalString(record, key);
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= 1_024 ? message : `${message.slice(0, 1_021)}...`;
}
