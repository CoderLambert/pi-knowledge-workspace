import { createRequire } from "node:module";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { applyMigrations, type MigrationDatabase } from "./migrations.js";

export const KNOWLEDGE_SCHEMA_VERSION = 9;

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

type DatabaseConstructor = new (
  filename: string,
  options?: { readonly?: boolean; fileMustExist?: boolean },
) => KnowledgeDatabase;

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

/**
 * Opens the long-lived service database with Node's bundled SQLite driver.
 * Backup retains its existing driver-specific entry until Lifecycle Safety
 * unifies the online-backup contract across the supported Node range.
 */
export function openKnowledgeRuntimeDatabase(filename: string): KnowledgeDatabase {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new NodeSqliteKnowledgeDatabase(filename);
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

export function openKnowledgeDatabaseReadOnly(filename: string): KnowledgeDatabase {
  const Database = loadDatabaseConstructor();
  const db = new Database(filename, { readonly: true, fileMustExist: true });
  try {
    const version = db.pragma("user_version", { simple: true });
    if (version !== KNOWLEDGE_SCHEMA_VERSION) {
      throw new Error(
        `Knowledge snapshot schema ${String(version)} does not match supported schema ${String(KNOWLEDGE_SCHEMA_VERSION)}`,
      );
    }
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

class NodeSqliteKnowledgeDatabase implements KnowledgeDatabase {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): SqliteStatement {
    const statement = this.db.prepare(sql);
    return {
      run: (...params: unknown[]) => statement.run(...sqlValues(params)),
      get: (...params: unknown[]) => statement.get(...sqlValues(params)),
      all: (...params: unknown[]) => statement.all(...sqlValues(params)),
    };
  }

  close(): void {
    this.db.close();
  }

  pragma(source: string, options?: { simple?: boolean }): unknown {
    const row = this.db.prepare(`PRAGMA ${source}`).get();
    return options?.simple === true && row !== undefined ? Object.values(row)[0] : row;
  }
}

function sqlValues(values: readonly unknown[]): SQLInputValue[] {
  return values.map((value) => {
    if (
      value === null
      || typeof value === "string"
      || typeof value === "number"
      || typeof value === "bigint"
      || value instanceof Uint8Array
    ) {
      return value;
    }
    throw new TypeError("Invalid SQLite parameter");
  });
}
