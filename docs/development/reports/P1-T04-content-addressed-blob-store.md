# P1-T04 — Content-addressed blob store

Status: **PARTIAL**  
Branch: `feat/p1-content-addressed-blob-store`  
Base: `feat/p1-knowledge-workspace-identity`

## Scope

Implemented immutable raw-byte storage under `blobs/sha256/<hash>` without introducing Source, parsing, indexing, retrieval, job, or UI behavior.

## Implementation

`src/knowledge/storage/blobStore.ts` adds `ContentAddressedBlobStore` with:

- SHA-256 addressing over exact raw bytes;
- lowercase 64-character hash validation before filesystem resolution;
- atomic no-overwrite publication using a same-directory temporary file plus hard-link creation;
- `fsync` of temporary file contents before publication;
- idempotent deduplication of repeated/concurrent identical writes;
- fail-closed verification when an existing object no longer matches its hash;
- verified reads and explicit verification results;
- cleanup of stale store-owned partial temp files only.

The store does not trust caller-provided hashes for writes. Hashes are computed from bytes by the store itself.

## Concurrency / immutability model

Publication uses `link(temp, destination)` rather than overwrite-capable rename. The first writer publishes the object atomically; concurrent writers receive `EEXIST`, verify the already-published object, and report deduplication. No writer overwrites an existing content address.

This design assumes the blob root and temporary files are on the same filesystem, which is guaranteed because temporary files are created directly inside `blobs/sha256`.

## Tests added

`src/knowledge/storage/blobStore.test.ts` covers:

1. exact path/hash/read/verify behavior including UTF-8 Chinese and emoji bytes;
2. repeated and concurrent write deduplication;
3. fail-closed tamper detection;
4. invalid hash/path-traversal rejection;
5. stale partial-temp cleanup while preserving recent and unrelated files;
6. cleanup configuration validation.

## Verification status

The GitHub-only automation environment cannot execute the repository dependency tree, so focused tests and repository static/build/package gates remain OPEN verification debt. P1-T04 is therefore PARTIAL rather than PASS.

No P1-T05 Source/SourceVersion implementation is included in this branch.

## Dependency assumptions

P1-T05 may consume this store through the narrow contract `put(rawBytes) -> { hash, size, path }` and `read(hash)`, while treating P1-T04 runtime verification as an explicit dependency risk. A later SourceVersion must persist the blob hash, not a mutable filesystem path, as its content identity.
