import { describe, expect, it } from "vitest";

import { KNOWLEDGE_SCHEMA_VERSION, withTransaction } from "./database.js";
import { applyMigrations, type MigrationDatabase } from "./migrations.js";

class FakeDatabase implements MigrationDatabase {
  userVersion = 0;
  readonly execLog: string[] = [];
  failOn: string | undefined;
  private transactionStartVersion = 0;

  exec(sql: string): void {
    this.execLog.push(sql);
    if (sql === "BEGIN IMMEDIATE") this.transactionStartVersion = this.userVersion;
    if (this.failOn && sql.includes(this.failOn)) throw new Error("injected failure");
    const version = /PRAGMA user_version = (\d+)/.exec(sql)?.[1];
    if (version) this.userVersion = Number(version);
    if (sql === "ROLLBACK") this.userVersion = this.transactionStartVersion;
  }

  prepare(sql: string) {
    if (sql !== "PRAGMA user_version") throw new Error(`unexpected SQL: ${sql}`);
    return {
      get: () => ({ user_version: this.userVersion }),
      run: () => ({}),
    };
  }
}

describe("Knowledge database migrations", () => {
  it("creates the initial evidence-core schema then applies the import-job durability migration", () => {
    const db = new FakeDatabase();
    applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);

    expect(db.userVersion).toBe(KNOWLEDGE_SCHEMA_VERSION);
    expect(db.execLog[0]).toBe("BEGIN IMMEDIATE");
    const schema = db.execLog[1] ?? "";
    for (const table of [
      "installations",
      "knowledge_workspaces",
      "sources",
      "source_versions",
      "parsed_artifacts",
      "index_builds",
      "chunks",
      "evidence",
      "jobs",
      "job_attempts",
    ]) {
      expect(schema).toContain(`CREATE TABLE ${table}`);
    }
    const importMigration = db.execLog.find((sql) => sql.includes("idempotency_key")) ?? "";
    expect(importMigration).toContain("cancel_requested");
    expect(importMigration).toContain("result_json");
    expect(importMigration).toContain("jobs_workspace_kind_idempotency_idx");
    expect(db.execLog.at(-1)).toBe("COMMIT");
  });

  it("upgrades an existing schema-v1 database without replaying the initial migration", () => {
    const db = new FakeDatabase();
    db.userVersion = 1;
    applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
    expect(db.userVersion).toBe(2);
    expect(db.execLog.some((sql) => sql.includes("CREATE TABLE installations"))).toBe(false);
    expect(db.execLog.some((sql) => sql.includes("idempotency_key"))).toBe(true);
  });

  it("is idempotent when the database is already current", () => {
    const db = new FakeDatabase();
    db.userVersion = KNOWLEDGE_SCHEMA_VERSION;
    applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
    expect(db.execLog).toEqual([]);
  });

  it("fails closed when a database was written by a newer schema", () => {
    const db = new FakeDatabase();
    db.userVersion = KNOWLEDGE_SCHEMA_VERSION + 1;
    expect(() => applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/newer than supported/);
    expect(db.execLog).toEqual([]);
  });

  it("rolls back a failed migration and preserves the previously committed schema version", () => {
    const initialFailure = new FakeDatabase();
    initialFailure.failOn = "CREATE TABLE installations";
    expect(() => applyMigrations(initialFailure, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/migration 1/);
    expect(initialFailure.userVersion).toBe(0);

    const upgradeFailure = new FakeDatabase();
    upgradeFailure.userVersion = 1;
    upgradeFailure.failOn = "idempotency_key";
    expect(() => applyMigrations(upgradeFailure, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/migration 2/);
    expect(upgradeFailure.userVersion).toBe(1);
  });
});

describe("withTransaction", () => {
  it("commits successful operations", () => {
    const db = new FakeDatabase();
    expect(withTransaction(db, () => 42)).toBe(42);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
  });

  it("rolls back failed operations and preserves their error", () => {
    const db = new FakeDatabase();
    const failure = new Error("domain failure");
    expect(() => withTransaction(db, () => { throw failure; })).toThrow(failure);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
  });
});