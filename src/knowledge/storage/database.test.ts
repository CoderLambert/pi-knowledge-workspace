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
  it("creates Evidence Core and advances through the durable-job schema", () => {
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

    const evidenceMigration = db.execLog.find((sql) => sql.includes("evidence_migration_guard")) ?? "";
    expect(evidenceMigration).toContain("parsed_artifact_id");
    expect(evidenceMigration).toContain("exact_quote");
    expect(evidenceMigration).toContain("quote_hash");
    expect(evidenceMigration).toContain("locator_snapshot");

    const ftsMigration = db.execLog.find((sql) => sql.includes("chunks_migration_guard")) ?? "";
    expect(ftsMigration).toContain("index_build_id");
    expect(ftsMigration).toContain("source_version_id");
    expect(ftsMigration).toContain("start_byte");
    expect(ftsMigration).toContain("end_byte");
    expect(ftsMigration).toContain("CREATE VIRTUAL TABLE chunk_fts USING fts5");
    expect(ftsMigration).toContain("tokenize = 'unicode61'");

    const jobMigration = db.execLog.find((sql) => sql.includes("lease_expires_at")) ?? "";
    expect(jobMigration).toContain("attempt INTEGER NOT NULL DEFAULT 0");
    expect(jobMigration).toContain("lease_owner");
    expect(jobMigration).toContain("heartbeat_at");
    expect(jobMigration).toContain("fencing_token");
    expect(jobMigration).toContain("deadline_at");
    expect(jobMigration).toContain("error_json");
    expect(jobMigration).toContain("jobs_status_lease_idx");
    expect(db.execLog.at(-1)).toBe("COMMIT");
  });

  it("upgrades an existing schema-v1 database without replaying the initial migration", () => {
    const db = new FakeDatabase();
    db.userVersion = 1;
    applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
    expect(db.userVersion).toBe(KNOWLEDGE_SCHEMA_VERSION);
    expect(db.execLog.some((sql) => sql.includes("CREATE TABLE installations"))).toBe(false);
    expect(db.execLog.some((sql) => sql.includes("idempotency_key"))).toBe(true);
    expect(db.execLog.some((sql) => sql.includes("evidence_migration_guard"))).toBe(true);
    expect(db.execLog.some((sql) => sql.includes("chunks_migration_guard"))).toBe(true);
    expect(db.execLog.some((sql) => sql.includes("lease_expires_at"))).toBe(true);
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

  it("rolls back failed migrations and preserves the previously committed schema version", () => {
    const initialFailure = new FakeDatabase();
    initialFailure.failOn = "CREATE TABLE installations";
    expect(() => applyMigrations(initialFailure, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/migration 1/);
    expect(initialFailure.userVersion).toBe(0);

    const importFailure = new FakeDatabase();
    importFailure.userVersion = 1;
    importFailure.failOn = "idempotency_key";
    expect(() => applyMigrations(importFailure, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/migration 2/);
    expect(importFailure.userVersion).toBe(1);

    const evidenceFailure = new FakeDatabase();
    evidenceFailure.userVersion = 2;
    evidenceFailure.failOn = "evidence_migration_guard";
    expect(() => applyMigrations(evidenceFailure, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/migration 3/);
    expect(evidenceFailure.userVersion).toBe(2);

    const ftsFailure = new FakeDatabase();
    ftsFailure.userVersion = 3;
    ftsFailure.failOn = "chunks_migration_guard";
    expect(() => applyMigrations(ftsFailure, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/migration 4/);
    expect(ftsFailure.userVersion).toBe(3);

    const jobFailure = new FakeDatabase();
    jobFailure.userVersion = 4;
    jobFailure.failOn = "lease_expires_at";
    expect(() => applyMigrations(jobFailure, KNOWLEDGE_SCHEMA_VERSION)).toThrow(/migration 5/);
    expect(jobFailure.userVersion).toBe(4);
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
    expect(() =>
      withTransaction(db, () => {
        throw failure;
      }),
    ).toThrow(failure);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
  });
});
