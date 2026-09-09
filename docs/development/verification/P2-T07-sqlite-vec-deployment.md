# P2-T07 verification — sqlite-vec deployment spike

Status: **OPEN / PARTIAL**

## 1. Focused contract test

```bash
npm test -- src/knowledge/eval/sqliteVecDeploymentProbe.test.ts
```

PASS evidence:

- an explicit absolute extension path is required;
- runtime `vec_version()` is captured;
- probe table uses `vec0` with cosine distance;
- KNN SQL contains `embedding MATCH ?`, metadata scope and `k = ?`;
- cross-scope rows fail closed instead of being post-filtered after a global Top-K;
- probe cleanup runs on success/failure.

## 2. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Classify inherited failures; do not patch unrelated PI WEB code merely to obtain green.

## 3. Resolve a trusted target extension

On the supported Omarchy/Linux target, install or otherwise obtain sqlite-vec from the official sqlite-vec distribution path only. Record:

```text
OS / architecture
Node version
better-sqlite3 version
sqlite-vec package/source
exact package/release version
extension absolute path
binary/file hash when practical
```

Do not use an untrusted extension binary simply to satisfy this check.

Because sqlite-vec is pre-v1, the acceptance record must include the runtime `vec_version()` value. Do not treat an unrecorded/latest release as a stable architecture contract.

## 4. Real extension load and restart

Using the same `better-sqlite3` boundary selected by ADR-028:

1. open a temporary file-backed SQLite database;
2. load the resolved sqlite-vec extension;
3. execute `SELECT vec_version()`;
4. run `runSqliteVecDeploymentProbe` with the actual extension path;
5. close the process/database completely;
6. reopen in a new process, reload the same extension, and rerun the probe.

PASS requires reproducible load after restart without hidden interactive/manual state.

## 5. Scoped KNN semantics

The real probe must prove that metadata scope is part of the KNN SQL before Top-K:

```sql
WHERE embedding MATCH ?
  AND scope = ?
  AND k = ?
```

A global KNN followed by application-side scope filtering does not satisfy this task.

Add an adversarial row in another scope whose vector is closer than an allowed-scope row. The returned scoped Top-K must still contain only allowed-scope rows.

## 6. Concurrency smoke

Using a file-backed DB and the expected local workload shape:

- hold at least one reader connection performing repeated scoped KNN queries;
- perform bounded vector insert/update/build work on another connection;
- confirm no corruption, process crash or silent cross-scope result;
- record any `SQLITE_BUSY`/locking behavior and the chosen timeout/retry policy if required.

This is a deployment spike, not a high-concurrency benchmark.

## 7. Latency and resource measurements

On a representative fixed vector set, record:

- query p50 / p95 / max;
- peak RSS;
- SQLite database bytes;
- vector table/index bytes;
- vector count and dimensions;
- build/load duration.

Compare these values with the P2-T06 brute-force in-memory evaluation path for the same vector set where practical.

## 8. Adoption decision

Adoption is optional. Record **do not adopt** if any mandatory condition fails, including:

- extension cannot load/reload reproducibly;
- scoped filtering cannot be proven inside KNN;
- concurrency behavior is unsafe for the V1 local workload;
- packaging requires brittle/unsupported binary handling;
- latency/memory/index-size does not justify the added native-extension complexity.

A failed sqlite-vec spike does not invalidate dense-quality evaluation; P2-T06 can continue using the in-memory index.

## 9. Direct-base scope

```bash
git diff --check origin/experiment/p2-dense-retrieval-adapter...HEAD
git diff --name-status origin/experiment/p2-dense-retrieval-adapter...HEAD
```

Expected P2-T07-only scope: deployment probe/test, UNRUN deployment report, task report/verification and safe bookkeeping. No production dependency/schema, hybrid/RRF or P3 implementation belongs here.

## PASS condition

P2-T07 remains PARTIAL until target extension load/restart, scoped KNN, concurrency and resource evidence is recorded together with repository gates and a clear adopt/do-not-adopt decision. Later tasks may proceed against the probe contract while treating sqlite-vec adoption as unverified.
