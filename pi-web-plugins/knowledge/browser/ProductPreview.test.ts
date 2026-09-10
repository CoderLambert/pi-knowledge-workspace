// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileTreeResponse, JsonValue, Workspace, WorkspaceFilesCapabilityV1, WorkspacePanelContext } from "@jmfederico/pi-web/plugin-api";
import {
  KNOWLEDGE_ASK_OPERATION,
  KNOWLEDGE_CITATION_OPEN_OPERATION,
  KNOWLEDGE_IMPORT_OPERATION,
  KNOWLEDGE_PUBLISH_OPERATION,
  KnowledgeProductPreview,
  defineKnowledgeProductPreview,
  isSupportedImportPath,
  workspaceFileName,
} from "./ProductPreview.js";

defineKnowledgeProductPreview();

afterEach(() => {
  document.body.replaceChildren();
});

describe("Knowledge product preview", () => {
  it("walks Import → Publish → Ask → citation to historical Evidence", async () => {
    const request = vi.fn((operation: string, _input: JsonValue): Promise<JsonValue> => {
      void _input;
      let response: JsonValue;
      if (operation === KNOWLEDGE_IMPORT_OPERATION) response = { job: { id: "job-1", status: "succeeded", payload: { sourceId: "source-1" }, result: { sourceId: "source-1", sourceVersionId: "version-a" } } };
      else if (operation === KNOWLEDGE_PUBLISH_OPERATION) response = { publication: { id: "publication-1" } };
      else if (operation === KNOWLEDGE_ASK_OPERATION) response = {
        answer: {
          id: "answer-1",
          text: "Deploy from the release branch.",
          citations: [{ id: "citation-1", label: "[1]", evidenceId: "evidence-1" }],
        },
        generationRunId: "run-1",
        deliveredEvidence: { evidence: [{ id: "evidence-1", parsedArtifactId: "artifact-a", exactQuote: "release branch" }] },
      };
      else if (operation === KNOWLEDGE_CITATION_OPEN_OPERATION) response = {
        document: {
          source: { displayName: "handbook.md" },
          sourceVersion: { id: "version-a", createdAt: "2026-09-10T00:00:00.000Z" },
          parsedArtifact: { id: "artifact-a" },
          text: "Deploy from the release branch.",
          highlight: { evidenceId: "evidence-1", exactQuote: "release branch", startByte: 15, endByte: 29 },
        },
      };
      else throw new Error(`unexpected operation ${operation}`);
      return Promise.resolve(response);
    });
    const element = await mount(context(request, "workspace-1", workspaceFiles(() => Promise.resolve(treeResponse("", [
      { name: "handbook.md", path: "docs/handbook.md", type: "file" },
    ])))));

    click(element, "[data-file-picker-trigger]");
    await vi.waitFor(() => { expect(element.shadowRoot?.textContent).toContain("handbook.md"); });
    click(element, "[data-file-picker-file='docs/handbook.md']");
    await element.updateComplete;
    click(element, "[data-import]");
    await settle(element);
    click(element, "[data-publish]");
    await settle(element);
    const question = element.shadowRoot?.querySelector<HTMLTextAreaElement>("[data-question]");
    if (question === null || question === undefined) throw new Error("question input is missing");
    question.value = "How should we deploy?";
    question.dispatchEvent(new Event("input", { bubbles: true }));
    click(element, "[data-ask]");
    await settle(element);

    expect(element.shadowRoot?.textContent).toContain("Deploy from the release branch.");
    click(element, "[data-citation-id='citation-1']");
    await settle(element);

    expect(request.mock.calls.map(([operation]) => operation)).toEqual([
      KNOWLEDGE_IMPORT_OPERATION,
      KNOWLEDGE_PUBLISH_OPERATION,
      KNOWLEDGE_ASK_OPERATION,
      KNOWLEDGE_CITATION_OPEN_OPERATION,
    ]);
    expect(request.mock.calls[3]?.[1]).toEqual({ answerId: "answer-1", citationId: "citation-1" });
    expect(request.mock.calls[2]?.[1]).toEqual({
      question: "How should we deploy?",
    });
    expect(element.shadowRoot?.textContent).toContain("Historical Evidence");
    expect(element.shadowRoot?.textContent).toContain("version-a");
  });

  it("renders an accessible loading state and an explicit backend error", async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    const pending = new Promise<JsonValue>((_resolve, reject) => { rejectRequest = reject; });
    const request = vi.fn(() => pending);
    const element = await mount(context(request, "loading-workspace", workspaceFiles(() => Promise.resolve(treeResponse("", [
      { name: "readme.txt", path: "notes/readme.txt", type: "file" },
    ])))));
    click(element, "[data-file-picker-trigger]");
    await vi.waitFor(() => { expect(element.shadowRoot?.textContent).toContain("readme.txt"); });
    click(element, "[data-file-picker-file='notes/readme.txt']");
    await element.updateComplete;
    click(element, "[data-import]");
    await settle(element);

    expect(element.shadowRoot?.querySelector("[role='status']")?.textContent).toContain("Importing source");
    expect(element.shadowRoot?.querySelector<HTMLButtonElement>("[data-import]")?.disabled).toBe(true);

    rejectRequest?.(new Error("Knowledge backend is unavailable"));
    await settle(element);
    expect(element.shadowRoot?.querySelector("[role='alert']")?.textContent).toContain("Knowledge backend is unavailable");
  });

  it("keeps empty and validation states actionable", async () => {
    const element = await mount(context(vi.fn(), "empty-workspace"));
    expect(element.shadowRoot?.querySelector<HTMLButtonElement>("[data-import]")?.disabled).toBe(true);
    expect(element.shadowRoot?.textContent).toContain("Your answer will appear here");
  });

  it("chooses an import source from workspace files and derives its display name", async () => {
    const listFiles = vi.fn<WorkspaceFilesCapabilityV1["listFiles"]>((path) => Promise.resolve(path === ""
      ? treeResponse("", [
          { name: "docs", path: "docs", type: "directory" },
          { name: "README.md", path: "README.md", type: "file", size: 120 },
          { name: "package.json", path: "package.json", type: "file", size: 80 },
        ])
      : treeResponse(path, [
          { name: "guide.txt", path: "docs/guide.txt", type: "file", size: 42 },
          { name: "image.png", path: "docs/image.png", type: "file", size: 200 },
        ])));
    const request = vi.fn(() => Promise.resolve({ job: { id: "job-picker", status: "succeeded", payload: { sourceId: "source-picker" }, result: { sourceId: "source-picker", sourceVersionId: "version-picker" } } }));
    const element = await mount(context(request, "picker-workspace", workspaceFiles(listFiles)));

    click(element, "[data-file-picker-trigger]");
    await vi.waitFor(() => { expect(element.shadowRoot?.textContent).toContain("README.md"); });
    expect(element.shadowRoot?.querySelector<HTMLDialogElement>("[data-file-picker]")?.open).toBe(true);
    expect(element.shadowRoot?.textContent).not.toContain("package.json");

    click(element, "[data-file-picker-directory='docs']");
    await vi.waitFor(() => { expect(element.shadowRoot?.textContent).toContain("guide.txt"); });
    expect(element.shadowRoot?.textContent).not.toContain("image.png");
    click(element, "[data-file-picker-file='docs/guide.txt']");
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector("[data-file-picker]")).toBeNull();
    expect(element.shadowRoot?.querySelector<HTMLButtonElement>("[data-file-picker-trigger]")?.textContent).toContain("docs/guide.txt");
    expect(element.shadowRoot?.querySelector<HTMLInputElement>("[data-display-name]")?.value).toBe("guide.txt");
    expect(element.shadowRoot?.querySelector<HTMLButtonElement>("[data-import]")?.disabled).toBe(false);

    click(element, "[data-import]");
    await settle(element);
    expect(request).toHaveBeenCalledWith(KNOWLEDGE_IMPORT_OPERATION, expect.objectContaining({
      relativePath: "docs/guide.txt",
      displayName: "guide.txt",
    }));
    expect(listFiles.mock.calls.map(([path]) => path)).toEqual(["", "docs"]);
    expect(listFiles.mock.calls.every(([, options]) => options?.signal instanceof AbortSignal)).toBe(true);
  });

  it("preserves question value, DOM identity and focus across same-workspace host rerenders", async () => {
    const request = vi.fn(() => Promise.resolve({}));
    const element = await mount(context(request, "focus-workspace"));
    const question = element.shadowRoot?.querySelector<HTMLTextAreaElement>("[data-question]");
    if (question === null || question === undefined) throw new Error("question input is missing");

    question.focus();
    question.value = "部署应该怎么做？";
    question.dispatchEvent(new Event("input", { bubbles: true }));
    expect(element.shadowRoot?.activeElement).toBe(question);

    element.context = context(request, "focus-workspace");
    await element.updateComplete;

    const rerenderedQuestion = element.shadowRoot?.querySelector<HTMLTextAreaElement>("[data-question]");
    expect(rerenderedQuestion).toBe(question);
    expect(rerenderedQuestion?.value).toBe("部署应该怎么做？");
    expect(element.shadowRoot?.activeElement).toBe(question);
  });

  it("normalizes supported source names without weakening the extension allowlist", () => {
    expect(workspaceFileName("docs/reference/handbook.markdown")).toBe("handbook.markdown");
    expect(workspaceFileName("docs\\notes.txt")).toBe("notes.txt");
    expect(isSupportedImportPath("docs/README.MD")).toBe(true);
    expect(isSupportedImportPath("docs/image.png")).toBe(false);
  });
});

async function mount(value: WorkspacePanelContext): Promise<KnowledgeProductPreview> {
  const element = document.createElement("pi-web-knowledge-product-preview");
  if (!(element instanceof KnowledgeProductPreview)) throw new Error("product preview custom element is unavailable");
  document.body.append(element);
  element.context = value;
  await element.updateComplete;
  return element;
}

function click(element: KnowledgeProductPreview, selector: string): void {
  const button = element.shadowRoot?.querySelector<HTMLButtonElement>(selector);
  if (button === null || button === undefined) throw new Error(`button ${selector} is missing`);
  button.click();
}

function context(
  request: (operation: string, input: JsonValue) => Promise<JsonValue>,
  workspaceId = "workspace-1",
  files: WorkspacePanelContext["files"] = unavailableWorkspaceFiles(),
): WorkspacePanelContext {
  const workspace: Workspace = { id: workspaceId, projectId: "project-1", path: "/work/project", label: "main", isMain: true };
  return {
    machine: { id: "local", name: "Local", kind: "local" },
    workspace,
    state: { selectedWorkspace: workspace, workspaceTool: "knowledge:workspace.knowledge", mainView: "knowledge:workspace.knowledge" },
    files,
    pairedBackend: { version: 1, requestVersion: 1, request },
    host: { requestRender: () => undefined },
    prompt: { insertText: () => undefined, getText: () => "", getSelection: () => null },
    terminal: { open: () => undefined, runCommand: () => Promise.reject(new Error("not implemented")) },
  };
}

function unavailableWorkspaceFiles(): WorkspacePanelContext["files"] {
  return {
    readFile: () => Promise.reject(new Error("not implemented")),
    listFiles: () => Promise.reject(new Error("not implemented")),
    writeFile: () => Promise.reject(new Error("not implemented")),
    deleteFile: () => Promise.reject(new Error("not implemented")),
    moveFile: () => Promise.reject(new Error("not implemented")),
  };
}

function workspaceFiles(listFiles: WorkspaceFilesCapabilityV1["listFiles"]): WorkspaceFilesCapabilityV1 {
  return {
    capabilityVersion: 1,
    defaultUploadFolder: "",
    maxInlinePreviewBytes: 1024,
    readFile: () => Promise.reject(new Error("not implemented")),
    listFiles,
    writeFile: () => Promise.reject(new Error("not implemented")),
    deleteFile: () => Promise.reject(new Error("not implemented")),
    moveFile: () => Promise.reject(new Error("not implemented")),
    previewUrl: () => "http://example.test/preview",
    downloadUrl: () => "http://example.test/download",
    uploadFile: () => ({ path: "", completed: Promise.reject(new Error("not implemented")), cancel: () => undefined }),
  };
}

function treeResponse(path: string, entries: FileTreeResponse["entries"]): FileTreeResponse {
  return { path, entries, scannedAt: "2026-09-10T00:00:00.000Z", truncated: false };
}

async function settle(element: KnowledgeProductPreview): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  await element.updateComplete;
}
