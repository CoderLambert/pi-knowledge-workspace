import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { KNOWLEDGE_SCHEMA_VERSION, openKnowledgeRuntimeDatabase, withTransaction } from "./database.js";
import { applyMigrations, type MigrationDatabase } from "./migrations.js";

class FakeDatabase implements MigrationDatabase {
  userVersion = 0;
  readonly execLog: string[] = [];
  failOn: string | undefined;
  private transactionStartVersion = 0;

  exec(sql: string): void {
    this.execLog.push(sql);
    if (sql === "BEGIN IMMEDIATE") this.transactionStartVersion = this.userVersion;
    if (this.failOn !== undefined && sql.includes(this.failOn)) throw new Error("injected failure");
    const version = /PRAGMA user_version = (\d+)/.exec(sql)?.[1];
    if (version !== undefined) this.userVersion = Number(version);
    if (sql === "ROLLBACK") this.userVersion = this.transactionStartVersion;
  }

  prepare(sql: string) {
    if (sql !== "PRAGMA user_version") throw new Error(`unexpected SQL: ${sql}`);
    return { get: () => ({ user_version: this.userVersion }), run: () => ({}) };
  }
}

describe("Knowledge database migrations", () => {
  it("opens the production service database with the bundled SQLite runtime", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "knowledge-runtime-db-"));
    try {
      const db = openKnowledgeRuntimeDatabase(path.join(root, "knowledge.sqlite"));
      expect(db.pragma("user_version", { simple: true })).toBe(KNOWLEDGE_SCHEMA_VERSION);
      db.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates Evidence Core and advances through IndexBuild pin/lease retention", () => {
    const db = new FakeDatabase();
    applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
    expect(db.userVersion).toBe(KNOWLEDGE_SCHEMA_VERSION);
    expect(db.execLog[0]).toBe("BEGIN IMMEDIATE");

    const schema = db.execLog[1] ?? "";
    for (const table of ["installations", "knowledge_workspaces", "sources", "source_versions", "parsed_artifacts", "index_builds", "chunks", "evidence", "jobs", "job_attempts"]) {
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
    expect(ftsMigration).toContain("CREATE VIRTUAL TABLE chunk_fts USING fts5");
    expect(ftsMigration).toContain("tokenize = 'unicode61'");

    const jobMigration = db.execLog.find((sql) => sql.includes("lease_expires_at")) ?? "";
    expect(jobMigration).toContain("fencing_token");
    expect(jobMigration).toContain("deadline_at");
    expect(jobMigration).toContain("jobs_status_lease_idx");

    const publicationMigration = db.execLog.find((sql) => sql.includes("index_publication_migration_guard")) ?? "";
    expect(publicationMigration).toContain("active_index_build_id");
    expect(publicationMigration).toContain("index_generation");
    expect(publicationMigration).toContain("base_generation");
    expect(publicationMigration).toContain("published_at");

    const pinMigration = db.execLog.find((sql) => sql.includes("CREATE TABLE index_build_pins")) ?? "";
    expect(pinMigration).toContain("index_build_id");
    expect(pinMigration).toContain("owner_type");
    expect(pinMigration).toContain("owner_id");
    expect(pinMigration).toContain("lease_expires_at");
    expect(pinMigration).toContain("ON DELETE CASCADE");
    expect(pinMigration).toContain("index_build_pins_build_expiry_idx");

    const reliableKnowledgeMigration = db.execLog.find((sql) => sql.includes("knowledge_publications")) ?? "";
    expect(reliableKnowledgeMigration).toContain("parser_fingerprint");
    expect(reliableKnowledgeMigration).toContain("interpretation_config_sha256");
    expect(reliableKnowledgeMigration).toContain("index_build_selections");
    expect(reliableKnowledgeMigration).toContain("active_knowledge_publication_id");
    expect(reliableKnowledgeMigration).toContain("active_publication_migration_guard");

    const groundedAskMigration = db.execLog.find((sql) => sql.includes("CREATE TABLE generation_runs")) ?? "";
    expect(groundedAskMigration).toContain("CREATE TABLE delivered_evidence");
    expect(groundedAskMigration).toContain("CREATE TABLE answers");
    expect(groundedAskMigration).toContain("CREATE TABLE citation_refs");
    expect(groundedAskMigration).toContain("generation_runs_frozen_scope");
    expect(groundedAskMigration).toContain("retained_evidence_immutable");
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
    expect(db.execLog.some((sql) => sql.includes("index_publication_migration_guard"))).toBe(true);
    expect(db.execLog.some((sql) => sql.includes("CREATE TABLE index_build_pins"))).toBe(true);
    expect(db.execLog.some((sql) => sql.includes("knowledge_publications"))).toBe(true);
    expect(db.execLog.some((sql) => sql.includes("CREATE TABLE generation_runs"))).toBe(true);
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
    expect(() => {
      applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
    }).toThrow(/newer than supported/);
    expect(db.execLog).toEqual([]);
  });

  it("rolls back failed migrations and preserves the previously committed schema version", () => {
    const cases: [number, string, number][] = [
      [0, "CREATE TABLE installations", 1],
      [1, "idempotency_key", 2],
      [2, "evidence_migration_guard", 3],
      [3, "chunks_migration_guard", 4],
      [4, "lease_expires_at", 5],
      [5, "index_publication_migration_guard", 6],
      [6, "CREATE TABLE index_build_pins", 7],
      [7, "reliable_knowledge_migration_guard", 8],
      [8, "CREATE TABLE generation_runs", 9],
    ];
    for (const [version, failOn, migration] of cases) {
      const db = new FakeDatabase();
      db.userVersion = version;
      db.failOn = failOn;
      expect(() => {
        applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
      }).toThrow(new RegExp(`migration ${String(migration)}`));
      expect(db.userVersion).toBe(version);
    }
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
    expect(() => {
      withTransaction(db, () => { throw failure; });
    }).toThrow(failure);
    expect(db.execLog).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
  });
});
