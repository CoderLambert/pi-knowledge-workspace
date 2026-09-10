# P1-T07 — MD/TXT import job verification

Status: **OPEN / PARTIAL**

## Automated verification

```bash
npm test -- src/knowledge/storage/database.test.ts src/knowledge/storage/importJobs.test.ts
npm test -- src/knowledge/storage/workspaceFileReader.test.ts src/knowledge/storage/blobStore.test.ts src/knowledge/storage/sourceDomain.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-safe-workspace-file-reader...HEAD
git diff --name-status origin/feat/p1-safe-workspace-file-reader...HEAD
```

Expected P1-T07 focused result: database migration suite plus 6/6 import-job tests pass. Dependency focused suites must introduce no regressions. Do not patch inherited unrelated failures merely to obtain green.

## Real SQLite / restart acceptance

1. Open a schema-v1 fixture with the current build; confirm migration to schema v2 succeeds and preserves existing rows.
2. Submit one `.md` import with an idempotency key; resubmit the same request and confirm one job and one Source exist.
3. Execute it and confirm P1-T06 captures the Workspace file, one immutable SourceVersion is produced, and job `result_json` records the same hash/length/version id.
4. Change the file and submit with a new idempotency key; confirm a new Source/job and new version identity follow the explicit new import.
5. Inject a capture/persistence failure; confirm job/attempt are `failed`, then explicitly retry and confirm the next attempt succeeds without duplicate SourceVersion for identical bytes.
6. Cancel a queued job; confirm no file capture/blob/SourceVersion occurs.
7. Request cancellation while running before SourceVersion persistence; confirm the attempt/job become cancelled and no SourceVersion is persisted.
8. Kill the process while an import is marked `running`; restart, call interrupted-import recovery, confirm the unfinished attempt is failed and the job is `queued`, then replay it successfully.
9. Simulate/reproduce a crash after SourceVersion persistence but before job success commit; replay and confirm `(source_id, content_sha256)` converges on the existing version.
10. Confirm `.png`, `.pdf`, or other non-MD/TXT submissions are rejected and the job never trusts a caller-provided absolute Workspace root.

## Expected PASS evidence

- focused tests PASS, including 6/6 import-job cases;
- schema-v1 → v2 migration and rollback behavior PASS on real SQLite;
- typecheck/lint/knip/build/pack PASS;
- full suite has no new P1-T07-attributable failure;
- direct-base diff is task-only;
- restart/retry/cancel/idempotency scenarios behave as documented;
- resulting SourceVersion identity exactly matches P1-T06 captured bytes.

Until this evidence is recorded, P1-T07 remains PARTIAL. P1-T08 may consume only immutable SourceVersion content under the autonomous execution policy.
