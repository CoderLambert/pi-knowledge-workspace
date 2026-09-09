import { describe, expect, it } from "vitest";

import type { KnowledgeDatabase, SqliteStatement } from "./database.js";
import { IndexBuildPublicationConflictError, IndexBuildPublisher } from "./indexBuildPublication.js";

interface RunStep { changes: number; lastInsertRowid: number }

class ScriptedDatabase implements KnowledgeDatabase {
  readonly execLog: string[] = [];
  readonly sqlLog: string[] = [];
  getRows: unknown[] = [];
  runRows: RunStep[] = [];

  exec(sql: string): void { this.execLog.push(sql); }
  close(): void {}
  pragma(): unknown { return undefined; }
  prepare(sql: string): SqliteStatement {
    this.sqlLog.push(sql);
    return {
      get: () => this.getRows.shift(),
      all: () => [],
      run: () => this.runRows.shift() ?? { changes: 1, lastInsertRowid: 0 },
    };
  }
}

const NOW = "2026-09-09T05:00:00.000Z";

function build(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "build-b",
    knowledge_workspace_id: "kw-1",
    strategy: "fts5-v1",
    status: "staging",
    base_generation: 0,
    base_active_build_id: null,
    created_at: NOW,
    validated_at: null,
    published_at: null,
    ...overrides,
  };
}

function publisher(db: ScriptedDatabase): IndexBuildPublisher {
  return new IndexBuildPublisher(db, {
    now: () => new Date(NOW),
    createId: () => "build-b",
  });
}

describe("IndexBuildPublisher", () => {
  it("creates staging work from the exact active-build generation snapshot", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      { index_generation: 7, active_index_build_id: "build-a" },
      build({ base_generation: 7, base_active_build_id: "build-a" }),
    ];

    const result = publisher(db).createStaging("kw-1", "fts5-v1");

    expect(result.baseGeneration).toBe(7);
    expect(result.baseActiveBuildId).toBe("build-a");
    const insert = db.sqlLog.find((sql) => sql.includes("INSERT INTO index_builds")) ?? "";
    expect(insert).toContain("base_generation");
    expect(insert).toContain("base_active_build_id");
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
  });

  it("requires explicit validation before publication", () => {
    const db = new ScriptedDatabase();
    db.getRows = [build()];

    expect(() => publisher(db).publish("build-b")).toThrow(/must be validated/);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
    expect(db.sqlLog.some((sql) => sql.includes("SET active_index_build_id"))).toBe(false);
  });

  it("publishes by CAS on generation and previous active build, then retains the old build", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      build({ status: "validated", base_generation: 4, base_active_build_id: "build-a", validated_at: NOW }),
      { index_generation: 4, active_index_build_id: "build-a" },
      build({ status: "active", base_generation: 4, base_active_build_id: "build-a", validated_at: NOW, published_at: NOW }),
    ];
    db.runRows = [
      { changes: 1, lastInsertRowid: 0 },
      { changes: 1, lastInsertRowid: 0 },
      { changes: 1, lastInsertRowid: 0 },
    ];

    const result = publisher(db).publish("build-b");

    expect(result.status).toBe("active");
    const workspaceCas = db.sqlLog.find((sql) => sql.includes("SET active_index_build_id")) ?? "";
    expect(workspaceCas).toContain("index_generation=?");
    expect(workspaceCas).toContain("active_index_build_id IS NULL");
    expect(db.sqlLog.some((sql) => sql.includes("status='retained'"))).toBe(true);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
  });

  it("rejects an out-of-order build after another rebuild advances the generation", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      build({ id: "build-c", status: "validated", base_generation: 4, base_active_build_id: "build-a", validated_at: NOW }),
      { index_generation: 5, active_index_build_id: "build-b" },
    ];

    expect(() => publisher(db).publish("build-c")).toThrow(IndexBuildPublicationConflictError);
    expect(db.sqlLog.some((sql) => sql.includes("SET active_index_build_id"))).toBe(false);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
  });

  it("fails closed when the compare-and-swap loses a race after the precheck", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      build({ status: "validated", validated_at: NOW }),
      { index_generation: 0, active_index_build_id: null },
    ];
    db.runRows = [{ changes: 0, lastInsertRowid: 0 }];

    expect(() => publisher(db).publish("build-b")).toThrow(/compare-and-swap race/);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
  });

  it("returns the Workspace active build without interpreting latest-created as active", () => {
    const db = new ScriptedDatabase();
    db.getRows = [
      { index_generation: 9, active_index_build_id: "build-z" },
      build({ id: "build-z", status: "active", base_generation: 8, published_at: NOW }),
    ];

    const result = publisher(db).active("kw-1");
    expect(result?.id).toBe("build-z");
    expect(result?.status).toBe("active");
  });
});
