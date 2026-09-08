# P1-T06 — Safe Workspace file reader

Status: **PARTIAL**  
Branch: `feat/p1-safe-workspace-file-reader`  
Base: `feat/p1-source-version-domain`

## Scope

Implemented the security boundary that turns one explicitly selected Workspace-relative file into captured raw bytes plus a SHA-256 fingerprint.

This task does **not** write the blob store, create Source/SourceVersion rows, enqueue jobs, parse content, or expose browser/UI APIs. Those belong to later tasks.

## Security contract

`captureWorkspaceFile(workspaceRoot, requestedRelativePath, options)` enforces:

- non-empty relative paths only;
- no absolute path authority from callers;
- lexical parent-traversal rejection;
- canonical Workspace root resolution;
- canonical target containment after `realpath`;
- symlink escape rejection while allowing symlinks whose canonical target remains inside the Workspace;
- regular-file requirement;
- configurable positive maximum byte size, default 16 MiB;
- sensitive-path guard for `.env`, `.env.*`, `.ssh/**`, common `id_*` private-key names and `*.pem` / `*.key`;
- exact-byte SHA-256 capture;
- file-change/replacement detection during capture.

## Race handling

The reader does not rely on a single path `stat` followed by `readFile`.

It:

1. canonicalizes and stats the selected path;
2. opens that canonical file;
3. compares path identity with the opened descriptor;
4. reads the exact descriptor size;
5. re-stats the descriptor and compares identity, size, mtime and ctime;
6. resolves/stats the selected path again;
7. compares the final path identity/snapshot to the descriptor.

A truncation, rewrite, removal, symlink retarget, or path replacement observed during this window fails with `FILE_CHANGED_DURING_CAPTURE` instead of producing a SourceVersion candidate from ambiguous bytes.

A narrow test-only hook exists immediately before the final path recheck to make replacement-race coverage deterministic; production callers omit it.

## Tests

`workspaceFileReader.test.ts` contains eight focused scenarios:

1. contained file exact-byte/hash capture;
2. parent traversal and absolute path rejection;
3. escaping symlink rejection;
4. contained symlink acceptance/canonical target capture;
5. dotenv/SSH/private-key guard;
6. oversize rejection;
7. deterministic path replacement during capture;
8. non-regular path and invalid max-size configuration.

## Verification status

The GitHub-only automation environment cannot execute the repository dependency tree or target filesystem acceptance, and no CI evidence is assumed. Focused/static/build/package/full-suite execution remains OPEN verification debt; P1-T06 is PARTIAL.

## Dependency assumptions

P1-T07 may consume only a successful `CapturedWorkspaceFile` result and must not reopen the path or trust browser-supplied bytes. It should pass the already-captured bytes into the P1-T04/P1-T05 blob/SourceVersion path. This preserves the P1-T06 race boundary rather than introducing a second unsafe read.
