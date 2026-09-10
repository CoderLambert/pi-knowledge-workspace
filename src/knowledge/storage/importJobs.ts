import { randomUUID } from "node:crypto";
import path from "node:path";

import type { KnowledgeDatabase } from "./database.js";
import { withTransaction } from "./database.js";
import type { KnowledgeSource, KnowledgeSourceVersion } from "./sourceDomain.js";
import {
  captureWorkspaceFile,
  type CapturedWorkspaceFile,
} from "./workspaceFileReader.js";

const IMPORT_JOB_KIND = "workspace-file-import";
const ALLOWED_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const DEFAULT_IMPORT_MAX_BYTES = 16 * 1024 * 1024;

export type ImportJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

interface ImportPayload {
  sourceId: string;
  relativePath: string;
}

export interface ImportJobResult {
  sourceId: string;
  sourceVersionId: string;
  contentSha256: string;
  byteLength: number;
}

export interface ImportJob {
  id: string;
  knowledgeWorkspaceId: string;
  status: ImportJobStatus;
  idempotencyKey: string;
  payload: ImportPayload;
  cancelRequested: boolean;
  result: ImportJobResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportSourceDomain {
  createSource(input: {
    knowledgeWorkspaceId: string;
    kind: string;
    displayName: string;
  }): KnowledgeSource;
  captureSourceVersion(sourceId: string, rawBytes: Uint8Array): Promise<KnowledgeSourceVersion>;
}

export interface MdTextImportJobsOptions {
  now?: () => Date;
  createId?: () => string;
  maxBytes?: number;
  captureFile?: (
    workspaceRoot: string,
    relativePath: string,
    options?: { maxBytes?: number },
  ) => Promise<CapturedWorkspaceFile>;
}

export class MdTextImportJobs {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly maxBytes: number;
  private readonly captureFile: NonNullable<MdTextImportJobsOptions["captureFile"]>;

  constructor(
    private readonly db: KnowledgeDatabase,
    private readonly sources: ImportSourceDomain,
    options: MdTextImportJobsOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.maxBytes = options.maxBytes ?? DEFAULT_IMPORT_MAX_BYTES;
    this.captureFile = options.captureFile ?? captureWorkspaceFile;
  }

  submit(input: {
    knowledgeWorkspaceId: string;
    relativePath: string;
    idempotencyKey: string;
    displayName?: string;
  }): ImportJob {
    const workspaceId = requireNonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const relativePath = requireSupportedRelativePath(input.relativePath);
    const idempotencyKey = requireNonEmpty(input.idempotencyKey, "idempotencyKey");

    const existing = this.findByIdempotency(workspaceId, idempotencyKey);
    if (existing !== null) return existing;

    try {
      return withTransaction(this.db, () => {
        const raced = this.findByIdempotency(workspaceId, idempotencyKey);
        if (raced !== null) return raced;

        const requestedDisplayName = input.displayName?.trim();
        const displayName = requestedDisplayName === undefined || requestedDisplayName.length === 0
          ? path.basename(relativePath)
          : requestedDisplayName;
        const source = this.sources.createSource({
          knowledgeWorkspaceId: workspaceId,
          kind: "workspace-file",
          displayName,
        });
        const now = this.now().toISOString();
        const job: ImportJob = {
          id: this.createId(),
          knowledgeWorkspaceId: workspaceId,
          status: "queued",
          idempotencyKey,
          payload: { sourceId: source.id, relativePath },
          cancelRequested: false,
          result: null,
          createdAt: now,
          updatedAt: now,
        };
        this.db
          .prepare(
            `INSERT INTO jobs
             (id, knowledge_workspace_id, kind, status, payload_json, created_at, updated_at,
              idempotency_key, cancel_requested, result_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
          )
          .run(
            job.id,
            job.knowledgeWorkspaceId,
            IMPORT_JOB_KIND,
            job.status,
            JSON.stringify(job.payload),
            job.createdAt,
            job.updatedAt,
            job.idempotencyKey,
          );
        return job;
      });
    } catch (error) {
      const raced = this.findByIdempotency(workspaceId, idempotencyKey);
      if (raced !== null) return raced;
      throw error;
    }
  }

  get(jobId: string): ImportJob {
    const id = requireNonEmpty(jobId, "jobId");
    const row = this.db
      .prepare(
        `SELECT id, knowledge_workspace_id, status, payload_json, created_at, updated_at,
                idempotency_key, cancel_requested, result_json
         FROM jobs WHERE id = ? AND kind = ?`,
      )
      .get(id, IMPORT_JOB_KIND);
    if (row === undefined) throw new Error(`Unknown import job: ${id}`);
    return mapJob(row);
  }

  requestCancel(jobId: string): ImportJob {
    const job = this.get(jobId);
    if (job.status === "succeeded" || job.status === "cancelled") return job;
    const now = this.now().toISOString();
    const nextStatus = job.status === "running" ? "running" : "cancelled";
    this.db
      .prepare(
        `UPDATE jobs
         SET cancel_requested = 1, status = ?, updated_at = ?
         WHERE id = ? AND kind = ?`,
      )
      .run(nextStatus, now, job.id, IMPORT_JOB_KIND);
    return this.get(job.id);
  }

  retry(jobId: string): ImportJob {
    const job = this.get(jobId);
    if (job.status !== "failed") {
      throw new Error(`Import job ${job.id} cannot retry from status ${job.status}`);
    }
    const now = this.now().toISOString();
    this.db
      .prepare(
        `UPDATE jobs
         SET status = 'queued', cancel_requested = 0, updated_at = ?
         WHERE id = ? AND kind = ? AND status = 'failed'`,
      )
      .run(now, job.id, IMPORT_JOB_KIND);
    return this.get(job.id);
  }

  async run(jobId: string): Promise<ImportJob> {
    let job = this.get(jobId);
    if (job.status === "succeeded" || job.status === "cancelled") return job;
    if (job.status !== "queued") {
      throw new Error(`Import job ${job.id} cannot run from status ${job.status}`);
    }
    if (job.cancelRequested) return this.finishCancelled(job.id);

    const attempt = this.nextAttempt(job.id);
    const attemptId = this.createId();
    const startedAt = this.now().toISOString();
    withTransaction(this.db, () => {
      const update = this.db
        .prepare(
          `UPDATE jobs SET status = 'running', updated_at = ?
           WHERE id = ? AND kind = ? AND status = 'queued' AND cancel_requested = 0`,
        )
        .run(startedAt, job.id, IMPORT_JOB_KIND);
      if (Number(update.changes) !== 1) throw new Error(`Import job ${job.id} was claimed concurrently`);
      this.db
        .prepare(
          `INSERT INTO job_attempts
           (id, job_id, attempt, status, started_at, finished_at, error_json)
           VALUES (?, ?, ?, 'running', ?, NULL, NULL)`,
        )
        .run(attemptId, job.id, attempt, startedAt);
    });

    try {
      job = this.get(job.id);
      if (job.cancelRequested) return this.finishCancelled(job.id, attemptId);

      const workspaceRoot = this.workspaceRoot(job.knowledgeWorkspaceId);
      const captured = await this.captureFile(workspaceRoot, job.payload.relativePath, {
        maxBytes: this.maxBytes,
      });

      job = this.get(job.id);
      if (job.cancelRequested) return this.finishCancelled(job.id, attemptId);

      // Once SourceVersion persistence begins we finish atomically/idempotently rather than
      // report cancellation after a durable version may already exist.
      const version = await this.sources.captureSourceVersion(job.payload.sourceId, captured.bytes);
      if (version.contentSha256 !== captured.contentSha256 || version.byteLength !== captured.byteLength) {
        throw new Error("Captured Workspace bytes do not match the persisted SourceVersion identity");
      }

      const result: ImportJobResult = {
        sourceId: job.payload.sourceId,
        sourceVersionId: version.id,
        contentSha256: version.contentSha256,
        byteLength: version.byteLength,
      };
      const finishedAt = this.now().toISOString();
      withTransaction(this.db, () => {
        this.db
          .prepare(
            `UPDATE job_attempts SET status = 'succeeded', finished_at = ?, error_json = NULL
             WHERE id = ? AND job_id = ?`,
          )
          .run(finishedAt, attemptId, job.id);
        this.db
          .prepare(
            `UPDATE jobs
             SET status = 'succeeded', result_json = ?, updated_at = ?
             WHERE id = ? AND kind = ?`,
          )
          .run(JSON.stringify(result), finishedAt, job.id, IMPORT_JOB_KIND);
      });
      return this.get(job.id);
    } catch (error) {
      const finishedAt = this.now().toISOString();
      const errorJson = JSON.stringify(serializeError(error));
      withTransaction(this.db, () => {
        this.db
          .prepare(
            `UPDATE job_attempts SET status = 'failed', finished_at = ?, error_json = ?
             WHERE id = ? AND job_id = ?`,
          )
          .run(finishedAt, errorJson, attemptId, job.id);
        this.db
          .prepare(
            `UPDATE jobs SET status = 'failed', updated_at = ? WHERE id = ? AND kind = ?`,
          )
          .run(finishedAt, job.id, IMPORT_JOB_KIND);
      });
      throw error;
    }
  }

  recoverInterrupted(): number {
    const rows: unknown[] = this.db
      .prepare(`SELECT id FROM jobs WHERE kind = ? AND status = 'running'`)
      .all(IMPORT_JOB_KIND);
    let recovered = 0;
    for (const raw of rows) {
      const row = recordValue(raw, "interrupted import row");
      const jobId = requireRecordString(row, "id");
      const now = this.now().toISOString();
      withTransaction(this.db, () => {
        this.db
          .prepare(
            `UPDATE job_attempts
             SET status = 'failed', finished_at = ?, error_json = ?
             WHERE job_id = ? AND status = 'running'`,
          )
          .run(now, JSON.stringify({ name: "InterruptedImport", message: "Import process restarted" }), jobId);
        const result = this.db
          .prepare(
            `UPDATE jobs SET status = 'queued', updated_at = ?
             WHERE id = ? AND kind = ? AND status = 'running'`,
          )
          .run(now, jobId, IMPORT_JOB_KIND);
        recovered += Number(result.changes);
      });
    }
    return recovered;
  }

  private finishCancelled(jobId: string, attemptId?: string): ImportJob {
    const now = this.now().toISOString();
    withTransaction(this.db, () => {
      if (attemptId !== undefined) {
        this.db
          .prepare(
            `UPDATE job_attempts SET status = 'cancelled', finished_at = ?, error_json = NULL
             WHERE id = ? AND job_id = ?`,
          )
          .run(now, attemptId, jobId);
      }
      this.db
        .prepare(
          `UPDATE jobs SET status = 'cancelled', cancel_requested = 1, updated_at = ?
           WHERE id = ? AND kind = ?`,
        )
        .run(now, jobId, IMPORT_JOB_KIND);
    });
    return this.get(jobId);
  }

  private nextAttempt(jobId: string): number {
    const raw = this.db
      .prepare(`SELECT COALESCE(MAX(attempt), 0) AS max_attempt FROM job_attempts WHERE job_id = ?`)
      .get(jobId);
    const row = recordValue(raw, "import attempt state");
    const current = row["max_attempt"];
    if (typeof current !== "number" || !Number.isSafeInteger(current) || current < 0) {
      throw new Error("Invalid import job attempt state");
    }
    return current + 1;
  }

  private workspaceRoot(workspaceId: string): string {
    const raw = this.db
      .prepare(`SELECT canonical_realpath FROM knowledge_workspaces WHERE id = ?`)
      .get(workspaceId);
    const row = recordValue(raw, `Knowledge Workspace ${workspaceId}`);
    const canonicalRealpath = row["canonical_realpath"];
    if (typeof canonicalRealpath !== "string" || canonicalRealpath.length === 0) {
      throw new Error(`Unknown Knowledge Workspace: ${workspaceId}`);
    }
    return canonicalRealpath;
  }

  private findByIdempotency(workspaceId: string, idempotencyKey: string): ImportJob | null {
    const row = this.db
      .prepare(
        `SELECT id, knowledge_workspace_id, status, payload_json, created_at, updated_at,
                idempotency_key, cancel_requested, result_json
         FROM jobs
         WHERE knowledge_workspace_id = ? AND kind = ? AND idempotency_key = ?`,
      )
      .get(workspaceId, IMPORT_JOB_KIND, idempotencyKey);
    return row === undefined ? null : mapJob(row);
  }
}

function requireSupportedRelativePath(input: string): string {
  const value = requireNonEmpty(input, "relativePath");
  if (path.isAbsolute(value)) throw new TypeError("relativePath must be relative");
  const extension = path.extname(value).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new TypeError("P1 import supports only Markdown and TXT files");
  }
  return value;
}

function requireNonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function mapJob(row: unknown): ImportJob {
  const value = recordValue(row, "import job row");
  const id = requireRecordString(value, "id");
  const knowledgeWorkspaceId = requireRecordString(value, "knowledge_workspace_id");
  const status = importJobStatus(value["status"]);
  const idempotencyKey = requireRecordString(value, "idempotency_key");
  const payload = parseImportPayload(value["payload_json"]);
  const cancelRequested = importBoolean(value["cancel_requested"], "cancel_requested");
  const result = parseImportResult(value["result_json"]);
  const createdAt = requireRecordString(value, "created_at");
  const updatedAt = requireRecordString(value, "updated_at");
  return { id, knowledgeWorkspaceId, status, idempotencyKey, payload, cancelRequested, result, createdAt, updatedAt };
}

function parseImportPayload(value: unknown): ImportPayload {
  const parsed = parseJsonRecord(value, "payload_json");
  return {
    sourceId: requireRecordString(parsed, "sourceId"),
    relativePath: requireRecordString(parsed, "relativePath"),
  };
}

function parseImportResult(value: unknown): ImportJobResult | null {
  if (value === null) return null;
  const parsed = parseJsonRecord(value, "result_json");
  const byteLength = parsed["byteLength"];
  if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new Error("result_json byteLength is invalid");
  }
  return {
    sourceId: requireRecordString(parsed, "sourceId"),
    sourceVersionId: requireRecordString(parsed, "sourceVersionId"),
    contentSha256: requireRecordString(parsed, "contentSha256"),
    byteLength,
  };
}

function parseJsonRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "string") throw new Error(`${label} must contain JSON text`);
  const parsed: unknown = JSON.parse(value);
  return recordValue(parsed, label);
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} is invalid`);
  return Object.fromEntries(Object.entries(value));
}

function requireRecordString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is invalid`);
  return value;
}

function importBoolean(value: unknown, key: string): boolean {
  if (value === 0) return false;
  if (value === 1) return true;
  throw new Error(`${key} is invalid`);
}

function importJobStatus(value: unknown): ImportJobStatus {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled") return value;
  throw new Error("Import job status is invalid");
}

function serializeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "Error", message: String(error) };
}
