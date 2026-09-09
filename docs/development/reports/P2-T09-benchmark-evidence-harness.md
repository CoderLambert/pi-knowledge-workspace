# P2-T09 support — Retrieval benchmark evidence harness

Status: **PASS**

## Purpose

Execute the frozen FTS baseline on the corrected expanded development corpus and feed complete real observations into P2-T09's `runRetrievalBenchmark()` + `renderRetrievalBenchmarkMarkdown()` implementation.

## Successful evidence

Initial complete run `34329322920` succeeded with artifact `10095148994` and digest `sha256:079dc6b4a46c90136e274395d76ba63219e5c43e2ccb913135d5561364ca3672`.

Final revalidation after P2-T09 task-owned lint cleanup also succeeded:

```text
run = 34330083378
artifact = 10095437462
digest = sha256:bf01d27361280a9f1de92b176ead5919cb1c05555a146597fd46f64f8e3d93d1
focused suite = 8 files / 29 tests PASS
P2-T09 task-owned lint findings = 0
```

Runtime:

```text
Ubuntu 24.04.4
Node 24.20.0
better-sqlite3 13.0.3
SQLite 3.53.4
FTS5 PASS
```

Observed corpus pressure: **38 total / 35 challenge chunks**.

Quality reproduced exactly across the evidence runs:

```text
queries: 50
answerable: 42
Recall@10: 1.0
MRR: 0.9365079365079365
all-required coverage: 1.0
category failures: none
FTS dbstat allocation: 49152 bytes
```

Final-run performance sample was median `0.411384 ms`, p95 `0.522166 ms`, max `2.587426 ms`, peak RSS `103907328` bytes. These runner measurements are environment-specific; they are not Omarchy target-machine claims.

Development dataset hash: `949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3`.

Artifacts contain generated Markdown, provenance/report JSON and all 50 development observations. No holdout files were loaded.

## Scope

Support-only. No production retrieval behavior, dataset mutation, Dense/vector/RRF adoption, provider/model calls, P2-T10/P2-T11 implementation or P3 code.
