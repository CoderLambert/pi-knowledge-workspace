# P2-T04 — FTS baseline report

Status: **PARTIAL**

Branch: `experiment/p2-fts-baseline-report`  
Direct base: `data/p2-query-annotation` (P2-T03 / PR #35)

## Objective

Measure the existing P1 FTS5/SearchQuery lexical baseline against the fixed P2 Golden Dataset and publish failures, not only an aggregate score.

## Implemented evaluation contract

`src/knowledge/eval/ftsBaselineEvaluation.ts` defines the narrow P2-T04 metric contract over recorded `SearchQueryHit` observations. It intentionally does not become the generic P2-T09 benchmark framework.

Metrics:

- answerable-query Recall@10;
- MRR of the first required Stable Evidence overlap;
- all-required-Evidence coverage diagnostic;
- failure counts by query category;
- latency median/p95/max;
- peak RSS and FTS/index byte measurements supplied by the real run;
- no-answer query/hit counts as a diagnostic only.

Relevance is Stable Evidence based. A hit is relevant only when SourceVersion + ParsedArtifact match and the SearchQuery locator overlaps a required label's UTF-8 byte range. Chunk identity is not used as ground truth.

## Test coverage

`ftsBaselineEvaluation.test.ts` covers:

- a relevant hit at rank 2;
- multi-source query with only partial required-Evidence coverage;
- an answerable miss contributing category failures;
- a no-answer query with a lexical hit treated as diagnostic rather than false relevance;
- Recall@10/MRR/all-required coverage math;
- latency percentile/resource reporting;
- missing observations and invalid resource measurements.

## Publication target

`eval/reports/fts-baseline.md` is committed with every metric explicitly marked `UNRUN`. Numeric values must only be written from a real FTS5/SearchQuery execution over the fixed P2-T03 dataset.

This prevents source inspection, a simulated ranker or hand-selected hits from being represented as benchmark evidence.

## Verification debt

The current automation environment cannot execute the repository dependency tree or native `better-sqlite3`/FTS5 workload. In addition, the P1-T02 dependency/lockfile integration proven by the user's local environment has not yet propagated through this stacked GitHub ancestry.

Therefore the actual P2-T04 baseline remains OPEN:

- build the current corpus into a published FTS5 IndexBuild using current P1 chunk/index semantics;
- execute all 80 fixed queries through `SearchQueryApi` with `limit=10`;
- record per-query hit locators and wall-clock latency;
- measure peak RSS and FTS/index bytes;
- compute the report with the evaluator;
- publish development misses by query/category;
- keep holdout tuning-blind;
- run focused/static/build/package/full-suite gates.

No real Recall/MRR/resource number is claimed in this branch.

## Dependency assumptions

P2-T04 proceeds against still-PARTIAL P1-T12/P1-T13 FTS5/SearchQuery contracts and P2-T01..T03 dataset contracts. If the local dependency integration changes the FTS behavior or SearchQuery locator semantics, rerun this baseline rather than preserving obsolete numbers.

## Scope boundary

This task adds FTS baseline metric semantics, tests and report/verification records only. It does not add Chinese tokenization, code-symbol normalization, dense retrieval, vectors, RRF, generic benchmark orchestration, model calls or P3 behavior.
