# P1-T21 Verification — Restore CLI

Status: **OPEN / PARTIAL**

Branch: `feat/p1-restore-cli`  
Direct base: `feat/p1-backup-cli`

## Repository gates

```bash
npm ci
npm test -- \
  src/knowledge/storage/restore.test.ts \
  src/knowledge/service/restoreCli.test.ts \
  src/knowledge/storage/backup.test.ts \
  src/knowledge/storage/blobStore.test.ts \
  src/knowledge/storage/database.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-backup-cli...HEAD
git diff --name-status origin/feat/p1-backup-cli...HEAD
```

Expected: no new P1-T21-attributable failure; packaged `pi-knowledge` routes both backup and restore; direct-base diff is restore-only.

## Integrity negative matrix

For separate copies of a real P1-T20 backup, tamper one item at a time before restore:

- `manifest.json` without updating `manifest.sha256`;
- SQLite bytes;
- SQLite `user_version` / unsupported schema fixture;
- a raw blob;
- artifact bundle;
- manifest blob size/hash/path;
- manifest artifact id/source/parser/canonical hash/path;
- remove a manifest closure entry while leaving DB row;
- add a manifest closure entry absent from DB;
- unsafe `../` or absolute object path.

Expected for every case: restore fails before final target publication; no existing path is overwritten; no partial target is presented as valid.

## Controlled-target acceptance

1. Run restore into a non-existent directory.
2. Confirm target contains restored DB/data and `restore-source-manifest.json` only after success.
3. Attempt a second restore to the same target; confirm refusal.
4. Attempt target inside backup and backup inside target; confirm refusal.
5. Confirm failure cleanup removes sibling `.pi-knowledge-restore-tmp-*` output.

## Raw blob acceptance

For every SourceVersion in the restored DB:

1. confirm `blob_key == content_sha256`;
2. confirm target `blobs/sha256/<hash>` exists;
3. read it through `ContentAddressedBlobStore.read(hash)`;
4. confirm exact byte length and SHA-256 match the restored SourceVersion.

## ParsedArtifact + historical Evidence acceptance

This is mandatory before P1-T21 can PASS.

After production `RestoreArtifactSink` and `RestoreEvidenceVerifier` exist:

1. restore a backup containing multiple SourceVersions/ParsedArtifacts and historical Evidence;
2. confirm every manifest artifact bundle is materialized under the provider's controlled immutable store;
3. run the Evidence verifier **before** final target rename;
4. verify every historical Evidence exact quote/hash against the restored authoritative ParsedArtifact;
5. after final publication, open exact/context/section reads for old and latest versions;
6. confirm an Evidence attached to V1 does not redirect to V2.

A restore that only opens SQLite is a failure if Evidence cannot resolve.

## Independence from backup source

After a successful full restore:

1. rename/remove the original backup directory;
2. restart/open the restored Knowledge target independently;
3. read blobs, ParsedArtifacts and historical Evidence again.

Expected: restored state has no runtime dependency on the backup directory.

## Packaged CLI

Run the packaged command:

```bash
pi-knowledge restore --backup /path/to/backup --target /path/to/new-target
```

Confirm it does not require service token/network startup, reports counts/target only after success, and normal service/backup command behavior remains unchanged.

## PASS criteria

P1-T21 becomes PASS only after repository gates, integrity negative matrix, controlled-target behavior, real packaged CLI, production artifact materialization, historical Evidence verification and post-backup-removal restart all pass with evidence recorded in report/plan/changelog/debt/PR.
