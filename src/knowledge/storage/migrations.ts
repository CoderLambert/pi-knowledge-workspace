export interface MigrationDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
}

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "initial-evidence-core",
    sql: `
CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE knowledge_workspaces (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES installations(id),
  canonical_realpath TEXT NOT NULL,
  external_binding TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (installation_id, canonical_realpath)
);
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  knowledge_workspace_id TEXT NOT NULL REFERENCES knowledge_workspaces(id),
  kind TEXT NOT NULL,
  display_name TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE source_versions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  content_sha256 TEXT NOT NULL,
  blob_key TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (source_id, content_sha256)
);
CREATE TABLE parsed_artifacts (
  id TEXT PRIMARY KEY,
  source_version_id TEXT NOT NULL REFERENCES source_versions(id),
  parser_version TEXT NOT NULL,
  canonical_text_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_version_id, parser_version)
);
CREATE TABLE index_builds (
  id TEXT PRIMARY KEY,
  knowledge_workspace_id TEXT NOT NULL REFERENCES knowledge_workspaces(id),
  strategy TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  parsed_artifact_id TEXT NOT NULL REFERENCES parsed_artifacts(id),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  text TEXT NOT NULL,
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset >= start_offset),
  UNIQUE (parsed_artifact_id, ordinal)
);
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  knowledge_workspace_id TEXT NOT NULL REFERENCES knowledge_workspaces(id),
  chunk_id TEXT NOT NULL REFERENCES chunks(id),
  source_version_id TEXT NOT NULL REFERENCES source_versions(id),
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset >= start_offset),
  created_at TEXT NOT NULL
);
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  knowledge_workspace_id TEXT NOT NULL REFERENCES knowledge_workspaces(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE job_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error_json TEXT,
  UNIQUE (job_id, attempt)
);
CREATE INDEX sources_workspace_idx ON sources(knowledge_workspace_id);
CREATE INDEX source_versions_source_idx ON source_versions(source_id);
CREATE INDEX chunks_artifact_idx ON chunks(parsed_artifact_id);
CREATE INDEX evidence_workspace_idx ON evidence(knowledge_workspace_id);
CREATE INDEX jobs_workspace_status_idx ON jobs(knowledge_workspace_id, status);
`,
  },
  {
    version: 2,
    name: "durable-import-job-minimum",
    sql: `
ALTER TABLE jobs ADD COLUMN idempotency_key TEXT;
ALTER TABLE jobs ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1));
ALTER TABLE jobs ADD COLUMN result_json TEXT;
CREATE UNIQUE INDEX jobs_workspace_kind_idempotency_idx
  ON jobs(knowledge_workspace_id, kind, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
`,
  },
  {
    version: 3,
    name: "stable-evidence-byte-addressing",
    sql: `
CREATE TABLE evidence_migration_guard (
  row_count INTEGER NOT NULL CHECK (row_count = 0)
);
INSERT INTO evidence_migration_guard(row_count) SELECT COUNT(*) FROM evidence;
DROP TABLE evidence_migration_guard;
DROP TABLE evidence;
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  knowledge_workspace_id TEXT NOT NULL REFERENCES knowledge_workspaces(id),
  parsed_artifact_id TEXT NOT NULL REFERENCES parsed_artifacts(id),
  start_byte INTEGER NOT NULL CHECK (start_byte >= 0),
  end_byte INTEGER NOT NULL CHECK (end_byte > start_byte),
  exact_quote TEXT NOT NULL,
  quote_hash TEXT NOT NULL CHECK (
    length(quote_hash) = 64
    AND quote_hash = lower(quote_hash)
    AND quote_hash NOT GLOB '*[^0-9a-f]*'
  ),
  locator_snapshot TEXT NOT NULL CHECK (json_valid(locator_snapshot)),
  created_at TEXT NOT NULL
);
CREATE INDEX evidence_workspace_idx ON evidence(knowledge_workspace_id);
CREATE INDEX evidence_artifact_range_idx ON evidence(parsed_artifact_id, start_byte, end_byte);
`,
  },
  {
    version: 4,
    name: "fts5-baseline-index",
    sql: `
CREATE TABLE chunks_migration_guard (
  row_count INTEGER NOT NULL CHECK (row_count = 0)
);
INSERT INTO chunks_migration_guard(row_count) SELECT COUNT(*) FROM chunks;
DROP TABLE chunks_migration_guard;
DROP TABLE chunks;
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  index_build_id TEXT NOT NULL REFERENCES index_builds(id),
  parsed_artifact_id TEXT NOT NULL REFERENCES parsed_artifacts(id),
  source_version_id TEXT NOT NULL REFERENCES source_versions(id),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  text TEXT NOT NULL,
  start_byte INTEGER NOT NULL CHECK (start_byte >= 0),
  end_byte INTEGER NOT NULL CHECK (end_byte > start_byte),
  node_kinds_json TEXT NOT NULL CHECK (json_valid(node_kinds_json)),
  created_at TEXT NOT NULL,
  UNIQUE (index_build_id, parsed_artifact_id, ordinal)
);
CREATE INDEX chunks_artifact_idx ON chunks(parsed_artifact_id);
CREATE INDEX chunks_build_source_idx ON chunks(index_build_id, source_version_id);
CREATE VIRTUAL TABLE chunk_fts USING fts5(
  chunk_id UNINDEXED,
  knowledge_workspace_id UNINDEXED,
  source_version_id UNINDEXED,
  parsed_artifact_id UNINDEXED,
  index_build_id UNINDEXED,
  text,
  tokenize = 'unicode61'
);
`,
  },
];

function readUserVersion(db: MigrationDatabase): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version?: unknown } | undefined;
  const value = row?.user_version;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("SQLite returned an invalid PRAGMA user_version");
  }
  return value;
}

export function applyMigrations(db: MigrationDatabase, supportedVersion: number): void {
  const currentVersion = readUserVersion(db);
  if (currentVersion > supportedVersion) {
    throw new Error(
      `Knowledge database schema ${currentVersion} is newer than supported schema ${supportedVersion}; refusing to open`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    if (migration.version > supportedVersion) break;

    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Preserve the migration failure.
      }
      throw new Error(`Knowledge migration ${migration.version} (${migration.name}) failed`, { cause: error });
    }
  }

  const finalVersion = readUserVersion(db);
  if (finalVersion !== supportedVersion) {
    throw new Error(`Knowledge database schema ${finalVersion} does not match supported schema ${supportedVersion}`);
  }
}
