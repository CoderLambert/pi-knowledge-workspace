import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { IndexBuildRetention } from "./indexBuildRetention.js";

interface RunStep { changes: number; lastInsertRowid: number }

class ScriptedDatabase implements KnowledgeDatabase {
  readonly execLog: string[] = [];
  readonly sqlLog: string[] = [];
  getRows: unknown[] = [];
  allRows: unknown[][] = [];
  runRows: RunStep[] = [];

  exec(sql: string): void { this.execLog.push(sql); }
  close(): void { return undefined; }
  pragma(): unknown { return undefined; }
  prepare(sql: string): SqliteStatement {
    this.sqlLog.push(sql);
    return {
      get: () => this.getRows.shift(),
      all: () => this.allRows.shift() ?? [],
      run: () => this.runRows.shift() ?? { changes: 1, lastInsertRowid: 0 },
    };
  }
}

const NOW = "2026-09-09T06:00:00.000Z";

function pinRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "pin-1",
    index_build_id: "build-a",
    owner_type: "query",
    owner_id: "query-1",
    lease_expires_at: "2026-09-09T06:00:30.000Z",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function retention(db: ScriptedDatabase): IndexBuildRetention {
  return new IndexBuildRetention(db, {
    now: () => new Date(NOW),
    createId: () => "pin-1",
  });
}

describe("IndexBuildRetention", () => {
  it("acquires the currently published active build and pins it inside one transaction", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      { id: "build-a" },
      undefined,
      pinRow(),
    ];

    const lease = retention(db).acquireActiveLease("kw-1", "query", "query-1", 30_000);

    expect(lease.indexBuildId).toBe("build-a");
    expect(lease.pin.leaseExpiresAt).toBe("2026-09-09T06:00:30.000Z");
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
    const activeLookup = db.sqlLog.find((sql) => sql.includes("active_index_build_id")) ?? "";
    expect(activeLookup).toContain("ib.status='active'");
    expect(activeLookup).toContain("ib.published_at IS NOT NULL");
  });

  it("supports durable pins with no expiry for future saved-note/answer ownership", () => {
    const db = new ScriptedDatabase();
    db.getRows = [undefined, pinRow({ owner_type: "saved-note", owner_id: "note-1", lease_expires_at: null })];

    const pin = retention(db).pin("build-a", "saved-note", "note-1");

    expect(pin.leaseExpiresAt).toBeNull();
    const insert = db.sqlLog.find((sql) => sql.includes("INSERT INTO index_build_pins")) ?? "";
    expect(insert).toContain("lease_expires_at");
  });

  it("renews only a still-live leased pin and refuses durable/expired pins", () => {
    const db = new ScriptedDatabase();
    db.runRows = [{ changes: 1, lastInsertRowid: 0 }];
    db.getRows = [pinRow({ lease_expires_at: "2026-09-09T06:01:00.000Z" })];

    const renewed = retention(db).renew("pin-1", 60_000);
    expect(renewed.leaseExpiresAt).toBe("2026-09-09T06:01:00.000Z");
    const sql = db.sqlLog[0] ?? "";
    expect(sql).toContain("lease_expires_at IS NOT NULL");
    expect(sql).toContain("lease_expires_at>?");
  });

  it("cleans only expired leased pins in a bounded scan", () => {
    const db = new ScriptedDatabase();
    db.allRows = [[{ id: "expired-1" }, { id: "expired-2" }]];
    db.runRows = [
      { changes: 1, lastInsertRowid: 0 },
      { changes: 1, lastInsertRowid: 0 },
    ];

    expect(retention(db).cleanupExpiredPins(10)).toBe(2);
    expect(db.sqlLog[0]).toContain("lease_expires_at<=?");
    expect(db.sqlLog[0]).toContain("LIMIT ?");
  });

  it("GC deletes only retained, non-active builds with no live/durable pin", () => {
    const db = new ScriptedDatabase();
    db.allRows = [[{ id: "build-old" }]];
    db.getRows = [{ eligible: 1 }];
    db.runRows = [
      { changes: 3, lastInsertRowid: 0 },
      { changes: 3, lastInsertRowid: 0 },
      { changes: 1, lastInsertRowid: 0 },
    ];

    const deleted = retention(db).gcRetained("kw-1", 5);

    expect(deleted).toEqual(["build-old"]);
    const candidateSql = db.sqlLog[0] ?? "";
    expect(candidateSql).toContain("ib.status='retained'");
    expect(candidateSql).toContain("kw.active_index_build_id<>ib.id");
    expect(candidateSql).toContain("p.lease_expires_at IS NULL OR p.lease_expires_at>?");
    expect(db.sqlLog.some((sql) => sql.includes("DELETE FROM chunk_fts"))).toBe(true);
    expect(db.sqlLog.some((sql) => sql.includes("DELETE FROM chunks"))).toBe(true);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
  });

  it("does not delete SourceVersion, ParsedArtifact or Evidence history during IndexBuild GC", () => {
    const db = new ScriptedDatabase();
    db.allRows = [[{ id: "build-old" }]];
    db.getRows = [{ eligible: 1 }];
    db.runRows = [
      { changes: 1, lastInsertRowid: 0 },
      { changes: 1, lastInsertRowid: 0 },
      { changes: 1, lastInsertRowid: 0 },
    ];

    retention(db).gcRetained("kw-1");

    expect(db.sqlLog.some((sql) => /DELETE FROM (sources|source_versions|parsed_artifacts|evidence)/.test(sql))).toBe(false);
  });
});
