// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { JsonValue, Workspace, WorkspacePanelContext } from "@jmfederico/pi-web/plugin-api";
import {
  KNOWLEDGE_ASK_OPERATION,
  KNOWLEDGE_CITATION_OPEN_OPERATION,
  KNOWLEDGE_IMPORT_OPERATION,
  KNOWLEDGE_PUBLISH_OPERATION,
  KnowledgeProductPreview,
  defineKnowledgeProductPreview,
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
    const element = mount(context(request));

    const path = element.shadowRoot?.querySelector<HTMLInputElement>("[data-import-path]");
    if (path === null || path === undefined) throw new Error("import path input is missing");
    path.value = "docs/handbook.md";
    path.dispatchEvent(new Event("input", { bubbles: true }));
    click(element, "[data-import]");
    await settle();
    click(element, "[data-publish]");
    await settle();
    const question = element.shadowRoot?.querySelector<HTMLTextAreaElement>("[data-question]");
    if (question === null || question === undefined) throw new Error("question input is missing");
    question.value = "How should we deploy?";
    question.dispatchEvent(new Event("input", { bubbles: true }));
    click(element, "[data-ask]");
    await settle();

    expect(element.shadowRoot?.textContent).toContain("Deploy from the release branch.");
    click(element, "[data-citation-id='citation-1']");
    await settle();

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
    const element = mount(context(request, "loading-workspace"));
    const path = element.shadowRoot?.querySelector<HTMLInputElement>("[data-import-path]");
    if (path === null || path === undefined) throw new Error("import path input is missing");
    path.value = "notes/readme.txt";
    path.dispatchEvent(new Event("input", { bubbles: true }));
    click(element, "[data-import]");
    await settle();

    expect(element.shadowRoot?.querySelector("[role='status']")?.textContent).toContain("Importing source");
    expect(element.shadowRoot?.querySelector<HTMLButtonElement>("[data-import]")?.disabled).toBe(true);

    rejectRequest?.(new Error("Knowledge backend is unavailable"));
    await settle();
    expect(element.shadowRoot?.querySelector("[role='alert']")?.textContent).toContain("Knowledge backend is unavailable");
  });

  it("keeps empty and validation states actionable", async () => {
    const element = mount(context(vi.fn(), "empty-workspace"));
    click(element, "[data-import]");
    await settle();
    expect(element.shadowRoot?.querySelector("[role='alert']")?.textContent).toContain("Enter a workspace-relative");
    expect(element.shadowRoot?.textContent).toContain("Your answer will appear here");
  });
});

function mount(value: WorkspacePanelContext): KnowledgeProductPreview {
  const element = document.createElement("pi-web-knowledge-product-preview");
  if (!(element instanceof KnowledgeProductPreview)) throw new Error("product preview custom element is unavailable");
  document.body.append(element);
  element.context = value;
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
): WorkspacePanelContext {
  const workspace: Workspace = { id: workspaceId, projectId: "project-1", path: "/work/project", label: "main", isMain: true };
  return {
    machine: { id: "local", name: "Local", kind: "local" },
    workspace,
    state: { selectedWorkspace: workspace, workspaceTool: "knowledge:workspace.knowledge", mainView: "knowledge:workspace.knowledge" },
    files: {
      readFile: () => Promise.reject(new Error("not implemented")),
      listFiles: () => Promise.reject(new Error("not implemented")),
      writeFile: () => Promise.reject(new Error("not implemented")),
      deleteFile: () => Promise.reject(new Error("not implemented")),
      moveFile: () => Promise.reject(new Error("not implemented")),
    },
    pairedBackend: { version: 1, requestVersion: 1, request },
    host: { requestRender: () => undefined },
    prompt: { insertText: () => undefined, getText: () => "", getSelection: () => null },
    terminal: { open: () => undefined, runCommand: () => Promise.reject(new Error("not implemented")) },
  };
}

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}
