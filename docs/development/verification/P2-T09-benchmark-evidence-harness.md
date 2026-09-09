# P2-T09 support verification — Retrieval benchmark evidence harness

Status: **PASS**

GitHub Actions run `34329322920` satisfied the support contract:

- dependency install succeeded;
- pinned evidence-only `better-sqlite3@13.0.3` loaded SQLite 3.53.4 with FTS5;
- focused Golden Dataset/challenge/FTS/SearchQuery/P2-T09 tests: **8 files / 29 tests PASS**;
- production parser/chunker yielded exactly **38 total / 35 challenge chunks**;
- all 50 development queries produced real observations;
- `runRetrievalBenchmark(..., "development", ...)` and Markdown rendering succeeded;
- artifact `10095148994` uploaded 3 evidence files;
- artifact digest `sha256:079dc6b4a46c90136e274395d76ba63219e5c43e2ccb913135d5561364ca3672`;
- deterministic development-dataset hash `949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3`;
- no holdout query/label files were loaded.

Generated metrics: Recall@10 1.0, MRR 0.9365079365079365, all-required coverage 1.0, p95 1.334205 ms, peak RSS 105443328 bytes, FTS dbstat allocation 49152 bytes.

Repository-wide diagnostic failures remain inherited ancestry debt and do not invalidate this support run. P2-T09's own style-only lint cleanup remains on the owning task.

Direct-base support scope remains workflow + script + support report + this guide only. No production behavior or P3 work is included.
