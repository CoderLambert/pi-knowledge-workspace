# P1-T01 — SQLite Driver Decision Spike Report

## Task metadata

- **Task:** P1-T01
- **Phase:** P1 — Stable Evidence Core
- **Date:** 2026-09-09
- **Branch:** `experiment/p1-sqlite-driver-decision`
- **Stacked base:** `chore/p0-gate-review` (P0-T08 / PR #10)
- **Status:** **PARTIAL**
- **ADR:** `docs/architecture/ADR-028-sqlite-driver.md`
- **Verification guide:** `docs/development/verification/P1-T01-sqlite-driver-decision.md`
- **P1-T02 implementation mixed into this branch:** no

## Objective

Choose the smallest reliable SQLite driver for the standalone `pi-knowledge` process without introducing a generic database abstraction.

The concrete candidates were limited to:

- Node built-in `node:sqlite`;
- `better-sqlite3`.

## Repository constraints

Current repository constraints relevant to the decision:

- package engine: Node `>=22.19.0`;
- standalone Knowledge process already exists as a Node entry point;
- P1-T12 requires an FTS5 lexical baseline;
- P1-T20/P1-T21 require backup/restore support;
- P2-T07 may later experiment with sqlite-vec, but vector extension adoption is explicitly optional;
- local-first/single-user architecture favors a simple synchronous embedded database over a network database or queue.

## Current upstream findings

### node:sqlite

Current Node documentation shows:

- `DatabaseSync` is available from Node 22.5;
- extension loading is available from Node 22.13;
- busy timeout support is available from Node 22.16;
- online `sqlite.backup()` is available from Node 22.16;
- the module is still documented as release-candidate stability in current Node documentation.

The material blocker is FTS5 portability. Public Node ecosystem reports and the Node issue tracker document official Node binaries where `node:sqlite` cannot create an FTS5 virtual table (`no such module: fts5`). That means the application's required lexical baseline would depend on the exact Node build/platform rather than merely the declared Node version.

### better-sqlite3

Current upstream `master` identifies version 13.0.3 and Node `>=22`. The 13.x package exports platform-specific bindings and uses Node-API. Its SQLite build configuration explicitly includes `SQLITE_ENABLE_FTS5`.

Upstream also documents/ships:

- transaction support;
- synchronous prepared statements;
- extension support;
- backup support;
- worker-thread compatibility for workloads that later prove too expensive for the main service thread.

## Decision

Recommend **`better-sqlite3` 13.x** for V1 and record the choice in ADR-028.

The main reason is not raw performance. It is **feature determinism**: P1 requires FTS5, and better-sqlite3 intentionally compiles FTS5 into its bundled SQLite, while node:sqlite FTS5 availability has varied across official runtime builds.

Avoid a dual-driver compatibility layer. If target packaging validation later disproves the recommendation, reopen the ADR rather than carrying two production backends.

## Why this task is PARTIAL

The architectural/package decision is complete enough for P1-T02 to proceed, but target-machine evidence is still missing. The autonomous environment cannot install/run the repository dependency tree or validate a native binding on the user's Omarchy x64 environment.

Required target evidence includes:

- package installation/resolution under the supported Node runtime;
- FTS5 create/query;
- commit/rollback behavior;
- online backup/open/query;
- safe extension loading feasibility;
- package/build integration after P1-T02 actually adds the dependency.

This is recorded as verification debt. P1-T02 may proceed against the selected-driver contract under the autonomous-development policy.

## Tests / executable changes

None intentionally added in P1-T01.

This is an analysis/architecture decision task and does not add the driver dependency or database runtime yet. Adding dependency-backed executable tests here would partially implement P1-T02 and mix task scopes. P1-T02 must add focused database bootstrap/migration tests when the selected driver enters production dependencies.

## Security / architecture notes

- SQLite stays inside standalone `pi-knowledge`; sessiond/browser plugins must not open the Knowledge DB.
- `loadExtension` must be disabled by default and enabled only in narrowly controlled code paths if a later approved extension actually needs it.
- sqlite-vec is not adopted by this decision.
- no ORM/repository framework is justified by this task.
- no connection-pool abstraction is justified for V1.

## P0 dependency risk

P0 remains PARTIAL at the phase gate because P0-T04..T07 acceptance debt is unresolved. P1-T01 does not depend on those runtime invariants for the driver comparison itself. P1-T02 will continue to place persistence behind the standalone `pi-knowledge` process boundary defined by P0-T03/P0-T04; that boundary remains a documented but partially unverified dependency.

## Result

**PARTIAL — better-sqlite3 13.x is the recommended V1 driver and ADR-028 records the decision. Target Omarchy/Node native-package, FTS5, backup and extension checks remain OPEN verification debt; P1-T02 may proceed without introducing a dual-driver abstraction.**
