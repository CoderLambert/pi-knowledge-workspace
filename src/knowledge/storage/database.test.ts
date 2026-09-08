import { describe, expect, it } from "vitest";

import { KNOWLEDGE_SCHEMA_VERSION, withTransaction } from "./database.js";
import { applyMigrations, type MigrationDatabase } from "./migrations.js";

class FakeDatabase implements MigrationDatabase {
  userVersion = 0;
  readonly execLog: string[] = [];
  failOn: string | undefined;

  exec(sql: string): void {
    this.execLog.push(sql);
    if (this.failOn && sql.includes(this.failOn)) throw new Error("injected failure");
    const version = /PRAGMA user_version = (\d+)/.exec(sql)?.[1];
    if (version) this.userVersion = Number(version);
    if (sql === "ROLLBACK") this.userVersion = 0;
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
  it("creates the complete initial evidence-core schema in one ordered transaction", () => {
    const db = new FakeDatabase();
    applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);

    expect(db.userVersion).toBe(1);
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
    expect(db.execLog.at(-1)).toBe("COMMIT");
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

  it("rolls back a failed migration and does not advance schema version", () => {
    const db = new FakeDatabase();
    db.failOn = "CREATE TABLE installations";
    expect(() => applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/migration 1/);
    expect(db.execLog).toContain("ROLLBACK");
    expect(db.userVersion).toBe(0);
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
