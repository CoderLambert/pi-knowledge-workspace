# P1-T13 — Search API baseline

Status: **PARTIAL**

Branch: `feat/p1-search-api-baseline`  
Direct base: `feat/p1-fts5-baseline-index`  
PR: pending creation

## Scope

Implement the first public Knowledge search-domain contract over the P1-T12 lexical baseline without introducing vector/hybrid retrieval, model execution, UI, or active-IndexBuild publication.

Input contract:

```text
Knowledge Workspace
+ query
+ optional allowed SourceVersion ids
+ limit
+ optional result budget
```

Response contract:

```text
stable query/run handles
+ selected IndexBuild
+ source metadata
+ snippet
+ stable ParsedArtifact byte locator
+ lexical rank/debug metadata
```

## Implementation

Added `src/knowledge/storage/searchQuery.ts`.

### Server-owned IndexBuild selection

Callers do not supply `indexBuildId`. `LatestCompletedIndexBuildResolver` selects the newest build for the requested Knowledge Workspace whose `completed_at` is present.

This is deliberately a narrow provisional resolver. P1-T18 owns atomic active-IndexBuild publication and will replace recency selection without changing the `SearchQueryApi` input contract.

If no completed build exists, search fails explicitly rather than silently searching another Workspace/build or returning a misleading global result.

### Retrieval

`SearchQueryApi.query()`:

- validates Workspace/query identities and bounded limit/budget (`1..100`);
- canonicalizes an optional SourceVersion allowlist by validating, deduplicating and sorting it;
- resolves the IndexBuild server-side;
- calls P1-T12 `Fts5BaselineIndex.search()` with Workspace + resolved IndexBuild + optional SourceVersion scope applied before ranking/Top-K;
- enforces `effectiveLimit = min(limit, budget.maxResults)`;
- preserves an explicit empty SourceVersion allowlist as zero results with no FTS query;
- re-resolves every lexical hit through durable `chunks → source_versions → sources` ownership before exposing it;
- fails closed if durable metadata cannot prove the hit still belongs to the requested Workspace/build/SourceVersion/ParsedArtifact.

### Stable handles

The API returns deterministic SHA-256-backed handles:

- `queryHandle` identifies the normalized semantic request and result budget;
- `runHandle` identifies that query against the resolved IndexBuild.

This avoids inventing a persistence schema before a concrete consumer requires durable search-run rows while still giving downstream Evidence/Ask/debug flows stable opaque identifiers.

### Result metadata

Each hit includes:

- chunk id;
- SourceVersion id;
- Source id/kind/display name/archive state;
- snippet (the canonical indexed chunk text);
- ParsedArtifact id with `[startByte, endByte)` locator;
- lexical `bm25` rank;
- chunk ordinal.

The locator remains artifact-relative and historical. The API does not redirect a historical result to the latest SourceVersion.

## Locked invariants

1. Search callers cannot choose an arbitrary IndexBuild.
2. Workspace/IndexBuild/SourceVersion scope remains before ranking and Top-K through P1-T12.
3. Empty explicit SourceVersion scope means zero results, never global fallback.
4. Search metadata is re-authorized against durable chunk/source ownership before exposure.
5. Result locators use ParsedArtifact UTF-8 byte ranges, not mutable Workspace file offsets.
6. Query/run handles are opaque deterministic identifiers; they do not imply persisted search-run state.
7. P1-T18 may replace only IndexBuild resolution/publication semantics, not widen caller authority.

## Tests

`src/knowledge/storage/searchQuery.test.ts` covers six contract scenarios:

- server-side completed-build selection plus stable handles/source/locator metadata;
- SourceVersion allowlist dedupe/sort and budget-before-Top-K behavior;
- explicit empty SourceVersion scope with no FTS fallback;
- no completed IndexBuild fails before retrieval;
- metadata/ownership mismatch fails closed;
- malformed Workspace/query/limit/budget/SourceVersion inputs fail before retrieval.

## Deferred verification / dependency risk

P1-T13 consumes still-PARTIAL P1-T02/P1-T05/P1-T08/P1-T09/P1-T11/P1-T12 contracts. The dependency is intentionally narrow: `KnowledgeDatabase`, `Fts5BaselineIndex`, stable ParsedArtifact byte ranges and durable source metadata.

The automation runtime cannot clone/install the repository because outbound DNS is unavailable, and this branch has no known GitHub Actions evidence yet. Therefore focused tests plus typecheck/lint/knip/build/pack/full-suite gates remain OPEN verification debt.

P1-T13 also carries a deliberate provisional assumption until P1-T18: a build with non-null `completed_at` is eligible and newest-completed recency is the temporary selection policy. P1-T18 must replace this with atomic active-build publication before P1 phase acceptance.

Transport/paired-plugin exposure is not added here because the current standalone service dispatch skeleton has not yet acquired the database/index composition root; advertising `search.query` before that dependency exists would create a capability that cannot execute. This task establishes the domain API contract that later service wiring can expose without weakening host-authoritative Workspace scope.

## Scope check

Direct-base comparison must contain only P1-T13 search-domain implementation/tests and task records. No schema migration, P1-T14 evidence-read implementation, UI, vector/hybrid retrieval, model runtime, or P1-T18 publication code belongs in this PR.
