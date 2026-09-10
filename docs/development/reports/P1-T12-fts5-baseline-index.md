# P1-T12 — FTS5 baseline index

Status: **PARTIAL**

Branch: `feat/p1-fts5-baseline-index`  
Direct base: `feat/p1-structure-aware-chunker`  
PR: #22

## Scope

Implement the first lexical retrieval baseline over P1-T11 canonical chunks using SQLite FTS5 with `unicode61`.

The critical retrieval invariant is enforced in the query itself:

```text
Knowledge Workspace / IndexBuild / optional SourceVersion scope
→ FTS5 match + ranking
→ Top-K
```

Never:

```text
global FTS5 Top-K
→ scope filter afterwards
```

This task is the storage/index baseline only. P1-T13 owns the public `search.query` contract and stable run/query handles.

## Implementation

Added `src/knowledge/storage/fts5Index.ts` with `Fts5BaselineIndex`.

### Indexing

`replaceArtifactChunks()`:

- validates Workspace, IndexBuild, SourceVersion and ParsedArtifact identities;
- performs a server-side ownership query joining `index_builds → parsed_artifacts → source_versions → sources` before accepting writes;
- requires all four identities to resolve to the requested Knowledge Workspace;
- transactionally replaces one `(IndexBuild, ParsedArtifact)` chunk set;
- stores deterministic chunk ids derived from IndexBuild, ParsedArtifact, ordinal and canonical byte range;
- mirrors each persisted chunk into `chunk_fts` with Workspace, SourceVersion, ParsedArtifact and IndexBuild scope columns marked `UNINDEXED`;
- preserves P1-T11 canonical chunk text and byte ranges rather than re-chunking or rewriting content.

### Search

`search()`:

- requires Knowledge Workspace and IndexBuild scope;
- accepts an optional allowed SourceVersion id set;
- returns immediately for an explicitly empty source allowlist rather than accidentally issuing a global query;
- validates a bounded result limit (`1..100`);
- applies `MATCH`, Workspace, IndexBuild and optional SourceVersion predicates in the same SQL `WHERE` before `ORDER BY bm25(...)` and `LIMIT`;
- returns raw FTS5 `bm25` rank values. No normalization or cross-strategy score semantics are claimed at this stage.

## Schema v4

Schema v4 upgrades the provisional P1-T02 `chunks` table into an IndexBuild-scoped durable chunk representation and adds a contentful FTS5 table:

```text
chunks
  id
  index_build_id
  parsed_artifact_id
  source_version_id
  ordinal
  text
  start_byte
  end_byte
  node_kinds_json
  created_at

chunk_fts USING fts5(
  chunk_id UNINDEXED,
  knowledge_workspace_id UNINDEXED,
  source_version_id UNINDEXED,
  parsed_artifact_id UNINDEXED,
  index_build_id UNINDEXED,
  text,
  tokenize='unicode61'
)
```

The earlier provisional chunk rows cannot be safely assigned to an IndexBuild after the fact. Migration v4 therefore uses the same fail-closed discipline as P1-T10: a schema-v3 DB upgrades only when the provisional `chunks` table is empty. Any existing row trips a zero-only migration guard and rolls back rather than silently mis-scoping or dropping data.

## Locked invariants

1. Every persisted chunk is owned by one IndexBuild, ParsedArtifact and SourceVersion.
2. Index writes are rejected unless those identities belong to the requested Knowledge Workspace.
3. FTS5 scope predicates are applied before ranking/Top-K.
4. Explicit empty SourceVersion scope means zero results, never global fallback.
5. The lexical baseline uses FTS5 `unicode61`; retrieval quality is not inferred from tokenizer availability alone.
6. Raw `bm25` rank remains an internal lexical score and is not yet a cross-strategy normalized score.
7. Chunk text/ranges are inherited from P1-T11 and are not rewritten by the indexer.
8. Legacy provisional chunk rows are never guessed into an IndexBuild during migration.

## Tests

`src/knowledge/storage/fts5Index.test.ts` adds six contract scenarios:

- authority mismatch rejects indexing before transaction/write;
- atomic replacement and deterministic chunk ids;
- SQL-level Workspace/IndexBuild/SourceVersion filtering before ranking/limit;
- explicit empty SourceVersion allowlist short-circuits without querying;
- invalid query/limit/chunk inputs fail before SQL;
- malformed SQLite result rows fail closed.

`src/knowledge/storage/database.test.ts` is extended for schema v4, FTS5/chunk schema shape and migration-4 rollback behavior.

## Deferred verification / dependency risk

P1-T12 depends on the still-PARTIAL P1-T01 selected native driver/FTS5 capability, P1-T02 migration execution, P1-T08 canonical bytes and P1-T11 chunk semantics. The implementation keeps these dependencies narrow: direct `KnowledgeDatabase`, durable schema, and `StructureAwareChunk` input.

The automation environment cannot execute `better-sqlite3` or FTS5 and the current branch has no known CI evidence. Therefore P1-T12 remains **PARTIAL** until the verification guide proves real `unicode61` creation/query behavior, schema-v3→v4 migration safety, scoped Top-K semantics, and all repository gates.

P1-T13 may wrap this internal index behind the public search contract while preserving scope-first semantics, but it must not treat P1-T12 or its dependencies as PASS.

## Scope check

Direct-base comparison must contain only FTS5/index implementation/tests, schema-v4 chunk/FTS migration, database-version/migration tests, and P1-T12 task records. No public search API, source viewer, embedding/vector retrieval, model runtime, or unrelated baseline fixes belong in this PR.
