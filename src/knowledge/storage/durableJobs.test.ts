import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { DurableJobStore } from "./durableJobs.js";

interface RunStep { changes: number; lastInsertRowid: number }

class ScriptedDatabase implements KnowledgeDatabase {
  readonly execLog: string[] = [];
  readonly sqlLog: string[] = [];
  readonly paramsLog: unknown[][] = [];
  getRows: unknown[] = [];
  runRows: RunStep[] = [];

  exec(sql: string): void { this.execLog.push(sql); }
  close(): void {}
  pragma(): unknown { return undefined; }
  prepare(sql: string): SqliteStatement {
    this.sqlLog.push(sql);
    return {
      get: (...params: unknown[]) => {
        this.paramsLog.push(params);
        return this.getRows.shift();
      },
      run: (...params: unknown[]) => {
        this.paramsLog.push(params);
        return this.runRows.shift() ?? { changes: 1, lastInsertRowid: 0 };
      },
      all: () => [],
    };
  }
}

const NOW = "2026-09-09T03:00:00.000Z";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "job-1",
    knowledge_workspace_id: "kw-1",
    kind: "import",
    status: "queued",
    payload_json: JSON.stringify({ path: "guide.md" }),
    idempotency_key: "idem-1",
    attempt: 0,
    lease_owner: null,
    lease_expires_at: null,
    heartbeat_at: null,
    fencing_token: 0,
    deadline_at: null,
    cancel_requested: 0,
    result_json: null,
    error_json: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function store(db: ScriptedDatabase): DurableJobStore {
  let sequence = 0;
  return new DurableJobStore(db, {
    now: () => new Date(NOW),
    createId: () => `generated-${String(++sequence)}`,
  });
}

describe("DurableJobStore", () => {
  it("returns an existing Workspace/kind/idempotency job without creating a duplicate", () => {
    const db = new ScriptedDatabase();
    db.getRows = [row()];
    const job = store(db).submit({
      knowledgeWorkspaceId: "kw-1",
      kind: "import",
      payload: { path: "different.md" },
      idempotencyKey: "idem-1",
    });
    expect(job.id).toBe("job-1");
    expect(db.sqlLog.some((sql) => sql.includes("INSERT INTO jobs"))).toBe(false);
  });

  it("claims queued work by incrementing attempt/fencing token and creating an attempt record", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      row(),
      row({
        status: "running",
        attempt: 1,
        lease_owner: "worker-a",
        lease_expires_at: "2026-09-09T03:00:30.000Z",
        heartbeat_at: NOW,
        fencing_token: 1,
      }),
    ];
    db.runRows = [{ changes: 1, lastInsertRowid: 0 }, { changes: 1, lastInsertRowid: 0 }];

    const lease = store(db).claim("job-1", "worker-a", 30_000);
    expect(lease.fencingToken).toBe(1);
    expect(lease.job.attempt).toBe(1);
    expect(db.sqlLog.some((sql) => sql.includes("fencing_token=fencing_token+1"))).toBe(true);
    expect(db.sqlLog.some((sql) => sql.includes("INSERT INTO job_attempts"))).toBe(true);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
  });

  it("heartbeats only the current unexpired owner/fencing token", () => {
    const db = new ScriptedDatabase();
    db.runRows = [{ changes: 0, lastInsertRowid: 0 }];
    expect(() => store(db).heartbeat("job-1", "stale-worker", 1, 30_000)).toThrow(/stale or cancelled/);
    expect(db.sqlLog[0]).toContain("lease_owner=? AND fencing_token=?");
    expect(db.sqlLog[0]).toContain("lease_expires_at>=?");
    expect(db.sqlLog[0]).toContain("cancel_requested=0");
  });

  it("rejects stale or expired worker completion through lease/fencing compare-and-swap", () => {
    const db = new ScriptedDatabase();
    db.getRows = [row({
      status: "running",
      attempt: 2,
      lease_owner: "worker-b",
      lease_expires_at: "2026-09-09T03:00:30.000Z",
      heartbeat_at: NOW,
      fencing_token: 2,
    })];
    db.runRows = [{ changes: 0, lastInsertRowid: 0 }];

    expect(() => store(db).succeed("job-1", "worker-a", 1, { ok: true })).toThrow(/stale, expired, cancelled, or non-owner/);
    const terminalSql = db.sqlLog.find((sql) => sql.includes("SET status=?")) ?? "";
    expect(terminalSql).toContain("lease_owner=? AND fencing_token=?");
    expect(terminalSql).toContain("lease_expires_at>=?");
    expect(terminalSql).toContain("cancel_requested=0");
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
  });

  it("cancels queued work immediately but only flags running work for cooperative acknowledgement", () => {
    const queuedDb = new ScriptedDatabase();
    queuedDb.getRows = [row(), row({ status: "cancelled", cancel_requested: 1 })];
    queuedDb.runRows = [{ changes: 1, lastInsertRowid: 0 }];
    expect(store(queuedDb).requestCancel("job-1").status).toBe("cancelled");

    const runningDb = new ScriptedDatabase();
    runningDb.getRows = [
      row({ status: "running", attempt: 1, lease_owner: "worker-a", fencing_token: 1, lease_expires_at: "2026-09-09T03:00:30.000Z" }),
      row({ status: "running", attempt: 1, lease_owner: "worker-a", fencing_token: 1, lease_expires_at: "2026-09-09T03:00:30.000Z", cancel_requested: 1 }),
    ];
    runningDb.runRows = [{ changes: 1, lastInsertRowid: 0 }];
    const running = store(runningDb).requestCancel("job-1");
    expect(running.status).toBe("running");
    expect(running.cancelRequested).toBe(true);
  });

  it("requires an active unexpired cancelled lease for cancellation acknowledgement", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      row({
        status: "running", attempt: 1, lease_owner: "worker-a", fencing_token: 1,
        lease_expires_at: "2026-09-09T03:00:30.000Z", cancel_requested: 1,
      }),
      row({ status: "cancelled", attempt: 1, fencing_token: 1, cancel_requested: 1 }),
    ];
    db.runRows = [
      { changes: 1, lastInsertRowid: 0 },
      { changes: 1, lastInsertRowid: 0 },
    ];

    expect(store(db).acknowledgeCancellation("job-1", "worker-a", 1).status).toBe("cancelled");
    const terminalSql = db.sqlLog.find((sql) => sql.includes("SET status=?")) ?? "";
    expect(terminalSql).toContain("lease_expires_at>=?");
    expect(terminalSql).toContain("cancel_requested=1");
  });

  it("recovers an expired lease to queued while closing the fenced attempt", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      row({
        status: "running",
        attempt: 1,
        lease_owner: "dead-worker",
        lease_expires_at: "2026-09-09T02:59:59.000Z",
        heartbeat_at: "2026-09-09T02:59:00.000Z",
        fencing_token: 1,
      }),
      row({ status: "queued", attempt: 1, fencing_token: 1, error_json: JSON.stringify({ code: "LEASE_EXPIRED" }) }),
    ];
    db.runRows = [
      { changes: 1, lastInsertRowid: 0 },
      { changes: 1, lastInsertRowid: 0 },
    ];

    const recovered = store(db).recoverExpiredLease("job-1", 1);
    expect(recovered.status).toBe("queued");
    expect(recovered.error).toEqual({ code: "LEASE_EXPIRED" });
    expect(db.sqlLog.some((sql) => sql.includes("UPDATE job_attempts"))).toBe(true);
  });

  it("refuses to claim work after its durable deadline", () => {
    const db = new ScriptedDatabase();
    db.getRows = [row({ deadline_at: "2026-09-09T02:59:59.000Z" })];
    expect(() => store(db).claim("job-1", "worker-a", 30_000)).toThrow(/deadline has expired/);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
  });

  it("bounds durable result/error metadata before writing it", () => {
    const resultDb = new ScriptedDatabase();
    const limitedResultStore = new DurableJobStore(resultDb, { maxResultBytes: 8 });
    expect(() => limitedResultStore.succeed("job-1", "worker-a", 1, { tooLarge: true })).toThrow(/result exceeds/);
    expect(resultDb.sqlLog).toEqual([]);

    const errorDb = new ScriptedDatabase();
    const limitedErrorStore = new DurableJobStore(errorDb, { maxErrorBytes: 8 });
    expect(() => limitedErrorStore.fail("job-1", "worker-a", 1, { tooLarge: true })).toThrow(/error exceeds/);
    expect(errorDb.sqlLog).toEqual([]);
  });
});
