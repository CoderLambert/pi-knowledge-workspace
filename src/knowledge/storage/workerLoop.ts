import type { KnowledgeDatabase } from "./database.js";
import type { DurableJob, DurableJobStore, JobLease } from "./durableJobs.js";

export interface DurableJobHandlerContext {
  readonly job: DurableJob;
  readonly signal: AbortSignal;
  /**
   * Cheap pre-work authority check. This does not fence a later business write;
   * user-visible commits must use commitWithAuthority().
   */
  assertAuthority(): void;
  /**
   * Atomically validates this lease and runs a synchronous business commit on
   * the same SQLite transaction. Aggregate-specific generation/state CAS still
   * belongs inside the callback.
   */
  commitWithAuthority<T>(operation: (db: KnowledgeDatabase) => T): T;
}

export type DurableJobHandler = (context: DurableJobHandlerContext) => Promise<unknown>;

export interface DurableJobWorkerOptions {
  workerId: string;
  leaseMs?: number;
  heartbeatMs?: number;
  candidateLimit?: number;
  recoveryLimit?: number;
  now?: () => Date;
}

export type DurableJobWorkerRunResult =
  | { status: "idle"; recoveredLeases: number; expiredDeadlines: number }
  | { status: "succeeded" | "failed" | "cancelled" | "lost-lease"; jobId: string; recoveredLeases: number; expiredDeadlines: number };

const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_HEARTBEAT_MS = 10_000;
const DEFAULT_SCAN_LIMIT = 32;

/**
 * V1 single-concurrency durable worker.
 *
 * The loop deliberately stays small: SQLite is the queue, DurableJobStore owns
 * all lease/fencing transitions, and this class only discovers candidates,
 * performs crash recovery, runs one handler, and maintains its lease.
 */
export class DurableJobWorker {
  private readonly workerId: string;
  private readonly leaseMs: number;
  private readonly heartbeatMs: number;
  private readonly candidateLimit: number;
  private readonly recoveryLimit: number;
  private readonly now: () => Date;

  constructor(
    private readonly db: KnowledgeDatabase,
    private readonly jobs: DurableJobStore,
    private readonly handlers: ReadonlyMap<string, DurableJobHandler>,
    options: DurableJobWorkerOptions,
  ) {
    this.workerId = nonEmpty(options.workerId, "workerId");
    this.leaseMs = positiveDuration(options.leaseMs ?? DEFAULT_LEASE_MS, "leaseMs");
    this.heartbeatMs = positiveDuration(options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS, "heartbeatMs");
    if (this.heartbeatMs >= this.leaseMs) throw new TypeError("heartbeatMs must be smaller than leaseMs");
    this.candidateLimit = boundedLimit(options.candidateLimit ?? DEFAULT_SCAN_LIMIT, "candidateLimit");
    this.recoveryLimit = boundedLimit(options.recoveryLimit ?? DEFAULT_SCAN_LIMIT, "recoveryLimit");
    this.now = options.now ?? (() => new Date());
  }

  async runOnce(): Promise<DurableJobWorkerRunResult> {
    const recoveredLeases = this.recoverExpiredLeases();
    const expiredDeadlines = this.failExpiredQueuedDeadlines();
    const lease = this.claimNext();
    if (lease === null) return { status: "idle", recoveredLeases, expiredDeadlines };

    const jobId = lease.job.id;
    const handler = this.handlers.get(lease.job.kind);
    if (handler === undefined) {
      try {
        this.jobs.fail(jobId, this.workerId, lease.fencingToken, {
          code: "UNSUPPORTED_JOB_KIND",
          message: `No worker handler is registered for job kind ${lease.job.kind}`,
        });
        return { status: "failed", jobId, recoveredLeases, expiredDeadlines };
      } catch (error) {
        if (isLeaseRejection(error)) return { status: "lost-lease", jobId, recoveredLeases, expiredDeadlines };
        throw error;
      }
    }

    const abortController = new AbortController();
    let heartbeatFailure: unknown;
    const timer = setInterval(() => {
      try {
        const current = this.jobs.get(jobId);
        if (current.cancelRequested) {
          abortController.abort(new Error("Durable job cancellation requested"));
          return;
        }
        this.jobs.heartbeat(jobId, this.workerId, lease.fencingToken, this.leaseMs);
      } catch (error) {
        heartbeatFailure = error;
        abortController.abort(error);
      }
    }, this.heartbeatMs);

    try {
      const initial = this.jobs.get(jobId);
      if (initial.cancelRequested) {
        this.jobs.acknowledgeCancellation(jobId, this.workerId, lease.fencingToken);
        return { status: "cancelled", jobId, recoveredLeases, expiredDeadlines };
      }

      const result = await handler({
        job: lease.job,
        signal: abortController.signal,
        assertAuthority: () => {
          this.assertAuthority(jobId, lease.fencingToken, abortController.signal);
        },
        commitWithAuthority: <T>(operation: (db: KnowledgeDatabase) => T): T => {
          if (abortController.signal.aborted) {
            throw new Error(`Job ${jobId} business commit rejected stale, expired, cancelled, or non-owner lease`);
          }
          return this.jobs.commitWithAuthority(jobId, this.workerId, lease.fencingToken, operation);
        },
      });
      if (heartbeatFailure !== undefined) {
        return { status: "lost-lease", jobId, recoveredLeases, expiredDeadlines };
      }

      const current = this.jobs.get(jobId);
      if (current.cancelRequested || abortController.signal.aborted) {
        this.jobs.acknowledgeCancellation(jobId, this.workerId, lease.fencingToken);
        return { status: "cancelled", jobId, recoveredLeases, expiredDeadlines };
      }

      this.jobs.succeed(jobId, this.workerId, lease.fencingToken, result);
      return { status: "succeeded", jobId, recoveredLeases, expiredDeadlines };
    } catch (error) {
      if (heartbeatFailure !== undefined || isLeaseRejection(error)) {
        return { status: "lost-lease", jobId, recoveredLeases, expiredDeadlines };
      }

      try {
        const current = this.jobs.get(jobId);
        if (current.cancelRequested || abortController.signal.aborted) {
          this.jobs.acknowledgeCancellation(jobId, this.workerId, lease.fencingToken);
          return { status: "cancelled", jobId, recoveredLeases, expiredDeadlines };
        }
        this.jobs.fail(jobId, this.workerId, lease.fencingToken, serializeHandlerError(error));
        return { status: "failed", jobId, recoveredLeases, expiredDeadlines };
      } catch (finishError) {
        if (isLeaseRejection(finishError)) return { status: "lost-lease", jobId, recoveredLeases, expiredDeadlines };
        throw finishError;
      }
    } finally {
      clearInterval(timer);
    }
  }

  private assertAuthority(jobId: string, fencingToken: number, signal: AbortSignal): void {
    const current = this.jobs.get(jobId);
    const leaseExpiresAt = current.leaseExpiresAt;
    const now = this.now().getTime();
    const leaseExpiry = leaseExpiresAt === null ? Number.NaN : Date.parse(leaseExpiresAt);
    if (
      signal.aborted
      || current.status !== "running"
      || current.cancelRequested
      || current.leaseOwner !== this.workerId
      || current.fencingToken !== fencingToken
      || !Number.isFinite(leaseExpiry)
      || leaseExpiry < now
    ) {
      throw new Error(`Job ${jobId} authority rejected stale, expired, cancelled, or non-owner lease`);
    }
  }

  private claimNext(): JobLease | null {
    const now = this.now().toISOString();
    const rows: unknown[] = this.db.prepare(
      `SELECT id FROM jobs
       WHERE status='queued' AND cancel_requested=0
         AND (deadline_at IS NULL OR deadline_at>?)
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
    ).all(now, this.candidateLimit);

    for (const row of rows) {
      const jobId = rowId(row);
      try {
        return this.jobs.claim(jobId, this.workerId, this.leaseMs);
      } catch (error) {
        if (isClaimRace(error)) continue;
        throw error;
      }
    }
    return null;
  }

  private recoverExpiredLeases(): number {
    const now = this.now().toISOString();
    const rows: unknown[] = this.db.prepare(
      `SELECT id, fencing_token FROM jobs
       WHERE status='running' AND lease_expires_at IS NOT NULL AND lease_expires_at<?
       ORDER BY lease_expires_at ASC, id ASC
       LIMIT ?`,
    ).all(now, this.recoveryLimit);

    let recovered = 0;
    for (const row of rows) {
      const record = requireRecord(row, "expired lease row");
      const jobId = requireString(record, "id");
      const fencingToken = requirePositiveInteger(record, "fencing_token");
      try {
        this.jobs.recoverExpiredLease(jobId, fencingToken);
        recovered += 1;
      } catch (error) {
        if (isRecoveryRace(error)) continue;
        throw error;
      }
    }
    return recovered;
  }

  private failExpiredQueuedDeadlines(): number {
    const now = this.now().toISOString();
    const errorJson = JSON.stringify({ code: "DEADLINE_EXPIRED", message: "Job deadline expired before claim" });
    const result = this.db.prepare(
      `UPDATE jobs SET status='failed', error_json=?, updated_at=?
       WHERE status='queued' AND cancel_requested=0 AND deadline_at IS NOT NULL AND deadline_at<=?`,
    ).run(errorJson, now, now);
    return Number(result.changes);
  }
}

function serializeHandlerError(error: unknown): Record<string, string> {
  if (error instanceof Error) return { name: error.name, message: bounded(error.message, 4_096) };
  return { name: "Error", message: bounded(String(error), 4_096) };
}

function bounded(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

function rowId(row: unknown): string {
  return requireString(requireRecord(row, "queued job row"), "id");
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${name} is invalid`);
  return Object.fromEntries(Object.entries(value));
}

function requireString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is invalid`);
  return value;
}

function requirePositiveInteger(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${key} is invalid`);
  return value;
}

function nonEmpty(value: string, name: string): string {
  const result = value.trim();
  if (result.length === 0) throw new TypeError(`${name} must be non-empty`);
  return result;
}

function positiveDuration(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 10 * 60 * 1000) throw new TypeError(`${name} is invalid`);
  return value;
}

function boundedLimit(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000) throw new TypeError(`${name} is invalid`);
  return value;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isClaimRace(error: unknown): boolean {
  const text = message(error);
  return text.includes("not claimable") || text.includes("claim lost a race") || text.includes("deadline has expired");
}

function isRecoveryRace(error: unknown): boolean {
  const text = message(error);
  return text.includes("does not have the expected expired lease") || text.includes("lease recovery lost a race");
}

function isLeaseRejection(error: unknown): boolean {
  const text = message(error);
  return text.includes("stale")
    || text.includes("expired")
    || text.includes("non-owner")
    || text.includes("attempt record did not match fencing token");
}
