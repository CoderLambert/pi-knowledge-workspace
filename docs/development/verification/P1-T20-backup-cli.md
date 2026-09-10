# P1-T20 Verification — Backup CLI

Status: **OPEN / PARTIAL**

Branch: `feat/p1-backup-cli`  
Direct base: `feat/p1-index-build-pin-lease-gc`

## Repository gates

```bash
npm ci
npm test -- \
  src/knowledge/storage/backup.test.ts \
  src/knowledge/service/backupCli.test.ts \
  src/knowledge/storage/blobStore.test.ts \
  src/knowledge/storage/database.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-index-build-pin-lease-gc...HEAD
git diff --name-status origin/feat/p1-index-build-pin-lease-gc...HEAD
```

Expected: no new P1-T20-attributable failure; packaged `dist/knowledge/service/main.js` retains backup subcommand code; direct-base diff is task-only.

## Real SQLite online snapshot

Use a current schema-v7 file-backed DB with WAL activity.

1. Keep the normal Knowledge process writing representative rows before the backup window.
2. Run the backup CLI from another process against the same DB.
3. Confirm the command never changes source `user_version`, schema or journal mode.
4. Open backup `knowledge.sqlite` independently and run `PRAGMA integrity_check`.
5. Confirm all SourceVersion/ParsedArtifact rows present in the snapshot have corresponding manifest closure entries.
6. Re-run while the source DB is idle and while WAL has uncheckpointed changes.

Expected: each produced SQLite file is a self-consistent online snapshot and the source DB is not mutated by backup.

## Empty-artifact CLI acceptance

Until the durable ParsedArtifact provider is wired, create a current DB containing SourceVersion blobs but zero ParsedArtifact rows, then run:

```bash
pi-knowledge backup \
  --db /path/to/knowledge.sqlite \
  --data-dir /path/to/knowledge-data \
  --output /tmp/knowledge-backup
```

Expected:

- destination did not exist beforehand;
- command exits successfully;
- `knowledge.sqlite`, `manifest.json`, `manifest.sha256`, referenced raw blobs exist;
- source DB/data are unchanged;
- second run against the same destination refuses overwrite.

## ParsedArtifact fail-closed acceptance

Create at least one ParsedArtifact row while the production durable artifact provider is still absent. Run the same CLI.

Expected:

- explicit error states that a durable ParsedArtifact provider is required;
- final backup destination is absent;
- sibling temporary directory is cleaned;
- no partial backup is presented as valid.

This debt must later be rerun after the real provider is connected, at which point a non-empty artifact backup must succeed.

## Independent hash verification

For a successful backup:

1. compute SHA-256 of `manifest.json`; compare with `manifest.sha256`;
2. compute SHA-256 and byte length for `knowledge.sqlite`; compare with manifest;
3. compute each blob object's hash/size and confirm blob content hash equals its manifest content SHA-256;
4. compute every artifact bundle hash/size and compare with manifest;
5. confirm canonical-text SHA-256 metadata matches the snapshot's ParsedArtifact row.

Any modified object must be detectable before P1-T21 restore writes target state.

## Tamper / missing-object negative cases

Before publication (using fixtures/provider injection), verify missing or corrupted raw blob, wrong SourceVersion byte length, wrong blob identity, empty artifact bundle and existing output destination all fail closed and leave no published backup directory.

## Packaged binary

After `npm run build` / package install, invoke the installed `pi-knowledge backup` binary. Confirm it routes to backup without requiring service token/network startup and the normal `pi-knowledge` no-subcommand service behavior remains unchanged.

## PASS criteria

P1-T20 becomes PASS only after repository gates pass, real WAL-aware online backup succeeds without mutating source state, packaged command works, a production durable ParsedArtifact provider completes a non-empty artifact backup, all manifest/object hashes independently verify, and evidence is written back to report/plan/changelog/debt/PR.
