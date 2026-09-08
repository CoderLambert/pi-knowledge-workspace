# ADR-028 — Use better-sqlite3 for the V1 Knowledge database

- **Status:** Proposed / pending target-runtime verification
- **Date:** 2026-09-09
- **Decision owner:** P1-T01 — SQLite driver decision spike

## Context

Pi Knowledge Workspace needs one local SQLite database for durable Knowledge state. The development plan requires:

- transactions;
- FTS5 lexical search;
- backup/restore support;
- optional extension loading for later experiments such as sqlite-vec;
- Node compatibility with this repository (`node >=22.19.0`);
- simple packaging for a single-user local-first application;
- no generic database abstraction framework.

The realistic candidates are the Node built-in `node:sqlite` module and `better-sqlite3`.

## Decision

Use **`better-sqlite3` 13.x** as the V1 Knowledge database driver, subject to the target-runtime verification checklist in P1-T01.

Do not add a driver abstraction layer. P1-T02 should import the chosen driver directly behind Knowledge-owned database bootstrap/migration modules.

## Why not node:sqlite

`node:sqlite` is attractive because it adds no npm dependency and its current API includes synchronous database access, transactions, extension loading and backup. With the repository's Node floor (`>=22.19.0`), the needed `loadExtension`, busy timeout and backup APIs exist.

The blocking issue is FTS5 portability. Official Node binaries have historically varied in whether the bundled SQLite exposes FTS5 across versions/platforms. P1-T12 requires an FTS5 baseline, so relying on runtime-dependent FTS5 availability would turn a core V1 invariant into an installation lottery or force an additional extension-distribution strategy.

A startup capability check would detect the problem but would not solve it. Falling back to LIKE/FTS4 would also change the planned retrieval baseline and benchmark semantics.

## Why better-sqlite3

Current `better-sqlite3` 13.x fits the repository constraints:

- package engine is Node `>=22`;
- v13 uses Node-API rather than direct V8 ABI coupling;
- package exports platform-specific prebuilt bindings;
- its bundled SQLite build explicitly enables `SQLITE_ENABLE_FTS5`;
- synchronous API matches the single-process `pi-knowledge` architecture;
- full transaction support is a first-class capability;
- online backup API is available;
- loadable SQLite extensions are supported;
- worker threads remain available later if genuinely expensive database work needs isolation.

The native dependency cost is acceptable: this repository already ships native/runtime-sensitive components such as `node-pty`, and the Knowledge service is intentionally a local desktop/server process rather than a browser-only package.

## Candidate matrix

| Criterion | node:sqlite | better-sqlite3 13.x |
|---|---|---|
| Extra npm dependency | Best: none | Additional dependency |
| Node >=22.19 compatibility | Yes | Yes |
| Synchronous API | Yes | Yes |
| Transactions | Yes | Yes |
| Backup | Yes (`sqlite.backup`, Node >=22.16) | Yes (`db.backup`) |
| Extension loading | Yes (Node >=22.13, when enabled) | Yes |
| FTS5 | Not a reliable cross-build invariant | Explicitly compiled into bundled SQLite |
| Native packaging risk | Lowest dependency count, but tied to Node bundled SQLite features | Native binding/prebuild risk; v13 materially reduces ABI/install risk via Node-API/prebuilds |
| Future sqlite-vec experiment | Possible but requires target verification | Better-established extension-loading path; still must be verified in P2 |
| Fit for required P1 FTS5 baseline | Conditional | Preferred |

## Operational constraints

P1-T02 should establish the following from the first database open:

- one Knowledge-owned connection per service process unless a measured need proves otherwise;
- WAL mode only after explicit test on the target filesystem;
- `foreign_keys = ON`;
- bounded busy timeout;
- migrations inside explicit transactions where SQLite permits;
- no DB access from sessiond/browser plugin code;
- database file owned by standalone `pi-knowledge`;
- no dynamic driver selection at runtime.

## Verification required before Accepted

On the target Omarchy/Node environment:

1. install the selected `better-sqlite3` 13.x package using the repository package manager;
2. import/open `:memory:` under the repository's supported Node version;
3. create/query an FTS5 virtual table;
4. execute commit and rollback transaction cases;
5. create a file-backed DB and run online backup, then open/query the backup;
6. exercise `loadExtension` with a safe local test extension when practical; sqlite-vec adoption itself remains P2-T07;
7. run typecheck/lint/knip/build/package dry-run/full tests after dependency integration in P1-T02;
8. verify the packaged application can resolve the native binding on target x64 Linux.

If target packaging fails in a way that cannot be fixed without disproportionate native distribution complexity, reopen this ADR and evaluate a pinned Node runtime plus `node:sqlite` + explicit FTS5 capability/distribution strategy. Do not silently add a dual-driver abstraction.

## Consequences

### Positive

- FTS5 becomes an intentional application dependency instead of an accidental Node-build property.
- P1-T12 lexical baseline can use one stable SQLite feature set.
- Backup and extension experiments remain available.
- P1-T02 can stay small and direct.

### Negative

- adds a native npm dependency and platform packaging surface;
- dependency upgrades can change bundled SQLite and require migration/compatibility review;
- extension compatibility still requires target-machine verification.

## Non-decisions

This ADR does not choose:

- sqlite-vec for production;
- Dense retrieval;
- WAL tuning values;
- schema/migration design;
- connection pooling;
- a generic repository/ORM layer.

Those are later tasks and must be justified independently.
