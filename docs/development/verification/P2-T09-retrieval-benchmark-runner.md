# P2-T09 verification — Retrieval benchmark runner

Status: **PARTIAL — REAL DEVELOPMENT BENCHMARK PASS / STYLE CLEANUP OPEN**

## Focused runner and ancestry evidence

GitHub Actions run `34329322920` executed:

```text
Golden Dataset
representative corpus
query annotations
retrieval challenge corpus
FTS baseline evaluator
P2-T09 benchmark runner
SearchQuery
FTS5 index
```

Result: **8 files / 29 tests PASS**.

Runtime probe:

```text
Ubuntu 24.04.4
Node 24.20.0
better-sqlite3 13.0.3
SQLite 3.53.4
FTS5 PASS
```

## Real development report

Support PR #52 executes the frozen FTS retrieval path and records one real observation for every development query. It loads development query/label files only; holdout is not loaded.

Production path:

```text
openKnowledgeDatabase
→ canonicalizeParsedArtifact
→ chunkParsedArtifact
→ Fts5BaselineIndex
→ IndexBuildPublisher
→ SearchQueryApi
→ runRetrievalBenchmark(dataset, "development", ...)
→ renderRetrievalBenchmarkMarkdown(report)
```

Frozen configuration:

```text
retriever = sqlite-fts5
tokenizer = unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
topK = 10
corpusChunks = 38
challengeChunks = 35
```

Generated metrics:

```text
queryCount = 50
scoredAnswerableQueries = 42
noAnswerQueries = 8
noAnswerQueriesWithAnyHit = 8
Recall@10 = 1
MRR = 0.9365079365079365
allRequiredEvidenceCoverage = 1
categoryFailureCounts = {}
median = 0.794373 ms
p95 = 1.334205 ms
max = 3.400616 ms
peakRssBytes = 105443328
indexBytes = 49152
```

Artifact:

```text
run = 34329322920
artifact id = 10095148994
digest = sha256:079dc6b4a46c90136e274395d76ba63219e5c43e2ccb913135d5561364ca3672
development dataset hash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
```

Artifact contents include generated Markdown, provenance/report JSON and all 50 development observations.

`eval/reports/retrieval-benchmark.md` has been replaced by the generated Markdown rather than manually transcribed metrics.

## Applicable variants

P2-T05 selected plain FTS. P2-T06 real development evidence rejected both fixed Dense profiles. Therefore no Dense or Hybrid benchmark row is required or valid for the final candidate set; do not fabricate observations merely to fill a matrix.

## Holdout discipline

No holdout query or label is loaded by the P2-T09 development harness. P2-T05 already performed the allowed one-shot post-freeze FTS holdout acceptance. Do not rerun holdout for tuning.

## Repository gate classification

Repository-wide typecheck/lint/knip diagnostics still expose inherited ancestry debt. Do not patch those failures inside P2-T09 merely for green CI.

P2-T09-owned lint findings remain:

```text
src/knowledge/eval/retrievalBenchmarkRunner.test.ts
  three forbidden non-null assertions
src/knowledge/eval/retrievalBenchmarkRunner.ts
  one no-unnecessary-condition finding
```

These are style-only task cleanup debt. They keep the task formally PARTIAL but do not invalidate the real generated benchmark.

If cleaned, rerun targeted lint and `retrievalBenchmarkRunner.test.ts`. A full retrieval evidence rerun is unnecessary for semantics-preserving style-only edits unless the runner behavior changes.

## Corrected direct-base scope

Canonical #41 is now based directly on P2-T06 / #38, bypassing rejected P2-T07/P2-T08 adoption paths.

Expected direct-base task scope remains:

```text
src/knowledge/eval/retrievalBenchmarkRunner.ts
src/knowledge/eval/retrievalBenchmarkRunner.test.ts
eval/reports/retrieval-benchmark.md
docs/development/reports/P2-T09-retrieval-benchmark-runner.md
docs/development/verification/P2-T09-retrieval-benchmark-runner.md
```

No retriever implementation, provider/model code, product comparison or P3 work belongs here.

## Evidence-complete condition

The evidence requirement needed for ADR-029 is now complete for P2-T09: at least one complete real development report was generated reproducibly using the actual runner.

Formal task PASS still requires the four task-owned lint findings to be cleaned or intentionally waived by repository policy. That cleanup is not an ADR blocker.
