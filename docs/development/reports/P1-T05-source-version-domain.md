# P1-T05 — Source + SourceVersion domain

Status: **PARTIAL**  
Branch: `feat/p1-source-version-domain`  
Base: `feat/p1-content-addressed-blob-store`

## Scope

Implemented the first Source/SourceVersion domain layer on top of the P1-T02 schema and P1-T04 content-addressed blob-store contract.

## Behavior

`SourceDomain` provides:

- create Source;
- list active Sources in one Knowledge Workspace;
- optionally list archived Sources;
- rename Source metadata;
- archive Source without deleting historical versions;
- list SourceVersions;
- capture an immutable SourceVersion from exact raw bytes;
- manual update as the same byte-capture operation.

## Core invariant

Only exact raw-byte changes create a new SourceVersion.

The flow is:

```text
raw bytes
→ P1-T04 blob store computes SHA-256 and durably publishes bytes
→ lookup (source_id, content_sha256)
→ return existing immutable SourceVersion when unchanged
→ otherwise insert one new SourceVersion
```

Renaming or archiving a Source changes Source metadata only and never creates a SourceVersion. Re-capturing byte-identical content returns the existing version. Changed bytes produce a distinct version.

`blob_key` is currently the SHA-256 content address itself; domain code does not persist a mutable absolute blob path.

## Concurrency

The schema's `UNIQUE(source_id, content_sha256)` remains the final concurrency authority. If a concurrent identical capture wins the insert race, the losing caller reloads and returns the existing version rather than manufacturing a duplicate.

## Tests

`sourceDomain.test.ts` adds five contract scenarios:

1. create/list/rename/archive without version churn;
2. identical capture/manual update deduplication;
3. byte change as the only version-creation trigger;
4. unknown Source rejection;
5. Knowledge Workspace list isolation.

The tests use an in-memory contract fake for the P1-T02 database seam and the real filesystem P1-T04 blob store, keeping this task independent of unresolved native SQLite execution debt.

## Verification status

Executable focused/static/build/package/full-suite evidence is unavailable in the current GitHub-only automation environment. P1-T05 remains PARTIAL. In addition, real SQLite acceptance is transitively dependent on P1-T02/P1-T01 native-driver verification, while raw-byte durability is dependent on P1-T04 acceptance.

P1-T06 may proceed against the documented capture contract, but must treat file bytes as untrusted until its own containment/sensitive-file/race checks complete.
