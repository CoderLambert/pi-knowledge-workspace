import { randomUUID } from "node:crypto";

import type { SearchQueryHit, SearchQueryResult } from "../storage/searchQuery.js";
import type {
  CitationRef,
  DeliveredEvidence,
  GenerationRun,
  GroundedAnswer,
} from "../storage/groundedAsk.js";
import type { ViewerArtifactDocument } from "../storage/sourceEvidenceViewer.js";

export interface GroundedAskHostScope {
  projectId: string;
  workspaceId: string;
  workspacePath: string;
  workspaceLabel?: string;
}

/** Host-owned resolver; callers must not derive Knowledge identity from JSON. */
export interface GroundedAskScopeResolver {
  resolveKnowledgeWorkspaceId(scope: GroundedAskHostScope): string;
}

/**
 * The service deliberately depends on this small port rather than on SQLite
 * tables or a concrete GroundedAskStore.  The storage domain owns run,
 * evidence, answer, and citation identity; this module only sequences those
 * operations around one model invocation.
 */
export interface GroundedAskStorePort {
  begin(input: GroundedAskBeginInput): GroundedAskRun;
  search(knowledgeWorkspaceId: string, runId: string, query: string): SearchQueryResult;
  deliver(input: GroundedAskDeliverInput): GroundedAskDeliveredEvidence;
  complete(input: GroundedAskCompleteInput): GroundedAskAnswer;
  fail(knowledgeWorkspaceId: string, runId: string, message: string): void;
  getRun(knowledgeWorkspaceId: string, runId: string): GenerationRun;
  getAnswer(knowledgeWorkspaceId: string, answerId: string): GroundedAnswer;
  listAnswers(knowledgeWorkspaceId: string): readonly GroundedAnswer[];
  openCitation(knowledgeWorkspaceId: string, answerId: string, citationId: string): ViewerArtifactDocument;
}

export type GroundedAskRun = GenerationRun;
export type GroundedAskDeliveredEvidence = DeliveredEvidence;
export type GroundedAskAnswer = GroundedAnswer;

export interface GroundedAskBeginInput {
  knowledgeWorkspaceId: string;
  question: string;
  provider: string;
  model: string;
  modelRevision: string;
}

export interface GroundedAskDeliverInput {
  knowledgeWorkspaceId: string;
  runId: string;
  invocationId: string;
  attempt: number;
  hits: readonly SearchQueryHit[];
}

export type GroundedAskCitation = Pick<CitationRef, "label" | "evidenceId">;

export interface GroundedAskCompleteInput {
  knowledgeWorkspaceId: string;
  runId: string;
  deliveredEvidenceId: string;
  text: string;
  citations: readonly GroundedAskCitation[];
}

export interface GroundedAskProviderInput {
  run: GroundedAskRun;
  question: string;
  search: SearchQueryResult;
  deliveredEvidence: GroundedAskDeliveredEvidence;
  signal: AbortSignal;
}

export interface GroundedAskProviderResult {
  text: string;
  citations: readonly GroundedAskCitation[];
}

/** A provider is only a model-call adapter; it does not own Knowledge state. */
export interface GroundedAskProvider {
  complete(input: GroundedAskProviderInput): Promise<GroundedAskProviderResult>;
}

export type GroundedAskModelCall = (
  input: GroundedAskProviderInput,
) => Promise<GroundedAskProviderResult>;

/**
 * Adapts one server-owned model call to the Knowledge provider contract.
 * Credentials, model selection and network clients remain in the injected
 * callback; the Knowledge service never discovers or stores them.
 */
export function createGroundedAskProvider(call: GroundedAskModelCall): GroundedAskProvider {
  return Object.freeze({
    async complete(input: GroundedAskProviderInput): Promise<GroundedAskProviderResult> {
      const result = await call(input);
      if (typeof result.text !== "string" || result.text.trim().length === 0) {
        throw new TypeError("Grounded Ask provider returned empty answer text");
      }
      if (!Array.isArray(result.citations)) {
        throw new TypeError("Grounded Ask provider returned invalid citations");
      }
      return result;
    },
  });
}

export interface GroundedAskServiceOptions {
  createInvocationId?: () => string;
}

export interface GroundedAskInput {
  knowledgeWorkspaceId: string;
  question: string;
  provider: string;
  model: string;
  modelRevision: string;
  signal?: AbortSignal;
}

export interface GroundedAskModelIdentity {
  provider: string;
  model: string;
  modelRevision: string;
}

export interface GroundedAskResult {
  run: GroundedAskRun;
  search: SearchQueryResult;
  deliveredEvidence: GroundedAskDeliveredEvidence;
  answer: GroundedAskAnswer;
}

export interface GroundedAskDispatch {
  ask(input: GroundedAskTransportAskInput): Promise<GroundedAskResult>;
  getAnswer(input: GroundedAskTransportAnswerInput): GroundedAskAnswer;
  listAnswers(input: GroundedAskTransportScopeInput): readonly GroundedAskAnswer[];
  openCitation(input: GroundedAskTransportCitationInput): ViewerArtifactDocument;
}

export interface GroundedAskTransportScopeInput {
  scope: GroundedAskHostScope;
}

export interface GroundedAskTransportAskInput extends GroundedAskTransportScopeInput {
  question: string;
}

export interface GroundedAskTransportAnswerInput extends GroundedAskTransportScopeInput {
  answerId: string;
}

export interface GroundedAskTransportCitationInput extends GroundedAskTransportAnswerInput {
  citationId: string;
}

/**
 * Runs one bounded ask against the publication snapshot frozen by the store.
 * Search is always delegated with the run id, so this layer never reacquires
 * the current publication after begin().
 */
export class GroundedAskService {
  private readonly createInvocationId: () => string;

  constructor(
    private readonly store: GroundedAskStorePort,
    private readonly provider: GroundedAskProvider,
    options: GroundedAskServiceOptions = {},
  ) {
    this.createInvocationId = options.createInvocationId ?? randomUUID;
  }

  async ask(input: GroundedAskInput): Promise<GroundedAskResult> {
    const begin = {
      knowledgeWorkspaceId: requireNonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId"),
      question: requireNonEmpty(input.question, "question"),
      provider: requireNonEmpty(input.provider, "provider"),
      model: requireNonEmpty(input.model, "model"),
      modelRevision: requireNonEmpty(input.modelRevision, "modelRevision"),
    } satisfies GroundedAskBeginInput;
    const run = this.store.begin(begin);
    const signal = input.signal ?? new AbortController().signal;

    try {
      throwIfAborted(signal);
      const search = this.store.search(run.knowledgeWorkspaceId, run.id, run.question);
      const deliveredEvidence = this.store.deliver({
        knowledgeWorkspaceId: run.knowledgeWorkspaceId,
        runId: run.id,
        invocationId: requireNonEmpty(this.createInvocationId(), "invocationId"),
        attempt: 1,
        hits: search.hits,
      });
      throwIfAborted(signal);
      const generated = await this.provider.complete({
        run,
        question: run.question,
        search,
        deliveredEvidence,
        signal,
      });
      throwIfAborted(signal);
      const answer = this.store.complete({
        knowledgeWorkspaceId: run.knowledgeWorkspaceId,
        runId: run.id,
        deliveredEvidenceId: deliveredEvidence.id,
        text: requireNonEmpty(generated.text, "answer text"),
        citations: generated.citations,
      });
      return { run, search, deliveredEvidence, answer };
    } catch (error) {
      const failure = serializeError(error);
      this.store.fail(run.knowledgeWorkspaceId, run.id, `${failure.name}: ${failure.message}`);
      throw error;
    }
  }

  getRun(knowledgeWorkspaceId: string, runId: string): GroundedAskRun {
    return this.store.getRun(requireNonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId"), requireNonEmpty(runId, "runId"));
  }

  getAnswer(knowledgeWorkspaceId: string, answerId: string): GroundedAskAnswer {
    return this.store.getAnswer(
      requireNonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId"),
      requireNonEmpty(answerId, "answerId"),
    );
  }

  listAnswers(knowledgeWorkspaceId: string): readonly GroundedAskAnswer[] {
    return this.store.listAnswers(requireNonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId"));
  }

  openCitation(knowledgeWorkspaceId: string, answerId: string, citationId: string): ViewerArtifactDocument {
    return this.store.openCitation(
      requireNonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId"),
      requireNonEmpty(answerId, "answerId"),
      requireNonEmpty(citationId, "citationId"),
    );
  }
}

/**
 * Binds an ask service to host-authoritative Workspace scope for transport.
 * This adapter is the composition seam used by the HTTP dispatcher; the
 * lower-level service remains useful to jobs and tests with an explicit ID.
 */
export function createGroundedAskDispatch(
  service: GroundedAskService,
  resolver: GroundedAskScopeResolver,
  modelIdentity: GroundedAskModelIdentity,
): GroundedAskDispatch {
  const identity = Object.freeze({
    provider: requireNonEmpty(modelIdentity.provider, "provider"),
    model: requireNonEmpty(modelIdentity.model, "model"),
    modelRevision: requireNonEmpty(modelIdentity.modelRevision, "modelRevision"),
  });
  return Object.freeze({
    ask(input: GroundedAskTransportAskInput) {
      const knowledgeWorkspaceId = resolver.resolveKnowledgeWorkspaceId(input.scope);
      return service.ask({ knowledgeWorkspaceId, question: input.question, ...identity });
    },
    getAnswer(input: GroundedAskTransportAnswerInput) {
      return service.getAnswer(resolver.resolveKnowledgeWorkspaceId(input.scope), input.answerId);
    },
    listAnswers(input: GroundedAskTransportScopeInput) {
      return service.listAnswers(resolver.resolveKnowledgeWorkspaceId(input.scope));
    },
    openCitation(input: GroundedAskTransportCitationInput) {
      return service.openCitation(
        resolver.resolveKnowledgeWorkspaceId(input.scope),
        input.answerId,
        input.citationId,
      );
    },
  });
}

function requireNonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const reason: unknown = signal.reason;
  throw reason instanceof Error ? reason : new Error("Grounded Ask was cancelled", { cause: reason });
}

function serializeError(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: String(error) };
}
