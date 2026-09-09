# P2-T09 support — Retrieval benchmark evidence harness

Status: **PASS**

## Purpose

Execute the frozen FTS baseline on the corrected expanded development corpus and feed complete real observations into P2-T09's `runRetrievalBenchmark()` + `renderRetrievalBenchmarkMarkdown()` implementation.

## Successful evidence

GitHub Actions run `34329322920` completed successfully.

Artifact: `10095148994`

Digest: `sha256:079dc6b4a46c90136e274395d76ba63219e5c43e2ccb913135d5561364ca3672`

Runtime:

```text
Ubuntu 24.04.4
Node 24.20.0
better-sqlite3 13.0.3
SQLite 3.53.4
FTS5 PASS
```

Focused suite: **8 files / 29 tests PASS**.

Observed corpus pressure: **38 total / 35 challenge chunks**.

Generated development result:

```text
queries: 50
answerable: 42
Recall@10: 1.0
MRR: 0.9365079365079365
all-required coverage: 1.0
category failures: none
median / p95 / max: 0.794373 / 1.334205 / 3.400616 ms
peak RSS: 105443328 bytes
FTS dbstat allocation: 49152 bytes
```

Development dataset hash: `949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3`.

Artifact contains generated Markdown, provenance/report JSON and all 50 development observations. No holdout files were loaded.

## Scope

Support-only. No production retrieval behavior, dataset mutation, Dense/vector/RRF adoption, provider/model calls, P2-T10/P2-T11 implementation or P3 code.
