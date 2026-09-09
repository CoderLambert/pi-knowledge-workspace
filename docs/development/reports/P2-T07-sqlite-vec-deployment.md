# P2-T07 — sqlite-vec deployment spike

Status: **PARTIAL**

## Objective

Verify whether sqlite-vec can be loaded, restarted, queried with correct scope semantics and operated within acceptable latency/resource bounds on the target Omarchy/Node environment before any adoption decision.

## Direct base

P2-T06 / `experiment/p2-dense-retrieval-adapter` / PR #38.

This task is stacked and is not independently merge-safe before its base.

## Implemented scope

`src/knowledge/eval/sqliteVecDeploymentProbe.ts` defines a narrow runtime probe over a database object exposing `loadExtension`, `exec` and `prepare`.

The probe:

- requires an explicit absolute extension path;
- loads the extension and records `SELECT vec_version()`;
- creates an evaluation-only cosine `vec0` table;
- uses a metadata `scope` column;
- inserts vectors in two scopes;
- performs KNN through `embedding MATCH ?`, `scope = ?`, and `k = ?`;
- fails if another scope leaks into the returned Top-K;
- always drops the probe table in `finally`.

The implementation deliberately does **not** add sqlite-vec as a production dependency, pin a pre-v1 sqlite-vec release into architecture, or modify Knowledge production schema/startup.

## Upstream contract checked

Current sqlite-vec upstream documentation still describes the project as pre-v1, provides an npm/Node distribution path, uses `vec0` virtual tables and supports metadata/partition filtering inside KNN queries. The probe records the actual runtime `vec_version()` so the deployed revision is evidence rather than an assumption.

## Tests written

`sqliteVecDeploymentProbe.test.ts` covers:

- explicit extension loading and runtime version capture;
- expected inserts across two scopes;
- KNN SQL contains MATCH, metadata scope and `k = ?`;
- cleanup after success;
- non-absolute path rejection before SQLite access;
- fail-closed cross-scope leakage detection;
- invalid version metadata rejection.

## Report integrity

`eval/reports/sqlite-vec-deployment.md` keeps install/load/restart/KNN/concurrency/latency/RSS/size fields `UNRUN` until target execution.

No adoption decision is made by this branch.

## Dependency assumptions / risk

P2-T07 depends on:

- P1-T01/P1-T02 `better-sqlite3` extension-loading/native SQLite boundary;
- P2-T06 dense vector metadata and SourceVersion scope contract.

The user's target machine has already proven `better-sqlite3` + FTS5, but sqlite-vec extension loading itself remains unverified. Dense retrieval quality also remains unverified. This task proceeds as an optional deployment spike under the autonomous policy.

## Verification state

Target extension/package resolution, load/reload after restart, real KNN, concurrent access, p95, memory and DB/index-size measurements are unavailable in the GitHub automation environment and remain OPEN verification debt.

## Out of scope

- adopting sqlite-vec;
- production vector schema/migrations;
- embedding model selection;
- hybrid/RRF;
- reranking;
- remote/distributed vector infrastructure.
