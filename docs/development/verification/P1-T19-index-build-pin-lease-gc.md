# P1-T19 Verification — IndexBuild pin / lease / GC

Status: **OPEN / PARTIAL**

Branch: `feat/p1-index-build-pin-lease-gc`  
Direct base: `feat/p1-atomic-index-build-publication`

## Automated/static gates

```bash
npm ci
npm test -- \
  src/knowledge/storage/indexBuildRetention.test.ts \
  src/knowledge/storage/searchQuery.test.ts \
  src/knowledge/storage/indexBuildPublication.test.ts \
  src/knowledge/storage/database.test.ts \
  src/knowledge/storage/fts5Index.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-atomic-index-build-publication...HEAD
git diff --name-status origin/feat/p1-atomic-index-build-publication...HEAD
```

Expected: all task/dependency focused tests and repository gates pass with no new attributable failure; direct-base diff is P1-T19-only.

## Real schema-v6 → v7 migration

1. Open a file-backed schema-v6 Knowledge DB.
2. Upgrade to schema v7.
3. Confirm `index_build_pins` exists with FK `ON DELETE CASCADE`, unique `(index_build_id,owner_type,owner_id)`, nullable lease expiry and both indexes.
4. Reopen and confirm schema remains 7.
5. Inject/fail migration 7 in a fixture and confirm rollback leaves schema version 6 and no partial pin table/index state.

## Query lease / publication / GC race

Use two SQLite connections or processes if practical.

1. Publish Build A active.
2. Start a query that acquires A's query lease and pause after lease insertion but before FTS completes.
3. Publish Build B; A becomes retained.
4. Run GC concurrently.
5. Confirm A is **not** deleted while its live query lease exists.
6. Let the query finish and release its pin.
7. Run GC again and confirm A can now be collected.
8. Confirm the completed query returned A-consistent results and new queries use B.

This is the primary P1-T19 race acceptance.

## Crash / lease expiry

1. Acquire a finite query/answer-style lease on a retained build.
2. Simulate process crash by not releasing it.
3. Before expiry, confirm GC skips the build.
4. Advance/wait beyond `lease_expires_at`.
5. Run expired-pin cleanup and GC.
6. Confirm the expired pin no longer blocks collection.

Expected: transient process failure cannot retain builds forever.

## Durable pin acceptance

1. Add a durable pin (`lease_expires_at=NULL`) to a retained build using a representative future owner type such as `saved-note`.
2. Run expired-pin cleanup; confirm the durable pin is not removed.
3. Run GC; confirm the build is retained.
4. Explicitly release/delete the durable pin.
5. Run GC again; confirm the build becomes collectible if no other pin exists.

## Evidence/history preservation

Prepare Source V1 with Evidence E1, rebuild to a newer IndexBuild, then GC the old retained IndexBuild.

Confirm after GC:

- old `chunks` / `chunk_fts` rows for the collected build are gone;
- Source and SourceVersion V1 remain;
- ParsedArtifact for V1 remains;
- Evidence E1 remains and exact/context read still resolves authoritative historical artifact bytes;
- Source archived state does not change this behavior.

No `DELETE` from Source/SourceVersion/ParsedArtifact/Evidence belongs to P1-T19 GC.

## Workspace isolation

Create retained builds in Workspaces A and B. Run `gcRetained(A)` and confirm B's pins/builds/index rows are untouched.

## PASS criteria

P1-T19 can move to PASS only after focused/static/build/package/full-suite gates pass; real schema migration passes; query-vs-publication-vs-GC race proves live pin safety; crash expiry and durable pin behavior pass; old index GC preserves Evidence history; Workspace isolation is demonstrated; and evidence is written back to report/plan/changelog/debt/PR.
