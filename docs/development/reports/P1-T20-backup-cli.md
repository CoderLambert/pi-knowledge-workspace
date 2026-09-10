# P1-T20 — Backup CLI

Status: **PARTIAL**

Branch: `feat/p1-backup-cli`  
Direct base: `feat/p1-index-build-pin-lease-gc`

## Scope implemented

P1-T20 adds a directory-format Knowledge backup pipeline and routes:

```text
pi-knowledge backup --db <knowledge.sqlite> --data-dir <knowledge-data-root> --output <backup-dir>
```

Backup is observational: the source DB is opened read-only and must already use the current schema. The command does not migrate, change WAL mode or otherwise mutate the live DB.

## Consistency model

The creator first uses the selected SQLite driver's online `backup()` API to create `knowledge.sqlite` in a same-parent temporary backup directory. It then opens **that snapshot** read-only and computes the object closure from snapshot rows, not from the mutable live connection.

This means DB rows and the list of referenced SourceVersion blobs / ParsedArtifacts correspond to one consistent SQLite snapshot.

## Backup layout

```text
<backup>/
├── knowledge.sqlite
├── manifest.json
├── manifest.sha256
└── objects/
    ├── blobs/sha256/<content-sha256>
    └── artifacts/<sha256(parsed-artifact-id)>.bin
```

The destination is never overwritten. Work is built under a private sibling temporary directory and renamed into place only after all validation/hashing/manifest writes succeed.

## Manifest

Format version 1 records:

- backup timestamp;
- Knowledge schema version;
- SQLite snapshot relative path, byte length and SHA-256;
- every referenced SourceVersion blob path/size/file SHA-256/content SHA-256;
- every ParsedArtifact bundle path/size/file SHA-256 plus artifact id, SourceVersion id, parser version and canonical-text SHA-256.

`manifest.sha256` hashes the exact bytes of `manifest.json`.

## Blob closure / integrity

For every distinct SourceVersion row in the snapshot:

1. `blob_key` must equal `content_sha256`;
2. the raw blob is read through P1-T04 verified `ContentAddressedBlobStore.read()`;
3. byte length must equal the SourceVersion row;
4. the exact verified bytes are copied to the backup object tree and hashed into the manifest.

Tamper, missing data, identity mismatch or byte-length mismatch aborts the backup before publication.

## ParsedArtifact dependency

P1-T08 canonicalizes ParsedArtifacts but the repository still lacks a production durable ParsedArtifact materialization/read store (also recorded by P1-T14/T15).

P1-T20 therefore introduces the narrow required `BackupArtifactProvider.readArtifactBundle(parsedArtifactId)` seam. A complete backup containing ParsedArtifact rows requires this provider. The current production CLI intentionally does **not** invent a mutable-Workspace reread or a guessed artifact file layout; if ParsedArtifacts exist, it fails closed with an explicit incomplete-backup error.

This is a real acceptance dependency, so P1-T20 remains PARTIAL. A DB with zero ParsedArtifact rows can already be backed up through the CLI, including consistent SQLite snapshot and referenced raw blobs.

## CLI behavior

Backup has explicit required paths and rejects unknown, duplicate or missing arguments. It does not require `PI_KNOWLEDGE_TOKEN` because no service is started and no network listener is involved.

`src/knowledge/service/main.ts` routes the `backup` subcommand before normal service configuration/startup.

## Tests

Added coverage for:

- consistent snapshot + blob/artifact manifest publication;
- artifact-provider fail-closed behavior;
- SourceVersion blob identity/length mismatch;
- no destination overwrite;
- backup CLI required/duplicate/unknown arguments.

## Verification debt

P1-T20 remains PARTIAL until:

- focused/typecheck/lint/knip/build/pack/full suite execute;
- real `better-sqlite3` readonly connection exposes and successfully runs online backup;
- WAL-active live DB snapshot is consistent;
- package-installed `pi-knowledge backup` works on target Linux;
- production durable ParsedArtifact provider exists and a non-empty artifact backup completes;
- manifest/object hashes are independently verified.

## Scope check

Direct-base diff must contain only backup format/creator, readonly snapshot opening, backup CLI routing/tests/task records/bookkeeping. Restore behavior belongs exclusively to P1-T21.
