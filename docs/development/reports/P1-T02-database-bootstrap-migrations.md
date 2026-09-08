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
- contract tests for schema coverage, idempotency, future-schema rejection, migration rollback, commit and rollback semantics.

## Direct base

`experiment/p1-sqlite-driver-decision` / P1-T01.

P1-T01 selected `better-sqlite3` 13.x. P1-T02 follows that ADR and does not introduce a database abstraction framework or a second driver.

## Important dependency state

The GitHub-only autonomous environment cannot safely regenerate the repository's large `package-lock.json`. Adding `better-sqlite3` only to `package.json` would deliberately make `npm ci` inconsistent, so this branch does **not** perform a partial dependency-manifest edit.

`database.ts` therefore loads the ADR-selected package through a narrow runtime seam and fails explicitly if dependencies have not yet been installed. Before P1-T02 can become PASS, `better-sqlite3@^13.0.3` must be added through npm so both `package.json` and `package-lock.json` are generated together, followed by the executable checks in the verification guide.

This is verification/integration debt, not a reason to substitute `node:sqlite` contrary to ADR-028.

## Verification performed autonomously

Static review of the migration algorithm and task-only branch construction was performed. No executable repository checkout or dependency tree is available in this environment, so no test/typecheck/lint/build result is claimed.

## Deferred assumptions consumed by later tasks

Later P1 tasks may assume:

1. schema version 1 is the initial Evidence Core schema;
2. a database with `user_version > 1` is rejected;
3. migrations are atomic;
4. foreign keys are enabled on opened Knowledge databases;
5. file-backed databases use WAL;
6. P1-T03 may populate installation/workspace identity using the tables created here.

The native driver/install and real-SQLite execution remain unverified and must not be cited as PASS evidence.
