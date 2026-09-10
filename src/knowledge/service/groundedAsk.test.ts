import { describe, expect, it, vi } from "vitest";
import type { SearchQueryResult } from "../storage/searchQuery.js";
import {
  createGroundedAskDispatch,
  GroundedAskService,
  type GroundedAskCompleteInput,
  type GroundedAskProvider,
  type GroundedAskStorePort,
} from "./groundedAsk.js";

const search: SearchQueryResult = {
  queryHandle: "query-1",
  runHandle: "run-1",
  indexBuildId: "build-old",
  hits: [],
  debug: { backend: "fts5", requestedLimit: 10, effectiveLimit: 10, allowedSourceVersionCount: null },
};

function fixture(): {
  store: GroundedAskStorePort;
  provider: GroundedAskProvider;
  calls: {
    begin: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    deliver: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    fail: ReturnType<typeof vi.fn>;
    providerComplete: ReturnType<typeof vi.fn>;
  };
} {
  const run = {
    id: "run-1",
    knowledgeWorkspaceId: "kw-1",
    question: "What is true?",
    provider: "fixture",
    model: "fixture-model",
    modelRevision: "fixture-r1",
    scope: {
      knowledgeWorkspaceId: "kw-1",
      publicationId: "publication-1",
      generation: 1,
      indexBuildId: "build-old",
      retrievalConfigRevision: "fts5-baseline-v1",
      selections: [],
      sourceVersionIds: [],
      parsedArtifactIds: [],
      publishedAt: "2026-01-01T00:00:00.000Z",
    },
    status: "running" as const,
    error: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    finishedAt: null,
  };
  const begin = vi.fn(() => run);
  const searchCall = vi.fn(() => search);
  const deliver = vi.fn(() => ({
      id: "delivered-1",
      generationRunId: "run-1",
      invocationId: "invocation-1",
      attempt: 1,
      renderingVersion: "grounded-evidence-json-v1",
      serializedContext: "[]",
      contextSha256: "hash",
      evidence: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    }));
  const complete = vi.fn((input: GroundedAskCompleteInput) => ({
      id: "answer-1",
      knowledgeWorkspaceId: input.knowledgeWorkspaceId,
      generationRunId: input.runId,
      deliveredEvidenceId: input.deliveredEvidenceId,
      text: input.text,
      citations: input.citations.map((citation, index) => ({ ...citation, id: `citation-${String(index + 1)}` })),
      createdAt: "2026-01-01T00:00:00.000Z",
    }));
  const fail = vi.fn();
  const store: GroundedAskStorePort = {
    begin,
    search: searchCall,
    deliver,
    complete,
    fail,
    getRun: vi.fn(() => run),
    getAnswer: vi.fn(),
    listAnswers: vi.fn(() => []),
    openCitation: vi.fn(),
  };
  const providerComplete = vi.fn(() => Promise.resolve({ text: "A durable answer", citations: [] }));
  const provider: GroundedAskProvider = { complete: providerComplete };
  return { store, provider, calls: { begin, search: searchCall, deliver, complete, fail, providerComplete } };
}

describe("GroundedAskService", () => {
  it("uses server-owned model identity at the host-authoritative dispatch boundary", async () => {
    const { store, provider, calls } = fixture();
    const service = new GroundedAskService(store, provider, { createInvocationId: () => "invocation-1" });
    const dispatch = createGroundedAskDispatch(
      service,
      { resolveKnowledgeWorkspaceId: () => "kw-1" },
      { provider: "server-provider", model: "server-model", modelRevision: "server-r1" },
    );

    await dispatch.ask({
      scope: { projectId: "project", workspaceId: "workspace", workspacePath: "/workspace" },
      question: "What is true?",
    });

    expect(calls.begin).toHaveBeenCalledWith(expect.objectContaining({
      provider: "server-provider",
      model: "server-model",
      modelRevision: "server-r1",
    }));
  });

  it("begins once, searches the frozen run, delivers Top-K hits, and persists the answer", async () => {
    const { store, provider, calls } = fixture();
    const service = new GroundedAskService(store, provider, { createInvocationId: () => "invocation-1" });

    const result = await service.ask({
      knowledgeWorkspaceId: "kw-1",
      question: " What is true? ",
      provider: "fixture",
      model: "fixture-model",
      modelRevision: "fixture-r1",
    });

    expect(calls.begin).toHaveBeenCalledWith({
      knowledgeWorkspaceId: "kw-1",
      question: "What is true?",
      provider: "fixture",
      model: "fixture-model",
      modelRevision: "fixture-r1",
    });
    expect(calls.search).toHaveBeenCalledWith("kw-1", "run-1", "What is true?");
    expect(calls.deliver).toHaveBeenCalledWith({
      knowledgeWorkspaceId: "kw-1",
      runId: "run-1",
      invocationId: "invocation-1",
      attempt: 1,
      hits: [],
    });
    expect(calls.providerComplete).toHaveBeenCalledWith(expect.objectContaining({ question: "What is true?" }));
    expect(calls.complete).toHaveBeenCalledWith({
      knowledgeWorkspaceId: "kw-1",
      runId: "run-1",
      deliveredEvidenceId: "delivered-1",
      text: "A durable answer",
      citations: [],
    });
    expect(result.answer.id).toBe("answer-1");
  });

  it("fails the run when the provider rejects and preserves the original error", async () => {
    const { store, provider, calls } = fixture();
    const failure = new Error("provider unavailable");
    calls.providerComplete.mockRejectedValueOnce(failure);
    const service = new GroundedAskService(store, provider, { createInvocationId: () => "invocation-1" });

    await expect(service.ask({
      knowledgeWorkspaceId: "kw-1",
      question: "question",
      provider: "fixture",
      model: "fixture-model",
      modelRevision: "fixture-r1",
    })).rejects.toBe(failure);
    expect(calls.fail).toHaveBeenCalledWith("kw-1", "run-1", "Error: provider unavailable");
  });

  it("does not start model work after cancellation", async () => {
    const { store, provider, calls } = fixture();
    const controller = new AbortController();
    controller.abort.call(controller, new Error("cancelled"));
    const service = new GroundedAskService(store, provider);

    await expect(service.ask({
      knowledgeWorkspaceId: "kw-1",
      question: "question",
      provider: "fixture",
      model: "fixture-model",
      modelRevision: "fixture-r1",
      signal: controller.signal,
    })).rejects.toThrow("cancelled");
    expect(calls.providerComplete).not.toHaveBeenCalled();
    expect(calls.fail).toHaveBeenCalledTimes(1);
  });
});
