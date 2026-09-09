# P1-T21 — Restore CLI

Status: **PARTIAL**

Branch: `feat/p1-restore-cli`  
Direct base: `feat/p1-backup-cli`

## Scope implemented

P1-T21 adds:

```text
pi-knowledge restore --backup <backup-dir> --target <new-target-dir>
```

Restore only creates a new controlled target. It refuses an existing target and refuses backup/target nesting in either direction.

## Verification-before-write

Before the restore target is created, the implementation verifies:

1. `manifest.sha256` matches the exact `manifest.json` bytes;
2. backup format version is supported;
3. backup schema version matches the current Knowledge schema;
4. database path is the canonical `knowledge.sqlite` relative path;
5. SQLite snapshot file size/SHA-256 matches manifest;
6. SQLite `PRAGMA integrity_check = ok`;
7. SQLite `user_version` matches manifest;
8. SourceVersion blob closure in SQLite exactly matches manifest blob entries;
9. ParsedArtifact closure in SQLite exactly matches manifest artifact entries;
10. every blob/artifact path is safe/canonical and every object size/hash matches manifest.

Duplicate/missing/mismatched closure entries fail closed.

## Atomic controlled restore

After all backup-side validation succeeds, restore builds a private sibling temporary target:

```text
<target-tmp>/
├── knowledge.sqlite
├── blobs/sha256/*
├── artifact materialization (provider-owned)
└── restore-source-manifest.json
```

Raw blobs are republished through P1-T04 `ContentAddressedBlobStore.put()` so restored identity is rechecked. Only after artifact materialization and required Evidence verification succeed is the temporary directory renamed to the requested target.

Any error removes temporary state and leaves the final target absent.

## ParsedArtifact / Evidence acceptance boundary

The repository still lacks the production durable ParsedArtifact store required by P1-T14/T15/T20. P1-T21 therefore defines two narrow mandatory seams:

- `RestoreArtifactSink.writeArtifactBundle(...)` for immutable ParsedArtifact materialization;
- `RestoreEvidenceVerifier.verifyRestoredEvidence(...)` for historical Evidence resolution against the restored DB/data root.

If a backup contains ParsedArtifacts without an artifact sink, restore fails. If the snapshot contains Evidence without an Evidence verifier, restore fails. This intentionally enforces the plan's rule:

> Restore success means historical Evidence still resolves, not merely “SQLite opens”.

The current production CLI has neither provider wired, so it can restore only backups whose snapshot has zero ParsedArtifacts and zero Evidence. This is explicit verification debt, not silent degradation.

## Tests

Coverage includes:

- valid DB/raw-blob restore into a new target;
- manifest checksum tamper rejection before target creation;
- missing artifact sink rejection;
- missing historical Evidence verifier rejection;
- complete fixture restore only after artifact sink + Evidence verifier succeed;
- restore CLI required/duplicate/unknown argument handling.

## Verification debt

P1-T21 remains PARTIAL until repository gates run and target-machine acceptance proves:

- packaged CLI restores a real P1-T20 backup;
- SQLite integrity/schema/closure/hash negative cases fail before target publication;
- production durable artifact sink is wired;
- production Evidence verifier proves exact historical citations after restore;
- restored target can be opened/restarted independently without dependence on the backup directory.

## Scope check

Direct-base diff must contain only restore verifier/materializer, restore CLI routing/tests/task records/bookkeeping. P1-T22 owns the full import→GC→restart→backup→restore Evidence durability scenario.
