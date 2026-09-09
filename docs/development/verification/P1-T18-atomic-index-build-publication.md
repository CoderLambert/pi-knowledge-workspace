# P1-T18 Verification — Atomic IndexBuild publication

Status: **OPEN / PARTIAL**

Branch: `feat/p1-atomic-index-build-publication`  
Direct base: `feat/p1-worker-loop-crash-recovery`

## Automated/static gates

```bash
npm ci
npm test -- \
  src/knowledge/storage/indexBuildPublication.test.ts \
  src/knowledge/storage/searchQuery.test.ts \
  src/knowledge/storage/database.test.ts \
  src/knowledge/storage/fts5Index.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-worker-loop-crash-recovery...HEAD
git diff --name-status origin/feat/p1-worker-loop-crash-recovery...HEAD
```

Expected PASS evidence: all focused/static/build/package gates pass; full suite adds no P1-T18-attributable failure; direct-base diff is task-only.

## Real schema-v5 → v6 migration

### Positive case

1. Create/open a real schema-v5 DB with no `index_builds` rows.
2. Upgrade with current `openKnowledgeDatabase`.
3. Confirm `PRAGMA user_version = 6`.
4. Inspect `knowledge_workspaces` and `index_builds` columns/indexes.
5. Confirm existing Workspace rows receive `index_generation = 0` and `active_index_build_id = NULL`.

### Fail-closed legacy case

1. Create a schema-v5 DB containing at least one provisional `index_builds` row.
2. Attempt migration to v6.
3. Confirm migration 6 fails and rolls back to schema version 5.
4. Confirm the existing IndexBuild row remains intact and no active pointer/generation is guessed.

Expected: no silent deletion or inferred publication history.

## First publication

With a Workspace at generation 0 / no active build:

1. `createStaging()` B and verify B snapshots `(base_generation=0, base_active_build_id=NULL)`.
2. Populate and validate B.
3. Publish B.
4. Confirm Workspace becomes generation 1 / active B.
5. Confirm B is `active`, has `validated_at`, `completed_at`, `published_at`.
6. Run `SearchQueryApi` and confirm it resolves B via Workspace pointer rather than recency.

## Replacement publication

1. With B active at generation 1, create staging C.
2. Confirm C snapshots `(1,B)`.
3. Validate and publish C.
4. Confirm Workspace becomes generation 2 / active C.
5. Confirm C is active and B becomes `retained`.
6. Confirm B's chunks/artifacts remain present; P1-T18 must not delete the old build.
7. Confirm search immediately resolves C only.

## Out-of-order concurrent rebuild acceptance

This is mandatory.

1. Start candidates C and D while Workspace is generation G / active B; both must snapshot G/B.
2. Complete/validate D first and publish D successfully.
3. Complete/validate C later.
4. Attempt to publish C.
5. Confirm C fails with publication conflict because Workspace is now G+1/D.
6. Confirm active pointer remains D and generation does not increment again.
7. Confirm search never switches to stale C.

Repeat with two processes/connections if practical to exercise a real SQLite race rather than only sequential simulation.

## CAS race acceptance

Arrange two validated candidates to attempt publication nearly simultaneously from the same G/A snapshot.

Expected: exactly one Workspace CAS changes one row. The loser rolls back and cannot mark itself active. At all observable points, search either sees old A or the single winning build; it never sees an unpublished/losing candidate.

## Failure preservation

Inject/fail validation or publication before commit. Confirm:

- old active pointer remains unchanged;
- old build remains queryable;
- generation remains unchanged;
- failed candidate never becomes search-active.

## PASS criteria

P1-T18 can become PASS only after repository gates pass, real schema migration positive/negative cases pass, real out-of-order/CAS publication proves one winner and stale-build rejection, search uses only the publication pointer, old active data remains retained, and evidence is written back to report/plan/changelog/debt/PR.
