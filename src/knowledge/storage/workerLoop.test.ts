import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { DurableJobStore, type DurableJob, type JobLease } from "./durableJobs.js";
import { DurableJobWorker, type DurableJobHandler } from "./workerLoop.js";

const NOW = "2026-09-09T04:00:00.000Z";

class ScriptedDatabase implements KnowledgeDatabase {
  allRows: unknown[][] = [];
  runRows: { changes: number; lastInsertRowid: number }[] = [];
  sqlLog: string[] = [];
  exec(): void { /* no-op test double */ }
  close(): void { /* no-op test double */ }
  pragma(): unknown { return undefined; }
  prepare(sql: string): SqliteStatement {
    this.sqlLog.push(sql);
    return {
      get: () => undefined,
      all: () => this.allRows.shift() ?? [],
      run: () => this.runRows.shift() ?? { changes: 0, lastInsertRowid: 0 },
    };
  }
}

function job(overrides: Partial<DurableJob> = {}): DurableJob {
  return {
    id: "job-1",
    knowledgeWorkspaceId: "kw-1",
    kind: "import",
    status: "running",
    payload: { path: "guide.md" },
    idempotencyKey: "idem-1",
    attempt: 1,
    leaseOwner: "worker-a",
    leaseExpiresAt: "2026-09-09T04:00:30.000Z",
    heartbeatAt: NOW,
    fencingToken: 1,
    deadlineAt: null,
    cancelRequested: false,
    result: null,
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

class FakeStore extends DurableJobStore {
  current = job();
  claims: string[] = [];
  recovered: [string, number][] = [];
  heartbeats = 0;
  succeeded: unknown[] = [];
  failed: unknown[] = [];
  cancelled = 0;
  claimFailure: Error | undefined;
  claimFailuresRemaining = 0;
  completionFailure: Error | undefined;

  override get(): DurableJob { return this.current; }
  override claim(jobId: string, workerId: string): JobLease {
    if (this.claimFailuresRemaining > 0) {
      this.claimFailuresRemaining -= 1;
      throw new Error(`Job ${jobId} claim lost a race`);
    }
    this.claims.push(jobId);
    if (this.claimFailure !== undefined) throw this.claimFailure;
    this.current = job({ id: jobId, leaseOwner: workerId });
    return { job: this.current, workerId, fencingToken: this.current.fencingToken };
  }
  override recoverExpiredLease(jobId: string, token: number): DurableJob {
    this.recovered.push([jobId, token]);
    return job({ id: jobId, status: "queued", leaseOwner: null, leaseExpiresAt: null, heartbeatAt: null, fencingToken: token });
  }
  override heartbeat(): DurableJob { this.heartbeats += 1; return this.current; }
  override succeed(_jobId: string, _worker: string, _token: number, result: unknown): DurableJob {
    if (this.completionFailure !== undefined) throw this.completionFailure;
    this.succeeded.push(result);
    this.current = job({ status: "succeeded", result });
    return this.current;
  }
  override fail(_jobId: string, _worker: string, _token: number, error: unknown): DurableJob {
    if (this.completionFailure !== undefined) throw this.completionFailure;
    this.failed.push(error);
    this.current = job({ status: "failed", error });
    return this.current;
  }
  override acknowledgeCancellation(): DurableJob {
    this.cancelled += 1;
    this.current = job({ status: "cancelled", cancelRequested: true });
    return this.current;
  }
}

function worker(db: ScriptedDatabase, store: FakeStore, handlers: ReadonlyMap<string, DurableJobHandler>): DurableJobWorker {
  return new DurableJobWorker(db, store, handlers, {
    workerId: "worker-a",
    leaseMs: 30_000,
    heartbeatMs: 10_000,
    now: () => new Date(NOW),
  });
}

describe("DurableJobWorker", () => {
  it("recovers expired leases, expires queued deadlines, then reports idle", async () => {
    const db = new ScriptedDatabase();
    db.allRows = [[{ id: "stale-1", fencing_token: 3 }], []];
    db.runRows = [{ changes: 2, lastInsertRowid: 0 }];
    const store = new FakeStore(db);

    const result = await worker(db, store, new Map()).runOnce();

    expect(result).toEqual({ status: "idle", recoveredLeases: 1, expiredDeadlines: 2 });
    expect(store.recovered).toEqual([["stale-1", 3]]);
    expect(db.sqlLog.some((sql) => sql.includes("deadline_at<=?"))).toBe(true);
  });

  it("claims one queued job and commits handler success through the fenced store", async () => {
    const db = new ScriptedDatabase();
    db.allRows = [[], [{ id: "job-1" }]];
    db.runRows = [{ changes: 0, lastInsertRowid: 0 }];
    const store = new FakeStore(db);
    const handlers = new Map<string, DurableJobHandler>([["import", ({ job: running }) => Promise.resolve({ sourceId: running.id })]]);

    const result = await worker(db, store, handlers).runOnce();

    expect(result.status).toBe("succeeded");
    expect(store.claims).toEqual(["job-1"]);
    expect(store.succeeded).toEqual([{ sourceId: "job-1" }]);
  });

  it("fails a claimed job explicitly when no handler is registered", async () => {
    const db = new ScriptedDatabase();
    db.allRows = [[], [{ id: "job-1" }]];
    db.runRows = [{ changes: 0, lastInsertRowid: 0 }];
    const store = new FakeStore(db);

    const result = await worker(db, store, new Map()).runOnce();

    expect(result.status).toBe("failed");
    expect(store.failed).toHaveLength(1);
    expect(store.failed[0]).toMatchObject({ code: "UNSUPPORTED_JOB_KIND" });
  });

  it("acknowledges cooperative cancellation after a handler returns", async () => {
    const db = new ScriptedDatabase();
    db.allRows = [[], [{ id: "job-1" }]];
    db.runRows = [{ changes: 0, lastInsertRowid: 0 }];
    const store = new FakeStore(db);
    const handlers = new Map<string, DurableJobHandler>([["import", () => {
      store.current = job({ cancelRequested: true });
      return Promise.resolve({ ignored: true });
    }]]);

    const result = await worker(db, store, handlers).runOnce();

    expect(result.status).toBe("cancelled");
    expect(store.cancelled).toBe(1);
    expect(store.succeeded).toEqual([]);
  });

  it("does not retry a terminal write after the lease/fencing token is lost", async () => {
    const db = new ScriptedDatabase();
    db.allRows = [[], [{ id: "job-1" }]];
    db.runRows = [{ changes: 0, lastInsertRowid: 0 }];
    const store = new FakeStore(db);
    store.completionFailure = new Error("Job job-1 completion rejected stale, expired, cancelled, or non-owner lease");
    const handlers = new Map<string, DurableJobHandler>([["import", () => Promise.resolve({ ok: true })]]);

    const result = await worker(db, store, handlers).runOnce();

    expect(result.status).toBe("lost-lease");
    expect(store.succeeded).toEqual([]);
  });

  it("skips a claim race and tries the next queued candidate", async () => {
    const db = new ScriptedDatabase();
    db.allRows = [[], [{ id: "raced" }, { id: "job-1" }]];
    db.runRows = [{ changes: 0, lastInsertRowid: 0 }];
    const store = new FakeStore(db);
    store.claimFailuresRemaining = 1;
    const handlers = new Map<string, DurableJobHandler>([["import", () => Promise.resolve({ ok: true })]]);

    const result = await worker(db, store, handlers).runOnce();

    expect(result.status).toBe("succeeded");
    expect(store.claims).toEqual(["job-1"]);
  });
});
