# P2-T04 verification — FTS baseline report

Status: **OPEN / PARTIAL**

Branch: `experiment/p2-fts-baseline-report`  
Direct base: `data/p2-query-annotation`

## 1. Focused metric semantics

```bash
npm ci
npm test -- \
  src/knowledge/eval/goldenDataset.test.ts \
  src/knowledge/eval/representativeCorpus.test.ts \
  src/knowledge/eval/queryAnnotations.test.ts \
  src/knowledge/eval/ftsBaselineEvaluation.test.ts
```

PASS requires all P2 dataset/evaluator contract tests to pass.

## 2. Real FTS baseline execution

Use the current supported `better-sqlite3` runtime and current P1 chunk/index/search implementation.

Required run:

1. Load the three fixed P2-T02 corpus snapshots as immutable ParsedArtifacts.
2. Build one current published FTS5 IndexBuild using the current P1 chunking/indexing path.
3. Execute every P2-T03 query exactly once through `SearchQueryApi` with `limit = 10` and no query-specific tuning.
4. Record each query id, wall-clock latency and returned hit `sourceVersionId + parsedArtifactId + [startByte,endByte)`.
5. Record peak process RSS and measured FTS/index bytes.
6. Pass the complete observations/resources to `evaluateFtsBaseline`.
7. Replace every `UNRUN` field in `eval/reports/fts-baseline.md` with the observed values.
8. List every missed development query with category and returned top hits. Do not use holdout misses to tune later parameters.

Do not substitute a hand-written/simulated result list for the real SQLite/SearchQuery run.

## 3. Metric acceptance

Check that:

- Recall@10 scores answerable queries only;
- MRR uses the first top-10 hit overlapping any required Stable Evidence;
- all-required-Evidence coverage requires every required label for a query;
- multi-source comparison queries therefore require both historical SourceVersions for full required-Evidence coverage;
- category failure counts are emitted for answerable misses;
- no-answer lexical-hit count is diagnostic only and is not misreported as no-answer accuracy;
- resource and latency numbers are measured, not estimated.

## 4. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/data/p2-query-annotation...HEAD
git diff --name-status origin/data/p2-query-annotation...HEAD
```

Classify inherited failures only when their signature is unchanged; do not patch unrelated PI WEB failures in this experiment.

## 5. Scope

P2-T04 direct-base diff may contain only:

- narrow FTS baseline metric evaluator/tests;
- `eval/reports/fts-baseline.md`;
- P2-T04 report/verification/bookkeeping.

No P2-T05 lexical normalization/tokenizer code, dense/vector/RRF implementation, P2-T09 generic benchmark framework, model runtime or P3 work belongs here.

## PASS condition

P2-T04 remains PARTIAL until the real fixed-dataset FTS5/SearchQuery run is executed and the numeric report plus development failure list are committed, with focused/static/build/package/full-suite and scope gates recorded.
