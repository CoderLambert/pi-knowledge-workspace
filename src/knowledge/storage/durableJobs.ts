import { randomUUID } from "node:crypto";
import type { KnowledgeDatabase } from "./database.js";
import { withTransaction } from "./database.js";

export type DurableJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface DurableJob {
  id: string;
  knowledgeWorkspaceId: string;
  kind: string;
  status: DurableJobStatus;
  payload: unknown;
  idempotencyKey: string | null;
  attempt: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  fencingToken: number;
  deadlineAt: string | null;
  cancelRequested: boolean;
  result: unknown;
  error: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DurableJobStoreOptions {
  now?: () => Date;
  createId?: () => string;
  maxResultBytes?: number;
  maxErrorBytes?: number;
}

export interface JobLease {
  job: DurableJob;
  workerId: string;
  fencingToken: number;
}

const MAX_LEASE_MS = 10 * 60 * 1000;
const DEFAULT_RESULT_BYTES = 32 * 1024;
const DEFAULT_ERROR_BYTES = 16 * 1024;

export class DurableJobStore {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly maxResultBytes: number;
  private readonly maxErrorBytes: number;

  constructor(private readonly db: KnowledgeDatabase, options: DurableJobStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.maxResultBytes = byteLimit(options.maxResultBytes ?? DEFAULT_RESULT_BYTES, "maxResultBytes");
    this.maxErrorBytes = byteLimit(options.maxErrorBytes ?? DEFAULT_ERROR_BYTES, "maxErrorBytes");
  }

  submit(input: {
    knowledgeWorkspaceId: string;
    kind: string;
    payload: unknown;
    idempotencyKey: string;
    deadlineAt?: string;
  }): DurableJob {
    const workspaceId = nonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const kind = nonEmpty(input.kind, "kind");
    const key = nonEmpty(input.idempotencyKey, "idempotencyKey");
    const payloadJson = json(input.payload, "payload", 256 * 1024);
    const deadlineAt = input.deadlineAt === undefined ? null : timestamp(input.deadlineAt, "deadlineAt");
    const existing = this.find(workspaceId, kind, key);
    if (existing !== null) return existing;

    try {
      return withTransaction(this.db, () => {
        const raced = this.find(workspaceId, kind, key);
        if (raced !== null) return raced;
        const now = this.now().toISOString();
        const id = this.createId();
        this.db.prepare(
          `INSERT INTO jobs
           (id, knowledge_workspace_id, kind, status, payload_json, created_at, updated_at,
            idempotency_key, cancel_requested, result_json, attempt, lease_owner,
            lease_expires_at, heartbeat_at, fencing_token, deadline_at, error_json)
           VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, 0, NULL, 0, NULL, NULL, NULL, 0, ?, NULL)`,
        ).run(id, workspaceId, kind, payloadJson, now, now, key, deadlineAt);
        return this.get(id);
      });
    } catch (error) {
      const raced = this.find(workspaceId, kind, key);
      if (raced !== null) return raced;
      throw error;
    }
  }

  get(jobId: string): DurableJob {
    const id = nonEmpty(jobId, "jobId");
    const row = this.db.prepare(`${JOB_SELECT} WHERE id = ?`).get(id);
    if (row === undefined) throw new Error(`Unknown durable job: ${id}`);
    return mapJob(row);
  }

  claim(jobId: string, workerId: string, leaseMs: number): JobLease {
    const id = nonEmpty(jobId, "jobId");
    const worker = nonEmpty(workerId, "workerId");
    const duration = leaseDuration(leaseMs);
    return withTransaction(this.db, () => {
      const current = this.get(id);
      if (current.status !== "queued" || current.cancelRequested) throw new Error(`Job ${id} is not claimable`);
      const nowDate = this.now();
      if (current.deadlineAt !== null && Date.parse(current.deadlineAt) <= nowDate.getTime()) {
        throw new Error(`Job ${id} deadline has expired`);
      }
      const now = nowDate.toISOString();
      const expires = new Date(nowDate.getTime() + duration).toISOString();
      const update = this.db.prepare(
        `UPDATE jobs SET status='running', attempt=attempt+1, lease_owner=?, lease_expires_at=?,
         heartbeat_at=?, fencing_token=fencing_token+1, updated_at=?, error_json=NULL
         WHERE id=? AND status='queued' AND cancel_requested=0`,
      ).run(worker, expires, now, now, id);
      one(update.changes, `Job ${id} claim lost a race`);
      const job = this.get(id);
      this.db.prepare(
        `INSERT INTO job_attempts
         (id, job_id, attempt, status, started_at, finished_at, error_json, fencing_token, worker_id)
         VALUES (?, ?, ?, 'running', ?, NULL, NULL, ?, ?)`,
      ).run(this.createId(), id, job.attempt, now, job.fencingToken, worker);
      return { job, workerId: worker, fencingToken: job.fencingToken };
    });
  }

  heartbeat(jobId: string, workerId: string, fencingToken: number, leaseMs: number): DurableJob {
    const id = nonEmpty(jobId, "jobId");
    const worker = nonEmpty(workerId, "workerId");
    const token = positiveInteger(fencingToken, "fencingToken");
    const duration = leaseDuration(leaseMs);
    const nowDate = this.now();
    const now = nowDate.toISOString();
    const expires = new Date(nowDate.getTime() + duration).toISOString();
    const update = this.db.prepare(
      `UPDATE jobs SET heartbeat_at=?, lease_expires_at=?, updated_at=?
       WHERE id=? AND status='running' AND lease_owner=? AND fencing_token=?
         AND cancel_requested=0 AND lease_expires_at>=?`,
    ).run(now, expires, now, id, worker, token, now);
    one(update.changes, `Job ${id} heartbeat rejected stale or cancelled lease`);
    return this.get(id);
  }

  requestCancel(jobId: string): DurableJob {
    const id = nonEmpty(jobId, "jobId");
    return withTransaction(this.db, () => {
      const job = this.get(id);
      if (terminal(job.status)) return job;
      const now = this.now().toISOString();
      const status = job.status === "queued" ? "cancelled" : "running";
      this.db.prepare(
        `UPDATE jobs SET status=?, cancel_requested=1, updated_at=? WHERE id=? AND status=?`,
      ).run(status, now, id, job.status);
      return this.get(id);
    });
  }

  succeed(jobId: string, workerId: string, fencingToken: number, result: unknown): DurableJob {
    return this.finish(jobId, workerId, fencingToken, "succeeded", json(result, "result", this.maxResultBytes), null, false);
  }

  fail(jobId: string, workerId: string, fencingToken: number, error: unknown): DurableJob {
    return this.finish(jobId, workerId, fencingToken, "failed", null, json(error, "error", this.maxErrorBytes), false);
  }

  acknowledgeCancellation(jobId: string, workerId: string, fencingToken: number): DurableJob {
    return this.finish(jobId, workerId, fencingToken, "cancelled", null, null, true);
  }

  /**
   * Runs a synchronous user-visible business commit while this lease still owns
   * the job. BEGIN IMMEDIATE and the guarded UPDATE serialize takeover against
   * the callback, so authority validation and writes through the supplied
   * database share one atomic commit boundary.
   *
   * Business stores must use the supplied database and retain their own
   * expected-generation/current-state CAS where that aggregate requires one.
   */
  commitWithAuthority<T>(
    jobId: string,
    workerId: string,
    fencingToken: number,
    operation: (db: KnowledgeDatabase) => T,
  ): T {
    const id = nonEmpty(jobId, "jobId");
    const worker = nonEmpty(workerId, "workerId");
    const token = positiveInteger(fencingToken, "fencingToken");
    return withTransaction(this.db, () => {
      const now = this.now().toISOString();
      const authority = this.db.prepare(
        `UPDATE jobs SET updated_at=updated_at
         WHERE id=? AND status='running' AND lease_owner=? AND fencing_token=?
           AND cancel_requested=0 AND lease_expires_at>=?`,
      ).run(id, worker, token, now);
      one(authority.changes, `Job ${id} business commit rejected stale, expired, cancelled, or non-owner lease`);
      const result = operation(this.db);
      if (isPromiseLike(result)) {
        throw new TypeError("Fenced business commit must be synchronous");
      }
      return result;
    });
  }

  retry(jobId: string): DurableJob {
    const id = nonEmpty(jobId, "jobId");
    return withTransaction(this.db, () => {
      const now = this.now().toISOString();
      const update = this.db.prepare(
        `UPDATE jobs SET status='queued', cancel_requested=0, result_json=NULL, error_json=NULL,
         lease_owner=NULL, lease_expires_at=NULL, heartbeat_at=NULL, updated_at=?
         WHERE id=? AND status='failed'`,
      ).run(now, id);
      one(update.changes, `Job ${id} cannot retry from its current state`);
      return this.get(id);
    });
  }

  recoverExpiredLease(jobId: string, fencingToken: number): DurableJob {
    const id = nonEmpty(jobId, "jobId");
    const token = positiveInteger(fencingToken, "fencingToken");
    return withTransaction(this.db, () => {
      const current = this.get(id);
      const now = this.now().toISOString();
      if (current.status !== "running" || current.fencingToken !== token || current.leaseExpiresAt === null || current.leaseExpiresAt >= now) {
        throw new Error(`Job ${id} does not have the expected expired lease`);
      }
      const status = current.cancelRequested ? "cancelled" : "queued";
      const errorJson = json({ code: "LEASE_EXPIRED" }, "error", this.maxErrorBytes);
      const update = this.db.prepare(
        `UPDATE jobs SET status=?, lease_owner=NULL, lease_expires_at=NULL, heartbeat_at=NULL,
         error_json=?, updated_at=? WHERE id=? AND status='running' AND fencing_token=? AND lease_expires_at<?`,
      ).run(status, errorJson, now, id, token, now);
      one(update.changes, `Job ${id} lease recovery lost a race`);
      this.finishAttempt(id, current.attempt, token, "failed", now, errorJson);
      return this.get(id);
    });
  }

  private finish(
    jobId: string,
    workerId: string,
    fencingToken: number,
    status: "succeeded" | "failed" | "cancelled",
    resultJson: string | null,
    errorJson: string | null,
    needsCancel: boolean,
  ): DurableJob {
    const id = nonEmpty(jobId, "jobId");
    const worker = nonEmpty(workerId, "workerId");
    const token = positiveInteger(fencingToken, "fencingToken");
    return withTransaction(this.db, () => {
      const current = this.get(id);
      if (current.status !== "running") throw new Error(`Job ${id} is not running`);
      const now = this.now().toISOString();
      const cancelClause = needsCancel ? " AND cancel_requested=1" : " AND cancel_requested=0";
      const update = this.db.prepare(
        `UPDATE jobs SET status=?, result_json=?, error_json=?, lease_owner=NULL,
         lease_expires_at=NULL, heartbeat_at=NULL, updated_at=?
         WHERE id=? AND status='running' AND lease_owner=? AND fencing_token=?
           AND lease_expires_at>=?${cancelClause}`,
      ).run(status, resultJson, errorJson, now, id, worker, token, now);
      one(update.changes, `Job ${id} completion rejected stale, expired, cancelled, or non-owner lease`);
      this.finishAttempt(id, current.attempt, token, status, now, errorJson);
      return this.get(id);
    });
  }

  private finishAttempt(jobId: string, attempt: number, token: number, status: DurableJobStatus, at: string, error: string | null): void {
    const update = this.db.prepare(
      `UPDATE job_attempts SET status=?, finished_at=?, error_json=?
       WHERE job_id=? AND attempt=? AND fencing_token=? AND status='running'`,
    ).run(status, at, error, jobId, attempt, token);
    one(update.changes, `Job ${jobId} attempt record did not match fencing token`);
  }

  private find(workspaceId: string, kind: string, key: string): DurableJob | null {
    const row = this.db.prepare(`${JOB_SELECT} WHERE knowledge_workspace_id=? AND kind=? AND idempotency_key=?`).get(workspaceId, kind, key);
    return row === undefined ? null : mapJob(row);
  }
}

const JOB_SELECT = `SELECT id, knowledge_workspace_id, kind, status, payload_json, idempotency_key,
 attempt, lease_owner, lease_expires_at, heartbeat_at, fencing_token, deadline_at,
 cancel_requested, result_json, error_json, created_at, updated_at FROM jobs`;

function mapJob(row: unknown): DurableJob {
  const r = recordValue(row, "durable job row");
  return {
    id: dbString(r, "id"), knowledgeWorkspaceId: dbString(r, "knowledge_workspace_id"), kind: dbString(r, "kind"),
    status: jobStatus(r["status"]), payload: parsedRequired(r, "payload_json"), idempotencyKey: nullableString(r, "idempotency_key"),
    attempt: nonNegative(r, "attempt"), leaseOwner: nullableString(r, "lease_owner"), leaseExpiresAt: nullableString(r, "lease_expires_at"),
    heartbeatAt: nullableString(r, "heartbeat_at"), fencingToken: nonNegative(r, "fencing_token"), deadlineAt: nullableString(r, "deadline_at"),
    cancelRequested: dbBoolean(r, "cancel_requested"), result: parsedNullable(r, "result_json"), error: parsedNullable(r, "error_json"),
    createdAt: dbString(r, "created_at"), updatedAt: dbString(r, "updated_at"),
  };
}

function parsedRequired(row: Record<string, unknown>, key: string): unknown {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`${key} must contain JSON text`);
  const parsedValue: unknown = JSON.parse(value);
  return parsedValue;
}
function parsedNullable(row: Record<string, unknown>, key: string): unknown {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${key} must contain JSON text`);
  const parsedValue: unknown = JSON.parse(value);
  return parsedValue;
}
function json(value: unknown, label: string, max: number): string {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`${label} must be JSON-serializable`);
  }
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text, "utf8") > max) throw new RangeError(`${label} exceeds ${String(max)} bytes`);
  return text;
}
function timestamp(value: string, name: string): string {
  const epoch = Date.parse(nonEmpty(value, name));
  if (!Number.isFinite(epoch)) throw new TypeError(`${name} must be a valid timestamp`);
  return new Date(epoch).toISOString();
}
function byteLimit(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1024 * 1024) throw new TypeError(`${name} is invalid`);
  return value;
}
function leaseDuration(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_LEASE_MS) throw new TypeError("leaseMs is invalid");
  return value;
}
function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}
function one(changes: number | bigint, message: string): void { if (Number(changes) !== 1) throw new Error(message); }
function terminal(status: DurableJobStatus): boolean { return status === "succeeded" || status === "failed" || status === "cancelled"; }
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === "object" && value !== null) || typeof value === "function"
    ? "then" in value && typeof value.then === "function"
    : false;
}
function jobStatus(value: unknown): DurableJobStatus {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled") return value;
  throw new Error("job status is invalid");
}
function nonEmpty(value: string, name: string): string { const v = value.trim(); if (v.length === 0) throw new TypeError(`${name} must be non-empty`); return v; }
function dbString(row: Record<string, unknown>, key: string): string { const v = row[key]; if (typeof v !== "string" || v.length === 0) throw new Error(`${key} is invalid`); return v; }
function nullableString(row: Record<string, unknown>, key: string): string | null { const v = row[key]; if (v === null) return null; if (typeof v !== "string" || v.length === 0) throw new Error(`${key} is invalid`); return v; }
function nonNegative(row: Record<string, unknown>, key: string): number { const v = row[key]; if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw new Error(`${key} is invalid`); return v; }
function dbBoolean(row: Record<string, unknown>, key: string): boolean { const v = row[key]; if (v === 0) return false; if (v === 1) return true; throw new Error(`${key} is invalid`); }
function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} is invalid`);
  return Object.fromEntries(Object.entries(value));
}
