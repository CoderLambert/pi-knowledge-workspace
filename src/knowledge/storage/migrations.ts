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
  {
    version: 5,
    name: "durable-job-lease-state-machine",
    sql: `
ALTER TABLE jobs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0);
ALTER TABLE jobs ADD COLUMN lease_owner TEXT;
ALTER TABLE jobs ADD COLUMN lease_expires_at TEXT;
ALTER TABLE jobs ADD COLUMN heartbeat_at TEXT;
ALTER TABLE jobs ADD COLUMN fencing_token INTEGER NOT NULL DEFAULT 0 CHECK (fencing_token >= 0);
ALTER TABLE jobs ADD COLUMN deadline_at TEXT;
ALTER TABLE jobs ADD COLUMN error_json TEXT;
ALTER TABLE job_attempts ADD COLUMN fencing_token INTEGER NOT NULL DEFAULT 0 CHECK (fencing_token >= 0);
ALTER TABLE job_attempts ADD COLUMN worker_id TEXT;
CREATE INDEX jobs_status_lease_idx ON jobs(status, lease_expires_at);
`,
  },
  {
    version: 6,
    name: "atomic-index-build-publication",
    sql: `
CREATE TABLE index_publication_migration_guard (
  row_count INTEGER NOT NULL CHECK (row_count = 0)
);
INSERT INTO index_publication_migration_guard(row_count) SELECT COUNT(*) FROM index_builds;
DROP TABLE index_publication_migration_guard;
ALTER TABLE knowledge_workspaces ADD COLUMN active_index_build_id TEXT REFERENCES index_builds(id);
ALTER TABLE knowledge_workspaces ADD COLUMN index_generation INTEGER NOT NULL DEFAULT 0 CHECK (index_generation >= 0);
ALTER TABLE index_builds ADD COLUMN base_generation INTEGER NOT NULL DEFAULT 0 CHECK (base_generation >= 0);
ALTER TABLE index_builds ADD COLUMN base_active_build_id TEXT;
ALTER TABLE index_builds ADD COLUMN validated_at TEXT;
ALTER TABLE index_builds ADD COLUMN published_at TEXT;
CREATE INDEX index_builds_workspace_status_idx ON index_builds(knowledge_workspace_id, status);
`,
  },
  {
    version: 7,
    name: "index-build-pin-lease-gc",
    sql: `
CREATE TABLE index_build_pins (
  id TEXT PRIMARY KEY,
  index_build_id TEXT NOT NULL REFERENCES index_builds(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  lease_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(index_build_id, owner_type, owner_id)
);
CREATE INDEX index_build_pins_build_expiry_idx ON index_build_pins(index_build_id, lease_expires_at);
CREATE INDEX index_build_pins_expiry_idx ON index_build_pins(lease_expires_at);
`,
  },
  {
    version: 8,
    name: "reliable-knowledge-publication",
    sql: `
ALTER TABLE parsed_artifacts ADD COLUMN parser_fingerprint TEXT;
ALTER TABLE parsed_artifacts ADD COLUMN normalization_fingerprint TEXT;
ALTER TABLE parsed_artifacts ADD COLUMN document_schema_version INTEGER CHECK (document_schema_version > 0);
ALTER TABLE parsed_artifacts ADD COLUMN interpretation_config_sha256 TEXT CHECK (
  interpretation_config_sha256 IS NULL OR (
    length(interpretation_config_sha256) = 64
    AND interpretation_config_sha256 = lower(interpretation_config_sha256)
    AND interpretation_config_sha256 NOT GLOB '*[^0-9a-f]*'
  )
);
ALTER TABLE parsed_artifacts ADD COLUMN artifact_hash TEXT CHECK (
  artifact_hash IS NULL OR (
    length(artifact_hash) = 64
    AND artifact_hash = lower(artifact_hash)
    AND artifact_hash NOT GLOB '*[^0-9a-f]*'
  )
);
ALTER TABLE parsed_artifacts ADD COLUMN canonical_bytes BLOB;
ALTER TABLE parsed_artifacts ADD COLUMN document_structure_json TEXT CHECK (
  document_structure_json IS NULL OR json_valid(document_structure_json)
);
ALTER TABLE parsed_artifacts ADD COLUMN source_map_json TEXT CHECK (
  source_map_json IS NULL OR json_valid(source_map_json)
);
CREATE UNIQUE INDEX parsed_artifacts_artifact_hash_idx
  ON parsed_artifacts(artifact_hash) WHERE artifact_hash IS NOT NULL;
CREATE UNIQUE INDEX parsed_artifacts_interpretation_idx
  ON parsed_artifacts(
    source_version_id,
    parser_fingerprint,
    normalization_fingerprint,
    document_schema_version,
    interpretation_config_sha256
  )
  WHERE parser_fingerprint IS NOT NULL
    AND normalization_fingerprint IS NOT NULL
    AND document_schema_version IS NOT NULL
    AND interpretation_config_sha256 IS NOT NULL;

ALTER TABLE index_builds ADD COLUMN retrieval_config_revision TEXT NOT NULL DEFAULT 'legacy-unspecified';
ALTER TABLE index_builds ADD COLUMN base_publication_id TEXT;
CREATE TABLE index_build_selections (
  index_build_id TEXT NOT NULL REFERENCES index_builds(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_version_id TEXT NOT NULL REFERENCES source_versions(id),
  parsed_artifact_id TEXT NOT NULL REFERENCES parsed_artifacts(id),
  PRIMARY KEY (index_build_id, source_id)
);
CREATE UNIQUE INDEX index_build_selection_artifact_idx
  ON index_build_selections(index_build_id, parsed_artifact_id);

CREATE TABLE reliable_knowledge_migration_guard (
  invalid_count INTEGER NOT NULL CHECK (invalid_count = 0)
);
INSERT INTO reliable_knowledge_migration_guard(invalid_count)
SELECT COUNT(*) FROM (
  SELECT c.index_build_id, sv.source_id
  FROM chunks c
  JOIN source_versions sv ON sv.id = c.source_version_id
  GROUP BY c.index_build_id, sv.source_id
  HAVING COUNT(DISTINCT c.source_version_id) <> 1
      OR COUNT(DISTINCT c.parsed_artifact_id) <> 1
  UNION ALL
  SELECT c.id, sv.source_id
  FROM chunks c
  JOIN index_builds ib ON ib.id = c.index_build_id
  JOIN parsed_artifacts pa ON pa.id = c.parsed_artifact_id
  JOIN source_versions sv ON sv.id = c.source_version_id
  JOIN sources s ON s.id = sv.source_id
  WHERE pa.source_version_id <> c.source_version_id
     OR s.knowledge_workspace_id <> ib.knowledge_workspace_id
);
DROP TABLE reliable_knowledge_migration_guard;

INSERT INTO index_build_selections(index_build_id, source_id, source_version_id, parsed_artifact_id)
SELECT DISTINCT c.index_build_id, sv.source_id, c.source_version_id, c.parsed_artifact_id
FROM chunks c
JOIN source_versions sv ON sv.id = c.source_version_id;

CREATE TABLE knowledge_publications (
  id TEXT PRIMARY KEY,
  knowledge_workspace_id TEXT NOT NULL REFERENCES knowledge_workspaces(id),
  generation INTEGER NOT NULL CHECK (generation > 0),
  index_build_id TEXT NOT NULL,
  retrieval_config_revision TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE (knowledge_workspace_id, generation),
  UNIQUE (index_build_id)
);
CREATE TABLE knowledge_publication_selections (
  publication_id TEXT NOT NULL REFERENCES knowledge_publications(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_version_id TEXT NOT NULL REFERENCES source_versions(id),
  parsed_artifact_id TEXT NOT NULL REFERENCES parsed_artifacts(id),
  PRIMARY KEY (publication_id, source_id),
  UNIQUE (publication_id, parsed_artifact_id)
);
CREATE INDEX knowledge_publications_workspace_generation_idx
  ON knowledge_publications(knowledge_workspace_id, generation);
CREATE INDEX knowledge_publication_artifact_idx
  ON knowledge_publication_selections(parsed_artifact_id);
CREATE TRIGGER knowledge_publications_immutable_update
BEFORE UPDATE ON knowledge_publications BEGIN
  SELECT RAISE(ABORT, 'Knowledge publications are immutable');
END;
CREATE TRIGGER knowledge_publications_immutable_delete
BEFORE DELETE ON knowledge_publications BEGIN
  SELECT RAISE(ABORT, 'Knowledge publications are immutable');
END;
CREATE TRIGGER knowledge_publication_selections_immutable_update
BEFORE UPDATE ON knowledge_publication_selections BEGIN
  SELECT RAISE(ABORT, 'Knowledge publication selections are immutable');
END;
CREATE TRIGGER knowledge_publication_selections_immutable_delete
BEFORE DELETE ON knowledge_publication_selections BEGIN
  SELECT RAISE(ABORT, 'Knowledge publication selections are immutable');
END;

CREATE TABLE active_publication_migration_guard (
  invalid_count INTEGER NOT NULL CHECK (invalid_count = 0)
);
INSERT INTO active_publication_migration_guard(invalid_count)
SELECT COUNT(*)
FROM knowledge_workspaces kw
LEFT JOIN index_builds ib ON ib.id = kw.active_index_build_id
WHERE (kw.active_index_build_id IS NULL AND kw.index_generation <> 0)
   OR (kw.active_index_build_id IS NOT NULL AND (
        kw.index_generation = 0
        OR ib.id IS NULL
        OR ib.knowledge_workspace_id <> kw.id
        OR ib.status <> 'active'
        OR ib.published_at IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM index_build_selections selection
          WHERE selection.index_build_id = ib.id
        )
      ));
DROP TABLE active_publication_migration_guard;

INSERT INTO knowledge_publications(
  id, knowledge_workspace_id, generation, index_build_id, retrieval_config_revision, published_at
)
SELECT
  'legacy-publication:' || kw.id || ':' || kw.index_generation,
  kw.id,
  kw.index_generation,
  ib.id,
  ib.retrieval_config_revision,
  ib.published_at
FROM knowledge_workspaces kw
JOIN index_builds ib ON ib.id = kw.active_index_build_id;

INSERT INTO knowledge_publication_selections(
  publication_id, source_id, source_version_id, parsed_artifact_id
)
SELECT
  'legacy-publication:' || kw.id || ':' || kw.index_generation,
  selection.source_id,
  selection.source_version_id,
  selection.parsed_artifact_id
FROM knowledge_workspaces kw
JOIN index_build_selections selection ON selection.index_build_id = kw.active_index_build_id;

ALTER TABLE knowledge_workspaces ADD COLUMN active_knowledge_publication_id TEXT
  REFERENCES knowledge_publications(id);
UPDATE knowledge_workspaces
SET active_knowledge_publication_id = 'legacy-publication:' || id || ':' || index_generation
WHERE active_index_build_id IS NOT NULL;
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
