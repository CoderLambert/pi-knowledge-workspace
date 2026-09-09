# P1-T18 — Atomic IndexBuild publication

Status: **PARTIAL**

Branch: `feat/p1-atomic-index-build-publication`  
Direct base: `feat/p1-worker-loop-crash-recovery`

## Scope implemented

P1-T18 makes the active retrieval index an explicit Workspace-owned publication pointer rather than “whatever completed most recently”.

The durable model is:

```text
Workspace generation G, active A
→ create staging build B(snapshot G/A)
→ build/index B outside publication
→ validate B
→ transactional compare-and-swap Workspace G/A → G+1/B
→ mark B active
→ retain A for later P1-T19 GC
```

A failed or stale publication leaves the current active build unchanged.

## Schema v6

Migration v6 adds:

- `knowledge_workspaces.active_index_build_id`;
- `knowledge_workspaces.index_generation`;
- `index_builds.base_generation`;
- `index_builds.base_active_build_id`;
- `index_builds.validated_at`;
- `index_builds.published_at`;
- Workspace/status lookup index.

The earlier provisional `index_builds` rows do not contain enough information to infer a correct historical active pointer/generation. Migration therefore fails closed when schema-v5 already contains IndexBuild rows rather than silently guessing publication history. A controlled rebuild/migration procedure is required for such data.

## Publisher

Added `IndexBuildPublisher`.

### createStaging

Reads the Workspace's exact active pointer/generation inside a transaction and stores that snapshot on the new staging build. The snapshot is the publication precondition, not merely debugging metadata.

### markValidated

Only a `staging` build may become `validated`. Publication never promotes unvalidated staging data.

### publish

Publication runs inside one `BEGIN IMMEDIATE` transaction and:

1. loads the validated candidate;
2. verifies the Workspace still has the candidate's recorded `base_generation` and `base_active_build_id`;
3. performs a second SQL compare-and-swap over both generation and previous active pointer;
4. marks the candidate `active` with completion/publication timestamps;
5. marks the previous active build `retained` instead of deleting it.

Both a stale precheck and a race between precheck/CAS fail closed and roll back.

## Search resolver correction

P1-T13 previously used `LatestCompletedIndexBuildResolver` as an explicit temporary placeholder pending P1-T18. This task replaces it with `ActiveIndexBuildResolver`.

Search now resolves only:

```text
knowledge_workspaces.active_index_build_id
→ same-Workspace index_builds row
→ status = active
→ published_at IS NOT NULL
```

It never selects an IndexBuild merely because it completed or was created most recently.

## Out-of-order rebuild protection

Two rebuilds may start from generation G/A. If B publishes first, Workspace becomes G+1/B. When slower C later completes, C still records base G/A and publication is rejected. C cannot overwrite B just because it finished later.

## Locked invariants

1. Exactly one Workspace pointer defines the active IndexBuild.
2. `completed_at` or creation recency never grants active authority.
3. Publication requires explicit validation.
4. Candidate publication is conditional on both generation and prior active pointer.
5. Generation monotonically increases on successful publication.
6. A failed publication leaves the old active build usable.
7. The prior active build is retained, not immediately deleted.
8. Search consumes only the published pointer.
9. Out-of-order rebuild completion cannot regress active state.
10. P1-T19, not this task, owns pin/lease/GC retention policy.

## Tests

`indexBuildPublication.test.ts` covers:

- staging snapshot of generation/active build;
- validation requirement;
- CAS publication and retention of previous active build;
- stale out-of-order build rejection;
- CAS race rejection;
- active pointer lookup independent of creation recency.

`searchQuery.test.ts` now asserts the active publication pointer/status/timestamp contract.

`database.test.ts` covers schema-v6 shape and migration rollback contract.

## Verification debt

This task remains PARTIAL until executable/static/build/package/full-suite gates and real file-backed SQLite acceptance are recorded. Real acceptance must include two independently prepared candidate builds completing in reverse order and prove the stale build cannot overwrite the already-published build.

The schema-v5→v6 positive case with no prior IndexBuild rows and fail-closed negative case with provisional rows also require real SQLite execution.

## Scope check

Direct-base comparison must contain only P1-T18 schema/publication/search-resolver/tests/task records/bookkeeping. No P1-T19 pin/lease/GC implementation, backup/restore, vector/model/UI work or unrelated repair belongs in this PR.
