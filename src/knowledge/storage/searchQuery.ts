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
  const value = row as {
    chunk_id?: unknown;
    source_version_id?: unknown;
    parsed_artifact_id?: unknown;
    ordinal?: unknown;
    start_byte?: unknown;
    end_byte?: unknown;
    source_id?: unknown;
    source_kind?: unknown;
    source_display_name?: unknown;
    source_archived_at?: unknown;
  } | undefined;

  if (
    !value ||
    value.chunk_id !== hit.chunkId ||
    value.source_version_id !== hit.sourceVersionId ||
    value.parsed_artifact_id !== hit.parsedArtifactId ||
    !Number.isSafeInteger(value.ordinal) ||
    !Number.isSafeInteger(value.start_byte) ||
    !Number.isSafeInteger(value.end_byte) ||
    Number(value.ordinal) < 0 ||
    Number(value.start_byte) < 0 ||
    Number(value.end_byte) <= Number(value.start_byte) ||
    typeof value.source_id !== "string" ||
    value.source_id.length === 0 ||
    typeof value.source_kind !== "string" ||
    value.source_kind.length === 0 ||
    typeof value.source_display_name !== "string" ||
    value.source_display_name.length === 0 ||
    !(value.source_archived_at === null || typeof value.source_archived_at === "string")
  ) {
    throw new Error("Search metadata is missing or inconsistent with the scoped lexical hit");
  }

  return {
    chunkId: hit.chunkId,
    sourceVersionId: hit.sourceVersionId,
    source: {
      id: value.source_id,
      kind: value.source_kind,
      displayName: value.source_display_name,
      archivedAt: value.source_archived_at,
    },
    snippet: hit.text,
    locator: {
      parsedArtifactId: hit.parsedArtifactId,
      startByte: Number(value.start_byte),
      endByte: Number(value.end_byte),
    },
    rank: hit.rank,
    ordinal: Number(value.ordinal),
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
    throw new TypeError(`${name} must be an integer between 1 and ${MAX_LIMIT}`);
  }
  return value;
}

function requireNonEmpty(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${name} must be non-empty`);
  return normalized;
}

function stableHandle(kind: "query" | "run", value: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return `search_${kind}_${digest}`;
}
