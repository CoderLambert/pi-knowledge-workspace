# P2-T09 verification — Retrieval benchmark runner

Status: **OPEN / PARTIAL**

## 1. Focused tests

```bash
npm test -- \
  src/knowledge/eval/ftsBaselineEvaluation.test.ts \
  src/knowledge/eval/retrievalBenchmarkRunner.test.ts
```

PASS when all focused tests succeed.

## 2. Static/build/package gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Known inherited failures must be classified, not patched inside P2-T09 merely to make the suite green.

## 3. Development report generation

Use the fixed P2-T03 development split and recorded runs from the frozen candidate configurations. At minimum include the currently meaningful variants whose prerequisites have real evidence, for example:

```text
FTS baseline
selected lexical-normalization profile (if different)
selected Dense profile (only if P2-T06 proves one usable)
Hybrid + RRF (only if Dense is usable)
```

For every variant record:

- immutable configuration revision;
- one observation for every development query;
- ranked Stable locator hits;
- measured query latency;
- peak RSS;
- index/vector byte count.

Run `runRetrievalBenchmark(..., "development", variants)` and persist `renderRetrievalBenchmarkMarkdown(...)` output in `eval/reports/`.

PASS evidence must show:

- exact development query count;
- Recall@10;
- MRR;
- all-required-Evidence coverage;
- failure counts by category;
- explicit missed query ids;
- no-answer queries with any hits;
- median/p95/max latency;
- resource measurements.

Do not publish aggregate numbers without the failure sections.

## 4. Holdout isolation

Before P2-T12 selection is frozen, do **not** feed holdout observations into a development run.

The runner must reject an observation whose query id belongs to the other split.

After the configuration is frozen, run the exact same selected variants with:

```text
split = holdout
```

Do not retune from the holdout result.

## 5. Direct-base scope

```bash
git diff --check origin/experiment/p2-hybrid-rrf...HEAD
git diff --name-status origin/experiment/p2-hybrid-rrf...HEAD
```

The diff may contain only:

- retrieval benchmark runner;
- focused runner tests;
- P2-T09 report;
- P2-T09 verification guide;
- safe shared bookkeeping updates if available.

It must not contain direct-file Pi baseline implementation, external product comparison, Retrieval ADR, production retrieval changes, reranking or P3 work.

## Expected PASS evidence

P2-T09 can become PASS when focused/static/build/package gates are clean or inherited failures are explicitly classified, and at least one real fixed-dataset benchmark report has been generated reproducibly from recorded observations.

Until executable evidence exists, status remains PARTIAL and later tasks may consume only the documented report contract.
