import { createHash, randomUUID } from "node:crypto";

import type { KnowledgeDatabase } from "./database.js";
import { Fts5BaselineIndex, type Fts5SearchHit } from "./fts5Index.js";
import { IndexBuildRetention, type ActiveIndexBuildLease } from "./indexBuildRetention.js";

export interface SearchQueryBudget {
  maxResults: number;
}

export interface SearchQueryInput {
  knowledgeWorkspaceId: string;
  query: string;
  allowedSourceVersionIds?: readonly string[];
  limit?: number;
  budget?: SearchQueryBudget;
}

export interface SearchResultSource {
  id: string;
  kind: string;
  displayName: string;
  archivedAt: string | null;
}

export interface SearchResultLocator {
  parsedArtifactId: string;
  startByte: number;
  endByte: number;
}

export interface SearchQueryHit {
  chunkId: string;
  sourceVersionId: string;
  source: SearchResultSource;
  snippet: string;
  locator: SearchResultLocator;
  rank: number;
  ordinal: number;
}

export interface SearchQueryResult {
  queryHandle: string;
  runHandle: string;
  indexBuildId: string;
  hits: SearchQueryHit[];
  debug: {
    backend: "fts5";
    requestedLimit: number;
    effectiveLimit: number;
    allowedSourceVersionCount: number | null;
  };
}

export interface SearchIndexBuildResolver {
  acquire(knowledgeWorkspaceId: string): ActiveIndexBuildLease;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const SEARCH_BUILD_LEASE_MS = 60_000;
const INVALID_SEARCH_METADATA = "Search metadata is missing or inconsistent with the scoped lexical hit";

/** Atomically resolves and leases the Workspace's published active IndexBuild. */
export class ActiveIndexBuildResolver implements SearchIndexBuildResolver {
  private readonly retention: IndexBuildRetention;

  constructor(db: KnowledgeDatabase, retention: IndexBuildRetention = new IndexBuildRetention(db)) {
    this.retention = retention;
  }

  acquire(knowledgeWorkspaceId: string): ActiveIndexBuildLease {
    const workspaceId = requireNonEmpty(knowledgeWorkspaceId, "knowledgeWorkspaceId");
    return this.retention.acquireActiveLease(workspaceId, "search-query", randomUUID(), SEARCH_BUILD_LEASE_MS);
  }
}

/** Public P1 lexical search contract. Transport wiring remains outside the storage boundary. */
export class SearchQueryApi {
  constructor(
    private readonly db: KnowledgeDatabase,
    private readonly index: Fts5BaselineIndex,
    private readonly buildResolver: SearchIndexBuildResolver = new ActiveIndexBuildResolver(db),
  ) {}

  query(input: SearchQueryInput): SearchQueryResult {
    const knowledgeWorkspaceId = requireNonEmpty(input.knowledgeWorkspaceId, "knowledgeWorkspaceId");
    const query = requireNonEmpty(input.query, "query");
    const requestedLimit = validateLimit(input.limit ?? DEFAULT_LIMIT, "limit");
    const budgetLimit = input.budget === undefined
      ? requestedLimit
      : validateLimit(input.budget.maxResults, "budget.maxResults");
    const effectiveLimit = Math.min(requestedLimit, budgetLimit);
    const allowedSourceVersionIds = normalizeAllowedSourceVersions(input.allowedSourceVersionIds);
    const lease = this.buildResolver.acquire(knowledgeWorkspaceId);

    try {
      const indexBuildId = lease.indexBuildId;
      const queryHandle = stableHandle("query", {
        knowledgeWorkspaceId,
        query,
        allowedSourceVersionIds,
        requestedLimit,
        budgetLimit,
      });
      const runHandle = stableHandle("run", { queryHandle, indexBuildId });

      const lexicalHits = this.index.search({
        knowledgeWorkspaceId,
        indexBuildId,
        query: compileNaturalLanguageFts5Query(query),
        ...(allowedSourceVersionIds === undefined ? {} : { allowedSourceVersionIds }),
        limit: effectiveLimit,
      });

      const metadataStatement = this.db.prepare(`
SELECT
  c.id AS chunk_id,
  c.source_version_id,
  c.parsed_artifact_id,
  c.ordinal,
  c.start_byte,
  c.end_byte,
  s.id AS source_id,
  s.kind AS source_kind,
  s.display_name AS source_display_name,
  s.archived_at AS source_archived_at
FROM chunks c
JOIN source_versions sv ON sv.id = c.source_version_id
JOIN sources s ON s.id = sv.source_id
WHERE c.id = ?
  AND c.index_build_id = ?
  AND c.source_version_id = ?
  AND c.parsed_artifact_id = ?
  AND s.knowledge_workspace_id = ?
`);

      const hits = lexicalHits.map((hit) => {
        const row = metadataStatement.get(
          hit.chunkId,
          indexBuildId,
          hit.sourceVersionId,
          hit.parsedArtifactId,
          knowledgeWorkspaceId,
        );
        return hydrateHit(hit, row);
      });

      return {
        queryHandle,
        runHandle,
        indexBuildId,
        hits,
        debug: {
          backend: "fts5",
          requestedLimit,
          effectiveLimit,
          allowedSourceVersionCount: allowedSourceVersionIds?.length ?? null,
        },
      };
    } finally {
      lease.release();
    }
  }
}

function hydrateHit(hit: Fts5SearchHit, row: unknown): SearchQueryHit {
  if (!isRecord(row)) throw new Error(INVALID_SEARCH_METADATA);
  const chunkId = row["chunk_id"];
  const sourceVersionId = row["source_version_id"];
  const parsedArtifactId = row["parsed_artifact_id"];
  const ordinal = row["ordinal"];
  const startByte = row["start_byte"];
  const endByte = row["end_byte"];
  const sourceId = row["source_id"];
  const sourceKind = row["source_kind"];
  const sourceDisplayName = row["source_display_name"];
  const sourceArchivedAt = row["source_archived_at"];

  if (
    chunkId !== hit.chunkId ||
    sourceVersionId !== hit.sourceVersionId ||
    parsedArtifactId !== hit.parsedArtifactId ||
    typeof ordinal !== "number" ||
    !Number.isSafeInteger(ordinal) ||
    typeof startByte !== "number" ||
    !Number.isSafeInteger(startByte) ||
    typeof endByte !== "number" ||
    !Number.isSafeInteger(endByte) ||
    ordinal < 0 ||
    startByte < 0 ||
    endByte <= startByte ||
    typeof sourceId !== "string" ||
    sourceId.length === 0 ||
    typeof sourceKind !== "string" ||
    sourceKind.length === 0 ||
    typeof sourceDisplayName !== "string" ||
    sourceDisplayName.length === 0 ||
    (sourceArchivedAt !== null && typeof sourceArchivedAt !== "string")
  ) {
    throw new Error(INVALID_SEARCH_METADATA);
  }

  return {
    chunkId: hit.chunkId,
    sourceVersionId: hit.sourceVersionId,
    source: {
      id: sourceId,
      kind: sourceKind,
      displayName: sourceDisplayName,
      archivedAt: sourceArchivedAt,
    },
    snippet: hit.text,
    locator: {
      parsedArtifactId: hit.parsedArtifactId,
      startByte,
      endByte,
    },
    rank: hit.rank,
    ordinal,
  };
}

function compileNaturalLanguageFts5Query(query: string): string {
  return query
    .split(/\s+/u)
    .filter((term) => term.length > 0)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(" OR ");
}

function normalizeAllowedSourceVersions(values: readonly string[] | undefined): string[] | undefined {
  if (values === undefined) return undefined;
  const unique = new Set<string>();
  for (const value of values) unique.add(requireNonEmpty(value, "allowedSourceVersionId"));
  return [...unique].sort();
}

function validateLimit(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_LIMIT) {
    throw new TypeError(`${name} must be an integer between 1 and ${String(MAX_LIMIT)}`);
  }
  return value;
}

function requireNonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function stableHandle(kind: "query" | "run", value: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return `search_${kind}_${digest}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
