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
    if (existing) return existing;

    try {
      return withTransaction(this.db, () => {
        const raced = this.findByIdempotency(workspaceId, idempotencyKey);
        if (raced) return raced;

        const source = this.sources.createSource({
          knowledgeWorkspaceId: workspaceId,
          kind: "workspace-file",
          displayName: input.displayName?.trim() || path.basename(relativePath),
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
      if (raced) return raced;
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
    if (!row) throw new Error(`Unknown import job: ${id}`);
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
    const rows = this.db
      .prepare(`SELECT id FROM jobs WHERE kind = ? AND status = 'running'`)
      .all(IMPORT_JOB_KIND) as Array<{ id: string }>;
    let recovered = 0;
    for (const row of rows) {
      const now = this.now().toISOString();
      withTransaction(this.db, () => {
        this.db
          .prepare(
            `UPDATE job_attempts
             SET status = 'failed', finished_at = ?, error_json = ?
             WHERE job_id = ? AND status = 'running'`,
          )
          .run(now, JSON.stringify({ name: "InterruptedImport", message: "Import process restarted" }), row.id);
        const result = this.db
          .prepare(
            `UPDATE jobs SET status = 'queued', updated_at = ?
             WHERE id = ? AND kind = ? AND status = 'running'`,
          )
          .run(now, row.id, IMPORT_JOB_KIND);
        recovered += Number(result.changes);
      });
    }
    return recovered;
  }

  private finishCancelled(jobId: string, attemptId?: string): ImportJob {
    const now = this.now().toISOString();
    withTransaction(this.db, () => {
      if (attemptId) {
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
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(attempt), 0) AS max_attempt FROM job_attempts WHERE job_id = ?`)
      .get(jobId) as { max_attempt?: unknown } | undefined;
    const current = row?.max_attempt;
    if (typeof current !== "number" || !Number.isSafeInteger(current) || current < 0) {
      throw new Error("Invalid import job attempt state");
    }
    return current + 1;
  }

  private workspaceRoot(workspaceId: string): string {
    const row = this.db
      .prepare(`SELECT canonical_realpath FROM knowledge_workspaces WHERE id = ?`)
      .get(workspaceId) as { canonical_realpath?: unknown } | undefined;
    if (!row || typeof row.canonical_realpath !== "string" || !row.canonical_realpath) {
      throw new Error(`Unknown Knowledge Workspace: ${workspaceId}`);
    }
    return row.canonical_realpath;
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
    return row ? mapJob(row) : null;
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
  if (!normalized) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function mapJob(row: unknown): ImportJob {
  const value = row as {
    id: string;
    knowledge_workspace_id: string;
    status: ImportJobStatus;
    payload_json: string;
    created_at: string;
    updated_at: string;
    idempotency_key: string;
    cancel_requested: number;
    result_json: string | null;
  };
  return {
    id: value.id,
    knowledgeWorkspaceId: value.knowledge_workspace_id,
    status: value.status,
    idempotencyKey: value.idempotency_key,
    payload: JSON.parse(value.payload_json) as ImportPayload,
    cancelRequested: value.cancel_requested === 1,
    result: value.result_json ? (JSON.parse(value.result_json) as ImportJobResult) : null,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function serializeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "Error", message: String(error) };
}
