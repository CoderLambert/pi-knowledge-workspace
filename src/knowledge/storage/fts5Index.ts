import { createHash } from "node:crypto";

import type { KnowledgeDatabase } from "./database.js";
import { withTransaction } from "./database.js";
import type { StructureAwareChunk } from "./chunker.js";

export interface IndexArtifactChunksInput {
  knowledgeWorkspaceId: string;
  indexBuildId: string;
  sourceVersionId: string;
  parsedArtifactId: string;
  chunks: readonly StructureAwareChunk[];
  createdAt?: string;
}

export interface Fts5SearchInput {
  knowledgeWorkspaceId: string;
  indexBuildId: string;
  query: string;
  allowedSourceVersionIds?: readonly string[];
  limit?: number;
}

export interface Fts5SearchHit {
  chunkId: string;
  sourceVersionId: string;
  parsedArtifactId: string;
  text: string;
  rank: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/** Internal lexical baseline. P1-T13 will wrap this with the public search contract. */
export class Fts5BaselineIndex {
  constructor(private readonly db: KnowledgeDatabase) {}

  replaceArtifactChunks(input: IndexArtifactChunksInput): void {
    assertNonEmptyIdentity(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    assertNonEmptyIdentity(input.indexBuildId, "indexBuildId");
    assertNonEmptyIdentity(input.sourceVersionId, "sourceVersionId");
    assertNonEmptyIdentity(input.parsedArtifactId, "parsedArtifactId");
    assertChunks(input.chunks);

    const authority = this.db
      .prepare(`
SELECT ib.id
FROM index_builds ib
JOIN parsed_artifacts pa ON pa.id = ?
JOIN source_versions sv ON sv.id = pa.source_version_id
JOIN sources s ON s.id = sv.source_id
WHERE ib.id = ?
  AND ib.knowledge_workspace_id = ?
  AND sv.id = ?
  AND s.knowledge_workspace_id = ?
`)
      .get(
        input.parsedArtifactId,
        input.indexBuildId,
        input.knowledgeWorkspaceId,
        input.sourceVersionId,
        input.knowledgeWorkspaceId,
      );
    if (authority === undefined) {
      throw new Error("IndexBuild, ParsedArtifact and SourceVersion do not belong to the requested Knowledge Workspace");
    }

    const createdAt = input.createdAt ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(createdAt))) throw new TypeError("createdAt must be an ISO-compatible timestamp");

    withTransaction(this.db, () => {
      this.db
        .prepare("DELETE FROM chunk_fts WHERE index_build_id = ? AND parsed_artifact_id = ?")
        .run(input.indexBuildId, input.parsedArtifactId);
      this.db
        .prepare("DELETE FROM chunks WHERE index_build_id = ? AND parsed_artifact_id = ?")
        .run(input.indexBuildId, input.parsedArtifactId);

      const insertChunk = this.db.prepare(`
INSERT INTO chunks (
  id, index_build_id, parsed_artifact_id, source_version_id, ordinal,
  text, start_byte, end_byte, node_kinds_json, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
      const insertFts = this.db.prepare(`
INSERT INTO chunk_fts (
  chunk_id, knowledge_workspace_id, source_version_id, parsed_artifact_id, index_build_id, text
) VALUES (?, ?, ?, ?, ?, ?)
`);

      for (const chunk of input.chunks) {
        const chunkId = stableChunkId(input.indexBuildId, input.parsedArtifactId, chunk);
        insertChunk.run(
          chunkId,
          input.indexBuildId,
          input.parsedArtifactId,
          input.sourceVersionId,
          chunk.ordinal,
          chunk.text,
          chunk.startByte,
          chunk.endByte,
          JSON.stringify(chunk.nodeKinds),
          createdAt,
        );
        insertFts.run(
          chunkId,
          input.knowledgeWorkspaceId,
          input.sourceVersionId,
          input.parsedArtifactId,
          input.indexBuildId,
          chunk.text,
        );
      }
    });
  }

  search(input: Fts5SearchInput): Fts5SearchHit[] {
    assertNonEmptyIdentity(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    assertNonEmptyIdentity(input.indexBuildId, "indexBuildId");
    const query = input.query.trim();
    if (query.length === 0) throw new TypeError("query must not be empty");

    const limit = input.limit ?? DEFAULT_LIMIT;
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > MAX_LIMIT) {
      throw new TypeError(`limit must be an integer between 1 and ${String(MAX_LIMIT)}`);
    }

    const allowed = input.allowedSourceVersionIds;
    if (allowed?.length === 0) return [];
    if (allowed !== undefined) {
      for (const sourceVersionId of allowed) assertNonEmptyIdentity(sourceVersionId, "allowedSourceVersionId");
    }

    const sourceFilter = allowed === undefined ? "" : ` AND source_version_id IN (${allowed.map(() => "?").join(", ")})`;
    const statement = this.db.prepare(`
SELECT
  chunk_id AS chunkId,
  source_version_id AS sourceVersionId,
  parsed_artifact_id AS parsedArtifactId,
  text,
  bm25(chunk_fts) AS rank
FROM chunk_fts
WHERE chunk_fts MATCH ?
  AND knowledge_workspace_id = ?
  AND index_build_id = ?${sourceFilter}
ORDER BY bm25(chunk_fts), rowid
LIMIT ?
`);

    const params: unknown[] = [query, input.knowledgeWorkspaceId, input.indexBuildId];
    if (allowed !== undefined) params.push(...allowed);
    params.push(limit);

    return statement.all(...params).map(parseSearchHit);
  }
}

function stableChunkId(indexBuildId: string, parsedArtifactId: string, chunk: StructureAwareChunk): string {
  const digest = createHash("sha256")
    .update(
      `${indexBuildId}\0${parsedArtifactId}\0${String(chunk.ordinal)}\0${String(chunk.startByte)}\0${String(chunk.endByte)}`,
    )
    .digest("hex");
  return `chunk_${digest}`;
}

function assertChunks(chunks: readonly StructureAwareChunk[]): void {
  let previousEnd = -1;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (chunk === undefined) throw new Error("Chunk collection changed during validation");
    if (chunk.ordinal !== index) throw new Error("Chunk ordinals must be contiguous and zero-based");
    if (
      !Number.isSafeInteger(chunk.startByte) ||
      !Number.isSafeInteger(chunk.endByte) ||
      chunk.startByte < 0 ||
      chunk.endByte <= chunk.startByte ||
      chunk.startByte < previousEnd
    ) {
      throw new Error("Chunk ranges must be ordered, non-overlapping, non-empty byte ranges");
    }
    previousEnd = chunk.endByte;
  }
}

function assertNonEmptyIdentity(value: string, name: string): void {
  if (value.trim().length === 0) throw new TypeError(`${name} must not be empty`);
}

function parseSearchHit(row: unknown): Fts5SearchHit {
  const value = recordValue(row, "FTS5 search row");
  const chunkId = value["chunkId"];
  const sourceVersionId = value["sourceVersionId"];
  const parsedArtifactId = value["parsedArtifactId"];
  const text = value["text"];
  const rank = value["rank"];
  if (
    typeof chunkId !== "string" ||
    typeof sourceVersionId !== "string" ||
    typeof parsedArtifactId !== "string" ||
    typeof text !== "string" ||
    typeof rank !== "number" ||
    !Number.isFinite(rank)
  ) {
    throw new Error("SQLite returned an invalid FTS5 search row");
  }
  return { chunkId, sourceVersionId, parsedArtifactId, text, rank };
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object record`);
  }
  return Object.fromEntries(Object.entries(value));
}
