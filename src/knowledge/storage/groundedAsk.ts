import { createHash, randomUUID } from "node:crypto";

import { withTransaction, type KnowledgeDatabase } from "./database.js";
import { createStableEvidence, type StableEvidence } from "./evidence.js";
import { EvidenceReadApi } from "./evidenceRead.js";
import { Fts5BaselineIndex } from "./fts5Index.js";
import { IndexBuildRetention, type IndexBuildPin } from "./indexBuildRetention.js";
import { SqliteParsedArtifactStore } from "./parsedArtifact.js";
import { acquirePublishedKnowledgeSnapshot, type PublishedKnowledgeSnapshot } from "./publishedKnowledge.js";
import { SearchQueryApi, type SearchQueryHit, type SearchQueryResult } from "./searchQuery.js";
import { SourceEvidenceViewer, type ViewerArtifactDocument } from "./sourceEvidenceViewer.js";

export interface GenerationRun {
  id: string;
  knowledgeWorkspaceId: string;
  question: string;
  provider: string;
  model: string;
  modelRevision: string;
  scope: PublishedKnowledgeSnapshot;
  status: "running" | "completed" | "failed";
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface BeginGenerationRunInput {
  knowledgeWorkspaceId: string;
  question: string;
  provider: string;
  model: string;
  modelRevision: string;
}

export interface DeliveredEvidence {
  id: string;
  generationRunId: string;
  invocationId: string;
  attempt: number;
  renderingVersion: string;
  serializedContext: string;
  contextSha256: string;
  evidence: readonly StableEvidence[];
  createdAt: string;
}

export interface DeliverEvidenceInput {
  knowledgeWorkspaceId: string;
  runId: string;
  invocationId: string;
  attempt: number;
  /** Ordered, application-selected spans. Text is rederived from canonical bytes. */
  hits: readonly SearchQueryHit[];
}

export interface CitationRef {
  id: string;
  label: string;
  evidenceId: string;
}

export interface GroundedAnswer {
  id: string;
  generationRunId: string;
  knowledgeWorkspaceId: string;
  deliveredEvidenceId: string;
  text: string;
  citations: readonly CitationRef[];
  createdAt: string;
}

export interface CompleteGroundedAnswerInput {
  knowledgeWorkspaceId: string;
  runId: string;
  deliveredEvidenceId: string;
  text: string;
  citations: readonly { label: string; evidenceId: string }[];
}

export interface GroundedAskStoreOptions {
  now?: () => Date;
  createId?: () => string;
  runPinLeaseMs?: number;
}

const RENDERING_VERSION = "grounded-evidence-json-v1";
const RUN_PIN_OWNER = "generation-run";
const DEFAULT_RUN_PIN_LEASE_MS = 5 * 60_000;

/** Canonical run/evidence/answer ownership; transport and model invocation live outside storage. */
export class GroundedAskStore {
  private readonly artifacts: SqliteParsedArtifactStore;
  private readonly retention: IndexBuildRetention;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly runPinLeaseMs: number;

  constructor(private readonly db: KnowledgeDatabase, options: GroundedAskStoreOptions = {}) {
    this.artifacts = new SqliteParsedArtifactStore(db);
    this.retention = new IndexBuildRetention(db, options);
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.runPinLeaseMs = positiveLeaseMs(options.runPinLeaseMs ?? DEFAULT_RUN_PIN_LEASE_MS);
    this.recoverExpiredRuns();
  }

  begin(input: BeginGenerationRunInput): GenerationRun {
    const workspaceId = nonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const question = nonEmpty(input.question, "question");
    const provider = nonEmpty(input.provider, "provider");
    const model = nonEmpty(input.model, "model");
    const modelRevision = nonEmpty(input.modelRevision, "modelRevision");
    const id = this.createId();
    const acquired = acquirePublishedKnowledgeSnapshot(this.db, workspaceId, {
      ownerType: "generation-acquire", ownerId: id, leaseMs: 60_000,
    }, this.retention);
    try {
      // Every selection must be readable before freeze, including artifacts which
      // would not match the first query and legacy rows lacking durable bytes.
      for (const selection of acquired.selections) {
        const artifact = this.artifacts.read(workspaceId, selection.parsedArtifactId);
        if (artifact.sourceVersionId !== selection.sourceVersionId) {
          throw new Error("Published ParsedArtifact historical lineage is inconsistent");
        }
        const opened = new SourceEvidenceViewer(this.db, this.artifacts).openArtifact({
          knowledgeWorkspaceId: workspaceId, parsedArtifactId: selection.parsedArtifactId, maxBytes: 4,
        });
        if (opened.source.id !== selection.sourceId || opened.sourceVersion.id !== selection.sourceVersionId) {
          throw new Error("Published ParsedArtifact historical reader returned a different Source selection");
        }
        if (artifact.canonicalBytes.byteLength > 0) {
          const firstScalar = artifact.canonicalText[Symbol.iterator]().next().value;
          if (firstScalar === undefined) throw new Error("Canonical artifact bytes have no readable text");
          new EvidenceReadApi(this.artifacts).read({
            knowledgeWorkspaceId: workspaceId,
            evidence: createStableEvidence({
              knowledgeWorkspaceId: workspaceId, parsedArtifactId: selection.parsedArtifactId,
              canonicalBytes: artifact.canonicalBytes,
              range: { startByte: 0, endByte: Buffer.byteLength(firstScalar) }, locatorSnapshot: {},
            }),
          });
        } else if (artifact.documentStructure.length !== 0 || artifact.sourceMap.length !== 0) {
          throw new Error("Empty ParsedArtifact has inconsistent historical structure");
        }
      }
      const scope = snapshotFromRecord(acquired);
      const createdAt = this.now().toISOString();
      withTransaction(this.db, () => {
        this.db.prepare(`INSERT INTO generation_runs
          (id, knowledge_workspace_id, publication_id, index_build_id, scope_json, question,
           provider, model, model_revision, status, error, created_at, finished_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', NULL, ?, NULL)`)
          .run(id, workspaceId, scope.publicationId, scope.indexBuildId, JSON.stringify(scope), question,
            provider, model, modelRevision, createdAt);
        // A running GenerationRun owns a renewable lease instead of a permanent pin.
        // Crash recovery can therefore release projection retention without touching
        // the immutable Answer -> CitationRef -> Evidence historical lineage.
        this.retention.pin(scope.indexBuildId, RUN_PIN_OWNER, id, this.runPinLeaseMs);
      });
      return this.getRun(workspaceId, id);
    } finally {
      acquired.release();
    }
  }

  search(knowledgeWorkspaceId: string, runId: string, query: string): SearchQueryResult {
    const run = this.requireRunning(knowledgeWorkspaceId, runId);
    const pin = this.requireSnapshot(run);
    const search = new SearchQueryApi(this.db, new Fts5BaselineIndex(this.db), {
      acquire: (workspaceId) => {
        if (workspaceId !== run.knowledgeWorkspaceId) throw new Error("GenerationRun workspace mismatch");
        return { indexBuildId: run.scope.indexBuildId, pin, release: () => { /* Run owns the pin until terminal. */ } };
      },
    });
    const result = search.query({
      knowledgeWorkspaceId: run.knowledgeWorkspaceId, query,
      allowedSourceVersionIds: run.scope.sourceVersionIds, limit: 10,
    });
    for (const hit of result.hits) this.requireScopedHit(run, hit);
    return result;
  }

  deliver(input: DeliverEvidenceInput): DeliveredEvidence {
    const run = this.requireRunning(input.knowledgeWorkspaceId, input.runId);
    this.requireSnapshot(run, false);
    const invocationId = nonEmpty(input.invocationId, "invocationId");
    if (!Number.isSafeInteger(input.attempt) || input.attempt <= 0) throw new TypeError("attempt must be positive");
    if (input.hits.length > 10) throw new TypeError("DeliveredEvidence exceeds the baseline TopK10 budget");
    const createdAt = this.now().toISOString();
    const evidence = input.hits.map((hit) => {
      this.requireScopedHit(run, hit);
      const artifact = this.artifacts.read(run.knowledgeWorkspaceId, hit.locator.parsedArtifactId);
      return createStableEvidence({
        id: this.createId(), createdAt, knowledgeWorkspaceId: run.knowledgeWorkspaceId,
        parsedArtifactId: artifact.parsedArtifactId, canonicalBytes: artifact.canonicalBytes,
        range: hit.locator,
        locatorSnapshot: {
          sourceId: hit.source.id, sourceVersionId: artifact.sourceVersionId,
          sourceDisplayName: hit.source.displayName, publicationId: run.scope.publicationId,
        },
      });
    });
    const serializedContext = JSON.stringify(evidence.map((item) => ({
      evidenceId: item.id, parsedArtifactId: item.parsedArtifactId,
      startByte: item.startByte, endByte: item.endByte, text: item.exactQuote,
    })));
    const id = this.createId();
    const contextSha256 = createHash("sha256").update(serializedContext).digest("hex");
    withTransaction(this.db, () => {
      this.requireRunning(run.knowledgeWorkspaceId, run.id);
      this.requireSnapshot(run);
      this.db.prepare(`INSERT INTO delivered_evidence
        (id, generation_run_id, invocation_id, attempt, rendering_version, serialized_context, context_sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, run.id, invocationId, input.attempt, RENDERING_VERSION, serializedContext, contextSha256, createdAt);
      evidence.forEach((item, ordinal) => {
        this.db.prepare(`INSERT INTO evidence
          (id, knowledge_workspace_id, parsed_artifact_id, start_byte, end_byte, exact_quote,
           quote_hash, locator_snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(item.id, item.knowledgeWorkspaceId, item.parsedArtifactId, item.startByte, item.endByte,
            item.exactQuote, item.quoteHash, JSON.stringify(item.locatorSnapshot), item.createdAt);
        this.db.prepare(`INSERT INTO delivered_evidence_items (delivered_evidence_id, ordinal, evidence_id)
          VALUES (?, ?, ?)`).run(id, ordinal, item.id);
      });
    });
    return { id, generationRunId: run.id, invocationId, attempt: input.attempt,
      renderingVersion: RENDERING_VERSION, serializedContext, contextSha256, evidence, createdAt };
  }

  complete(input: CompleteGroundedAnswerInput): GroundedAnswer {
    const text = nonEmpty(input.text, "text");
    if (input.citations.length === 0) throw new Error("A grounded Answer requires delivered Evidence citations");
    return withTransaction(this.db, () => {
      const run = this.requireRunning(input.knowledgeWorkspaceId, input.runId);
      this.requireSnapshot(run);
      const delivery = this.db.prepare("SELECT id FROM delivered_evidence WHERE id=? AND generation_run_id=?")
        .get(input.deliveredEvidenceId, run.id);
      if (delivery === undefined) throw new Error("DeliveredEvidence does not belong to this GenerationRun");
      const labels = new Set<string>();
      for (const citation of input.citations) {
        const label = nonEmpty(citation.label, "citation label");
        if (labels.has(label)) throw new Error("Citation labels must be unique");
        labels.add(label);
        const delivered = this.db.prepare(`SELECT e.parsed_artifact_id FROM delivered_evidence_items i
          JOIN evidence e ON e.id=i.evidence_id
          WHERE i.delivered_evidence_id=? AND i.evidence_id=? AND e.knowledge_workspace_id=?`)
          .get(input.deliveredEvidenceId, citation.evidenceId, run.knowledgeWorkspaceId);
        if (delivered === undefined) throw new Error("Citation Evidence was not delivered to the answer invocation");
        new SourceEvidenceViewer(this.db, this.artifacts).openArtifact({
          knowledgeWorkspaceId: run.knowledgeWorkspaceId,
          parsedArtifactId: stringField(record(delivered), "parsed_artifact_id"), evidenceId: citation.evidenceId,
        });
      }
      const id = this.createId();
      const at = this.now().toISOString();
      this.db.prepare(`INSERT INTO answers (id, generation_run_id, delivered_evidence_id, text, created_at)
        VALUES (?, ?, ?, ?, ?)`).run(id, run.id, input.deliveredEvidenceId, text, at);
      for (const citation of input.citations) {
        this.db.prepare("INSERT INTO citation_refs (id, answer_id, label, evidence_id) VALUES (?, ?, ?, ?)")
          .run(this.createId(), id, citation.label.trim(), citation.evidenceId);
      }
      this.finish(run, "completed", null, at);
      return this.getAnswer(run.knowledgeWorkspaceId, id);
    });
  }

  fail(knowledgeWorkspaceId: string, runId: string, message: string): void {
    withTransaction(this.db, () => {
      const run = this.requireRunning(knowledgeWorkspaceId, runId);
      this.finish(run, "failed", nonEmpty(message, "failure message"), this.now().toISOString());
    });
  }

  getRun(knowledgeWorkspaceId: string, runId: string): GenerationRun {
    const raw = this.db.prepare("SELECT * FROM generation_runs WHERE id=? AND knowledge_workspace_id=?")
      .get(nonEmpty(runId, "runId"), nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId"));
    if (raw === undefined) throw new Error("GenerationRun is not available in the requested Knowledge Workspace");
    const row = record(raw);
    const status = row["status"];
    if (status !== "running" && status !== "completed" && status !== "failed") throw new Error("Invalid GenerationRun state");
    const scope = snapshotFromRecord(JSON.parse(stringField(row, "scope_json")));
    if (scope.knowledgeWorkspaceId !== row["knowledge_workspace_id"]
      || scope.publicationId !== row["publication_id"] || scope.indexBuildId !== row["index_build_id"]) {
      throw new Error("GenerationRun frozen scope identity is inconsistent");
    }
    return Object.freeze({
      id: stringField(row, "id"), knowledgeWorkspaceId: stringField(row, "knowledge_workspace_id"),
      question: stringField(row, "question"), provider: stringField(row, "provider"),
      model: stringField(row, "model"), modelRevision: stringField(row, "model_revision"), scope,
      status, error: nullableString(row, "error"), createdAt: stringField(row, "created_at"),
      finishedAt: nullableString(row, "finished_at"),
    });
  }

  getAnswer(knowledgeWorkspaceId: string, answerId: string): GroundedAnswer {
    const raw = this.db.prepare(`SELECT a.*, r.knowledge_workspace_id FROM answers a
      JOIN generation_runs r ON r.id=a.generation_run_id WHERE a.id=? AND r.knowledge_workspace_id=?`)
      .get(nonEmpty(answerId, "answerId"), nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId"));
    if (raw === undefined) throw new Error("Answer is not available in the requested Knowledge Workspace");
    const row = record(raw);
    const citations = this.db.prepare("SELECT id, label, evidence_id FROM citation_refs WHERE answer_id=? ORDER BY rowid")
      .all(answerId).map((rawCitation) => {
        const citation = record(rawCitation);
        return { id: stringField(citation, "id"), label: stringField(citation, "label"),
          evidenceId: stringField(citation, "evidence_id") };
      });
    return { id: stringField(row, "id"), generationRunId: stringField(row, "generation_run_id"),
      knowledgeWorkspaceId: stringField(row, "knowledge_workspace_id"),
      deliveredEvidenceId: stringField(row, "delivered_evidence_id"), text: stringField(row, "text"),
      citations, createdAt: stringField(row, "created_at") };
  }

  listAnswers(knowledgeWorkspaceId: string): GroundedAnswer[] {
    return this.db.prepare(`SELECT a.id FROM answers a JOIN generation_runs r ON r.id=a.generation_run_id
      WHERE r.knowledge_workspace_id=? ORDER BY a.created_at DESC, a.id DESC LIMIT 100`)
      .all(nonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId"))
      .map((row) => this.getAnswer(knowledgeWorkspaceId, stringField(record(row), "id")));
  }

  openCitation(knowledgeWorkspaceId: string, answerId: string, citationId: string): ViewerArtifactDocument {
    const answer = this.getAnswer(knowledgeWorkspaceId, answerId);
    const citation = answer.citations.find((item) => item.id === citationId);
    if (citation === undefined) throw new Error("CitationRef does not belong to the requested Answer");
    const row = this.db.prepare("SELECT parsed_artifact_id FROM evidence WHERE id=? AND knowledge_workspace_id=?")
      .get(citation.evidenceId, knowledgeWorkspaceId);
    if (row === undefined) throw new Error("Historical Citation Evidence is unavailable");
    return new SourceEvidenceViewer(this.db, this.artifacts).openArtifact({
      knowledgeWorkspaceId, parsedArtifactId: stringField(record(row), "parsed_artifact_id"), evidenceId: citation.evidenceId,
    });
  }

  private requireRunning(knowledgeWorkspaceId: string, runId: string): GenerationRun {
    const run = this.getRun(knowledgeWorkspaceId, runId);
    if (run.status !== "running") throw new Error(`GenerationRun is ${run.status}`);
    return run;
  }

  private requireSnapshot(run: GenerationRun): IndexBuildPin;
  private requireSnapshot(run: GenerationRun, renew: false): undefined;
  private requireSnapshot(run: GenerationRun, renew = true): IndexBuildPin | undefined {
    const at = this.now().toISOString();
    const row = this.db.prepare(`SELECT p.id FROM index_build_pins p
      JOIN index_builds b ON b.id=p.index_build_id
      WHERE p.index_build_id=? AND p.owner_type=? AND p.owner_id=?
        AND p.lease_expires_at IS NOT NULL AND p.lease_expires_at>?
        AND b.knowledge_workspace_id=? AND b.status IN ('active', 'retained')`)
      .get(run.scope.indexBuildId, RUN_PIN_OWNER, run.id, at, run.knowledgeWorkspaceId);
    if (row === undefined) throw new Error("Frozen GenerationRun retrieval snapshot is unavailable or its lease expired; refusing current publication");
    const pinId = stringField(record(row), "id");
    if (!renew) return undefined;
    try {
      return this.retention.renew(pinId, this.runPinLeaseMs);
    } catch {
      throw new Error("Frozen GenerationRun retrieval snapshot lease expired; refusing current publication");
    }
  }

  private requireScopedHit(run: GenerationRun, hit: SearchQueryHit): void {
    const selection = run.scope.selections.find((item) => item.parsedArtifactId === hit.locator.parsedArtifactId);
    if (selection?.sourceVersionId !== hit.sourceVersionId || selection.sourceId !== hit.source.id) {
      throw new Error("Retrieved Evidence is outside the frozen GenerationRun scope");
    }
    const row = this.db.prepare(`SELECT id FROM chunks WHERE id=? AND index_build_id=?
      AND parsed_artifact_id=? AND source_version_id=? AND start_byte=? AND end_byte=?`)
      .get(hit.chunkId, run.scope.indexBuildId, hit.locator.parsedArtifactId, hit.sourceVersionId,
        hit.locator.startByte, hit.locator.endByte);
    if (row === undefined) throw new Error("Retrieved Evidence does not match the frozen retrieval snapshot");
  }

  private finish(run: GenerationRun, status: "completed" | "failed", error: string | null, at: string): void {
    const result = this.db.prepare("UPDATE generation_runs SET status=?, error=?, finished_at=? WHERE id=? AND status='running'")
      .run(status, error, at, run.id);
    if (Number(result.changes) !== 1) throw new Error("GenerationRun terminal transition lost ownership");
    this.db.prepare("DELETE FROM index_build_pins WHERE owner_type=? AND owner_id=?").run(RUN_PIN_OWNER, run.id);
  }

  private recoverExpiredRuns(): number {
    const at = this.now().toISOString();
    const candidates = this.db.prepare(`SELECT r.id FROM generation_runs r
      LEFT JOIN index_build_pins p ON p.index_build_id=r.index_build_id
        AND p.owner_type=? AND p.owner_id=r.id
        AND (p.lease_expires_at IS NULL OR p.lease_expires_at>?)
      WHERE r.status='running' AND p.id IS NULL LIMIT 1`).all(RUN_PIN_OWNER, at);
    if (candidates.length === 0) return 0;

    return withTransaction(this.db, () => {
      const rows = this.db.prepare(`SELECT r.id FROM generation_runs r
        LEFT JOIN index_build_pins p ON p.index_build_id=r.index_build_id
          AND p.owner_type=? AND p.owner_id=r.id
          AND (p.lease_expires_at IS NULL OR p.lease_expires_at>?)
        WHERE r.status='running' AND p.id IS NULL`).all(RUN_PIN_OWNER, at);
      let recovered = 0;
      for (const raw of rows) {
        const runId = stringField(record(raw), "id");
        const result = this.db.prepare(`UPDATE generation_runs
          SET status='failed', error=?, finished_at=?
          WHERE id=? AND status='running'
            AND NOT EXISTS (
              SELECT 1 FROM index_build_pins p
              WHERE p.index_build_id=generation_runs.index_build_id
                AND p.owner_type=? AND p.owner_id=generation_runs.id
                AND (p.lease_expires_at IS NULL OR p.lease_expires_at>?)
            )`)
          .run("GenerationRun retrieval lease expired before recovery", at, runId, RUN_PIN_OWNER, at);
        if (Number(result.changes) !== 1) continue;
        recovered += 1;
        this.db.prepare("DELETE FROM index_build_pins WHERE owner_type=? AND owner_id=?")
          .run(RUN_PIN_OWNER, runId);
      }
      return recovered;
    });
  }
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${label} must be non-empty`);
  return normalized;
}

function positiveLeaseMs(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 60 * 60_000) {
    throw new TypeError("runPinLeaseMs must be a positive duration no greater than one hour");
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid persisted Grounded Ask record");
  return Object.fromEntries(Object.entries(value));
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid Grounded Ask ${key}`);
  return value;
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  return row[key] === null ? null : stringField(row, key);
}

function snapshotFromRecord(value: unknown): PublishedKnowledgeSnapshot {
  const row = record(value);
  const generation = row["generation"];
  const rawSelections = row["selections"];
  if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation <= 0
    || !Array.isArray(rawSelections) || rawSelections.length === 0) throw new Error("Invalid frozen publication scope");
  const selections = rawSelections.map((raw: unknown) => {
    const selection = record(raw);
    return Object.freeze({ sourceId: stringField(selection, "sourceId"),
      sourceVersionId: stringField(selection, "sourceVersionId"), parsedArtifactId: stringField(selection, "parsedArtifactId") });
  });
  if (new Set(selections.map((item) => item.sourceId)).size !== selections.length) {
    throw new Error("Frozen publication contains duplicate Sources");
  }
  const sourceVersionIds = selections.map((item) => item.sourceVersionId);
  const parsedArtifactIds = selections.map((item) => item.parsedArtifactId);
  if (JSON.stringify(row["sourceVersionIds"]) !== JSON.stringify(sourceVersionIds)
    || JSON.stringify(row["parsedArtifactIds"]) !== JSON.stringify(parsedArtifactIds)) {
    throw new Error("Frozen publication selection identity is inconsistent");
  }
  return Object.freeze({ knowledgeWorkspaceId: stringField(row, "knowledgeWorkspaceId"),
    publicationId: stringField(row, "publicationId"), generation, indexBuildId: stringField(row, "indexBuildId"),
    retrievalConfigRevision: stringField(row, "retrievalConfigRevision"), publishedAt: stringField(row, "publishedAt"),
    selections: Object.freeze(selections), sourceVersionIds: Object.freeze(sourceVersionIds),
    parsedArtifactIds: Object.freeze(parsedArtifactIds) });
}
