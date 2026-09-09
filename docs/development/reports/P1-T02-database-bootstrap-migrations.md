# P1-T02 — Database bootstrap and migrations

Status: **PARTIAL**

## Scope

Implements the first Knowledge persistence boundary:

- ordered SQLite migration runner using `PRAGMA user_version`;
- fail-closed handling for a future/newer schema;
- transactional migration application with rollback on failure;
- initial schema for `installations`, `knowledge_workspaces`, `sources`, `source_versions`, `parsed_artifacts`, `index_builds`, `chunks`, `evidence`, `jobs`, and `job_attempts`;
- foreign keys, core uniqueness constraints and lookup indexes;
- reusable `withTransaction` helper;
- `openKnowledgeDatabase` bootstrap with foreign keys and WAL for file databases;
- ADR-selected `better-sqlite3` 13.x declared as a production dependency through npm-generated package + lock metadata;
- seven focused tests, including a real SQLite / FK / FTS5 smoke through `openKnowledgeDatabase`.

## Direct base

`experiment/p1-sqlite-driver-decision` / P1-T01.

P1-T01 selected `better-sqlite3` 13.x. P1-T02 follows that ADR and does not introduce a database abstraction framework or a second driver.

## Dependency integration

Commit `926e1ae1` closes the earlier manifest/lockfile defect. `npm install better-sqlite3@13.0.3` updated `package.json` and `package-lock.json` together, and a subsequent clean `npm ci` reproduced the dependency as `better-sqlite3@13.0.3`.

The runtime still loads the selected package through the narrow database seam and fails explicitly if dependencies are absent; no fallback driver was added.

## Local verification evidence — 2026-09-09

Verified on the user's Omarchy/Linux checkout with Node 26.7.0:

- clean `npm ci`: PASS;
- `npm ls better-sqlite3`: `13.0.3`;
- direct native load: PASS;
- SQLite version observed: `3.53.4`;
- real FTS5 virtual table create/insert/MATCH query: PASS;
- `src/knowledge/storage/database.test.ts`: **7/7 PASS**;
- real `openKnowledgeDatabase(":memory:")`: PASS;
- `PRAGMA user_version`: expected schema version;
- `PRAGMA foreign_keys`: `1`;
- `npm run typecheck`: PASS;
- `npm run knip`: PASS (`Excellent, Knip found no issues`; one non-failing redundant-entry configuration hint remains);
- `npm run build`: PASS;
- `npm run pack:dry`: PASS, including `dist/knowledge/storage/database.js` and migration/service outputs;
- pre-commit `npm run verify:staged`: PASS for cached typecheck, Knip, staged ESLint and related Vitest;
- `git diff --check`: PASS.

Earlier local verification on the later P1 stack additionally demonstrated real file-backed migrations, WAL, FTS5, transaction rollback, backup/reopen and schema-version behavior. Those results reduce driver risk but do not replace this task's remaining package-install/full-gate acceptance.

## Remaining verification debt

P1-T02 remains PARTIAL. Required closure still includes:

1. `npm pack` followed by installation into a clean isolated directory and loading packaged `openKnowledgeDatabase()` through the installed package/native dependency;
2. repository-wide lint/full-suite classification required by the verification guide, without patching inherited PI WEB failures merely for green;
3. final direct-base scope review after all P1-T02 bookkeeping changes.

P1-T01 separately retains extension-loading feasibility and any remaining driver-level packaging acceptance not owned by this task.

## Deferred assumptions consumed by later tasks

Later P1/P2 tasks may now rely on locally proven `better-sqlite3` 13.0.3 + FTS5 availability on the target machine, while still treating package-install and unresolved phase-gate debt as PARTIAL rather than PASS.
