# P2-T09 verification — Retrieval benchmark runner

Status: **PASS**

## Focused runner and ancestry evidence

Initial complete evidence run `34329322920` executed the Golden Dataset, representative corpus, query annotations, retrieval challenge corpus, FTS evaluator, P2-T09 runner, SearchQuery and FTS5 index suites.

Result: **8 files / 29 tests PASS**.

After cleaning the four P2-T09-owned style findings, canonical final revalidation run `34330083378` repeated the same focused suite and real development benchmark.

Final result:

```text
focused suite = 8 files / 29 tests PASS
retrievalBenchmarkRunner.ts lint findings = 0
retrievalBenchmarkRunner.test.ts lint findings = 0
```

Runtime probe:

```text
Ubuntu 24.04.4
Node 24.20.0
better-sqlite3 13.0.3
SQLite 3.53.4
FTS5 PASS
```

## Real development report

Support PR #52 executes the frozen FTS production path and records one real observation for every development query. It loads development query/label files only; holdout is not loaded.

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

Quality metrics reproduced exactly in the final run:

```text
queryCount = 50
scoredAnswerableQueries = 42
noAnswerQueries = 8
noAnswerQueriesWithAnyHit = 8
Recall@10 = 1
MRR = 0.9365079365079365
allRequiredEvidenceCoverage = 1
categoryFailureCounts = {}
indexBytes = 49152
```

Initial evidence artifact:

```text
run = 34329322920
artifact id = 10095148994
digest = sha256:079dc6b4a46c90136e274395d76ba63219e5c43e2ccb913135d5561364ca3672
```

Final revalidation artifact:

```text
run = 34330083378
artifact id = 10095437462
digest = sha256:bf01d27361280a9f1de92b176ead5919cb1c05555a146597fd46f64f8e3d93d1
```

Deterministic development dataset hash in both runs:

`949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3`

Latency and RSS varied between GitHub runners as expected; quality and persistent FTS allocation reproduced exactly. GitHub runner performance is not an Omarchy target-machine performance claim.

## Applicable variants

P2-T05 selected plain FTS. P2-T06 real development evidence rejected both fixed Dense profiles. Therefore the valid P2-T09 candidate set contains **FTS baseline only**. Dense/Hybrid observations are not fabricated merely to fill a comparison matrix.

## Holdout discipline

No holdout query or label is loaded by the P2-T09 development harness. P2-T05 already performed the allowed one-shot post-freeze FTS holdout acceptance. Holdout is not rerun for tuning.

## Repository gate classification

The final broad lint still reports inherited/concurrent repository errors, but none are in either P2-T09-owned TypeScript file. Typecheck and knip likewise expose pre-existing ancestry debt outside this task.

Those repository-wide findings do not invalidate P2-T09 and are not patched here merely to obtain global green CI.

## Corrected direct-base scope

Canonical #41 is based directly on P2-T06 / #38, bypassing rejected P2-T07/P2-T08 adoption paths.

Expected direct-base task scope remains exactly:

```text
src/knowledge/eval/retrievalBenchmarkRunner.ts
src/knowledge/eval/retrievalBenchmarkRunner.test.ts
eval/reports/retrieval-benchmark.md
docs/development/reports/P2-T09-retrieval-benchmark-runner.md
docs/development/verification/P2-T09-retrieval-benchmark-runner.md
```

No retriever implementation, provider/model code, product comparison or P3 work belongs here.

## Acceptance

**PASS.** P2-T09 has a reproducible real development report, complete provenance, no holdout contamination, focused tests green, and zero task-owned lint findings. Its evidence requirement for ADR-029 is complete.
