# P1-T19 — IndexBuild pin / lease / GC

Status: **PARTIAL**

Branch: `feat/p1-index-build-pin-lease-gc`  
Direct base: `feat/p1-atomic-index-build-publication`

## Scope implemented

P1-T19 adds the retention layer required after P1-T18 begins retaining replaced active IndexBuilds.

The retention rule is intentionally narrow:

> An IndexBuild may be garbage-collected only when it is `retained`, is not the Workspace's active pointer, and has no live lease or durable pin.

Index GC never deletes Source, SourceVersion, ParsedArtifact or Evidence history. Archiving a Source therefore does not make its historical evidence collectible.

## Schema v7

Added `index_build_pins`:

```text
id
index_build_id -> index_builds ON DELETE CASCADE
owner_type
owner_id
lease_expires_at NULL = durable pin
created_at
updated_at
UNIQUE(index_build_id, owner_type, owner_id)
```

Indexes support build/expiry and expiry scans.

## Pin semantics

`IndexBuildRetention.pin()` supports two forms:

- leased pin: finite `lease_expires_at`, appropriate for active query/answer execution;
- durable pin: `lease_expires_at = NULL`, reserved for future durable owners such as saved artifacts that intentionally require a build snapshot.

Pins are idempotent by `(build, owner_type, owner_id)`. Leased pins can be renewed only while still live; durable/expired pins are not silently transformed by `renew()`.

## Atomic active-query acquisition

`acquireActiveLease()` runs inside `BEGIN IMMEDIATE`:

```text
read Workspace active pointer
→ verify same-Workspace active + published build
→ insert query lease
→ commit
```

This closes the unsafe window that would exist if search resolved a build first and tried to pin it later.

`SearchQueryApi` now uses this leased resolver by default. It keeps the pin for the complete FTS + metadata hydration operation and releases it in `finally`, including fail-closed metadata errors.

A finite 60-second lease prevents a crashed process from creating a permanent query pin. Search remains synchronously bounded; longer-running Answer execution can use explicit lease renewal in P3.

## GC

`gcRetained(workspace, limit)`:

1. scans a bounded set of `retained` builds;
2. excludes the current Workspace active pointer;
3. excludes any build with a durable pin or unexpired lease;
4. rechecks eligibility inside the destructive transaction;
5. deletes FTS rows;
6. deletes chunk rows;
7. deletes only the retained IndexBuild row.

It intentionally leaves immutable source/artifact/evidence history untouched.

Expired pins can be cleaned with a separate bounded cleanup operation.

## Locked invariants

1. Active build is never a GC candidate.
2. Retained build with a live lease is never a GC candidate.
3. Retained build with a durable pin is never a GC candidate.
4. Expired leases do not retain data forever.
5. Search acquires a pin in the same transaction that resolves active publication authority.
6. Search releases its lease on success and failure.
7. GC is Workspace-scoped and bounded.
8. GC removes index-derived data only; Evidence history survives.
9. Source archive state is not a deletion signal.
10. No external GC/lease service is introduced.

## Tests

Focused coverage exercises:

- atomic active-build lease acquisition;
- durable future-owner pins;
- renewal constraints;
- bounded expired-pin cleanup;
- GC eligibility predicates and index-only deletion;
- preservation of SourceVersion/ParsedArtifact/Evidence history;
- SearchQuery lease usage and release on success/error;
- schema-v7 migration shape/rollback.

## Deferred verification

P1-T19 remains PARTIAL pending repository executable/static/build/package/full-suite gates and real multi-connection SQLite acceptance. Required real cases include publication while a query lease is active, concurrent GC, lease expiry after simulated process crash, durable pin retention, and Evidence readability after old IndexBuild GC.

## Scope check

Direct-base comparison must contain only schema-v7 pin/lease/GC, Search query lease integration, tests and task records/bookkeeping. P1-T20 backup CLI, restore, vector/model/UI work and unrelated fixes are out of scope.
