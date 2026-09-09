import { createRequire } from "node:module";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import { applyMigrations, type MigrationDatabase } from "./migrations.js";

export const KNOWLEDGE_SCHEMA_VERSION = 4;

export interface SqliteStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface KnowledgeDatabase extends MigrationDatabase {
  prepare(sql: string): SqliteStatement;
  close(): void;
  pragma(source: string, options?: { simple?: boolean }): unknown;
}

type DatabaseConstructor = new (filename: string) => KnowledgeDatabase;

function loadDatabaseConstructor(): DatabaseConstructor {
  const require = createRequire(import.meta.url);
  try {
    return require("better-sqlite3") as DatabaseConstructor;
  } catch (error) {
    throw new Error(
      "Knowledge SQLite requires better-sqlite3. Install the repository dependencies before starting pi-knowledge.",
      { cause: error },
    );
  }
}

export function openKnowledgeDatabase(filename: string): KnowledgeDatabase {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });

  const Database = loadDatabaseConstructor();
  const db = new Database(filename);

  try {
    db.pragma("foreign_keys = ON");
    if (filename !== ":memory:") db.pragma("journal_mode = WAL");
    applyMigrations(db, KNOWLEDGE_SCHEMA_VERSION);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function withTransaction<T>(db: MigrationDatabase, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original operation failure.
    }
    throw error;
  }
}
