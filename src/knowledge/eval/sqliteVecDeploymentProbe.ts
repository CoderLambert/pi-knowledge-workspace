import { isAbsolute } from "node:path";

export interface SqliteVecProbeStatement {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}

export interface SqliteVecProbeDatabase {
  loadExtension(path: string): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteVecProbeStatement;
}

export interface SqliteVecProbeResult {
  version: string;
  scopedRowIds: readonly number[];
  distances: readonly number[];
}

const PROBE_DIMENSIONS = 3;

/**
 * Runtime deployment probe only. It does not add sqlite-vec as a production
 * dependency or make a vector-store adoption decision.
 */
export function runSqliteVecDeploymentProbe(
  db: SqliteVecProbeDatabase,
  extensionPath: string,
): SqliteVecProbeResult {
  if (extensionPath.trim().length === 0 || !isAbsolute(extensionPath)) {
    throw new TypeError("sqlite-vec extensionPath must be a non-empty absolute path");
  }

  db.loadExtension(extensionPath);
  const version = parseVersion(db.prepare("SELECT vec_version() AS version").get());

  db.exec(`
DROP TABLE IF EXISTS vec_p2_probe;
CREATE VIRTUAL TABLE vec_p2_probe USING vec0(
  embedding float[${String(PROBE_DIMENSIONS)}] distance_metric=cosine,
  scope text
);
`);

  try {
    const insert = db.prepare("INSERT INTO vec_p2_probe(rowid, embedding, scope) VALUES (?, ?, ?)");
    insert.run(1, "[1,0,0]", "scope-a");
    insert.run(2, "[0.8,0.2,0]", "scope-a");
    insert.run(3, "[1,0,0]", "scope-b");

    const rows = db.prepare(`
SELECT rowid, distance
FROM vec_p2_probe
WHERE embedding MATCH ?
  AND scope = ?
  AND k = ?
ORDER BY distance, rowid
`).all("[1,0,0]", "scope-a", 2);

    const parsed = rows.map(parseHit);
    if (parsed.length !== 2 || parsed.some((row) => row.rowid === 3)) {
      throw new Error("sqlite-vec scoped KNN probe did not enforce metadata scope before Top-K");
    }
    return {
      version,
      scopedRowIds: parsed.map((row) => row.rowid),
      distances: parsed.map((row) => row.distance),
    };
  } finally {
    db.exec("DROP TABLE IF EXISTS vec_p2_probe;");
  }
}

function parseVersion(row: unknown): string {
  if (typeof row !== "object" || row === null || !("version" in row)) {
    throw new Error("sqlite-vec vec_version() returned an invalid row");
  }
  const version = row.version;
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("sqlite-vec vec_version() returned an invalid version");
  }
  return version;
}

function parseHit(row: unknown): { rowid: number; distance: number } {
  if (typeof row !== "object" || row === null || !("rowid" in row) || !("distance" in row)) {
    throw new Error("sqlite-vec KNN probe returned an invalid row");
  }
  const rowid = row.rowid;
  const distance = row.distance;
  if (!Number.isSafeInteger(rowid) || typeof distance !== "number" || !Number.isFinite(distance)) {
    throw new Error("sqlite-vec KNN probe returned an invalid row");
  }
  return { rowid, distance };
}
