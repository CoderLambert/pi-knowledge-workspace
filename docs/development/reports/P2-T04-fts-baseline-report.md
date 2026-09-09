# P2-T04 — FTS baseline report

Status: **PARTIAL — original-corpus run valid; expanded-corpus rerun required**

Branch: `experiment/p2-fts-baseline-report`  
Direct base: `chore/p2-propagate-p1-t13-natural-query` (P1-T13 propagation / PR #47)  
Upstream corrective corpus: `data/p2-retrieval-challenge-expansion` (P2-T03A / PR #46)

## Objective

Measure the current P1 FTS5/SearchQuery lexical baseline against immutable Stable Evidence and publish both aggregate metrics and concrete failure/ranking diagnostics.

`src/knowledge/eval/ftsBaselineEvaluation.ts` remains the narrow P2-T04 evaluator. It does not own lexical tuning, Dense/vector retrieval, RRF, or the generic P2-T09 benchmark framework.

## Evaluation contract

The evaluator records:

- answerable-query Recall@10;
- MRR of the first required Stable Evidence overlap;
- all-required-Evidence coverage;
- failure counts by query category;
- latency median/p95/max;
- peak RSS and measured FTS allocation;
- no-answer query / lexical-hit counts as diagnostics only.

Relevance is independent of Chunk identity. A result is relevant only when its SourceVersion and ParsedArtifact match and its UTF-8 locator overlaps required Stable Evidence.

## Production query-boundary defect and propagation

The first real run exposed that public natural-language text was forwarded directly into SQLite FTS5 `MATCH`. Ordinary punctuation, code symbols, and FTS operators caused **78 of 80 queries** to throw syntax errors.

P1-T13 fixed this boundary by compiling the normalized public query into quoted literal terms joined by `OR`. PR #47 now propagates that fix into the corrected P2 ancestry while preserving the later active IndexBuild lease/release behavior. The public query handle still derives from the original normalized user query; only the internal FTS expression changes.

## Original-corpus real run — 2026-09-09

Environment:

- Omarchy/Linux;
- Node 26.7.0;
- `better-sqlite3@13.0.3`;
- SQLite 3.53.4;
- original three immutable P2 corpus artifacts;
- 80 fixed P2-T03 queries;
- production path `openKnowledgeDatabase -> canonicalizeParsedArtifact -> chunkParsedArtifact -> Fts5BaselineIndex -> IndexBuildPublisher -> SearchQueryApi -> evaluateFtsBaseline`.

Observed result after the P1-T13 correction:

```text
queryCount: 80
scoredAnswerableQueries: 68
noAnswerQueries: 12
noAnswerQueriesWithAnyHit: 12
Recall@10: 1.0
MRR: 0.9779411764705882
allRequiredEvidenceCoverage: 1.0
categoryFailureCounts: {}
latency median: 0.273482 ms
latency p95: 0.533295 ms
latency max: 1.303755 ms
peak RSS: 94,654,464 bytes
FTS allocation: 20,480 bytes
queryErrors: 0
developmentMisses: 0
totalChunks: 3
```

The FTS allocation is the sum of SQLite `dbstat` pages for `chunk_fts` backing objects. The earlier file-size-delta value of zero was invalid because SQLite can reuse already allocated pages.

## Rank diagnostics on the original corpus

Among 68 answerable queries:

```text
rank 1: 65
rank 2: 3
rank 3+: 0
miss: 0
```

Development split:

```text
answerable: 42
rank 1: 41
rank 2: 1
miss: 0
```

The only development-side non-rank-1 query is `dev-026`, where the required Node.js v16.7.0 Evidence ranks second behind the v22.3.0 source. This is valid input for later development-only tuning.

Two holdout answerable queries ranked the required Evidence second. Those observations are acceptance-only and must not be used to choose lexical profiles, embedding models, or fusion settings.

All 12 no-answer queries returned at least one lexical candidate. Therefore presence of a lexical hit is not an answerability signal.

## Why the original result is insufficient for ADR-029

The original three artifacts are only 469, 451, and 506 bytes. Under the current 2,400-byte chunk target they become exactly **3 chunks**, while SearchQuery uses Top-K=10. Recall@10 and all-required coverage are therefore structurally saturated.

The original run proves execution correctness and supplies useful MRR/version-confusion diagnostics, but it cannot by itself choose between:

- baseline FTS;
- deterministic lexical normalization;
- Dense retrieval;
- FTS + Dense + RRF.

P2-T03A / PR #46 corrects this by adding immutable development-side hard-negative artifacts with new SourceVersion/ParsedArtifact identity. Its focused production parser/chunker test requires at least 30 challenge chunks, while preserving all original query and Evidence labels.

## Corrected expanded-corpus run — OPEN

Before P2-T04 can provide strategy-selection evidence to ADR-029, rerun on the corrected ancestry using:

- the original three immutable artifacts plus all P2-T03A challenge artifacts;
- the unchanged 50 development / 30 holdout queries and existing Stable Evidence labels;
- Top-K=10;
- the PR #47 natural-language FTS compiler;
- existing active IndexBuild lease semantics;
- `dbstat`-based FTS allocation;
- development/holdout isolation.

The expanded-corpus numeric result is **not yet claimed**.

## Verification debt

P2-T04 remains PARTIAL until:

1. PR #46 focused integrity/parser/chunker tests and task-attributable gates run;
2. PR #47 focused SearchQuery/FTS tests and task-attributable gates run;
3. the expanded-corpus real baseline executes and its complete numeric/provenance report is committed;
4. repository-wide gates are executed and inherited failures are classified on the corrected ancestry.

## Scope boundary

Compared directly with PR #47, this task contains only the P2-T04 evaluator/test and its report/verification records. No P2-T05 lexical implementation, Dense/vector/RRF logic, model runtime, or P3 work belongs here.
