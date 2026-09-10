# P1-T03 — Knowledge installation / Workspace identity

Status: **PARTIAL**

## Result

Introduces durable Knowledge identity independently of PI WEB routing identity:

- one durable `installation_id` per Knowledge database;
- one `knowledge_workspace_id` per `(installation_id, canonical realpath)`;
- canonical identity uses `realpathSync.native`, not the caller's lexical path;
- PI WEB/Machine routing information is stored only as mutable `external_binding` metadata;
- changing the external binding does not change Knowledge Workspace identity;
- different worktree realpaths remain isolated by default.

## Direct base

`feat/p1-database-bootstrap-migrations` / P1-T02 / PR #12.

This task consumes P1-T02's still-unverified schema contract behind the narrow `KnowledgeDatabase` interface. It does not alter migrations or introduce P1-T04 blob storage.

## Tests added

Contract tests cover stable identity for repeated resolution, different-realpath/worktree isolation, and external-binding rebinding without identity churn.

## Deferred risk

P1-T02's native `better-sqlite3`/lockfile and real-SQLite acceptance debt remains open. Therefore this task cannot claim persistence acceptance until both P1-T02 and the focused P1-T03 tests run against the real driver.
