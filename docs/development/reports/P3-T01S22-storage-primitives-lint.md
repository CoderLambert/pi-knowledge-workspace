# P3-T01S22 — Storage Primitives Lint

Status: **PASS**

## Purpose

Continue P3-T01 inherited baseline closure from the verified 65-error endpoint with a cohesive group of low-level storage boundary primitives.

## Scope

Production files:

- `src/knowledge/storage/utf8Range.ts`
- `src/knowledge/storage/blobStore.ts`
- `src/knowledge/storage/workspaceFileReader.ts`
- `src/knowledge/storage/workspaceIdentity.ts`

Support documentation:

- this report;
- `docs/development/verification/P3-T01S22-storage-primitives-lint.md`.

The parent CI reported 12 inherited findings in these four files:

```text
utf8Range.ts           6
blobStore.ts           2
workspaceFileReader.ts 2
workspaceIdentity.ts   2
```

Verified repository lint endpoint:

```text
65 → 53
```

## Changes

### UTF-8 range

- explicitly stringify numeric values used in diagnostic template literals;
- replace the internal byte non-null assertion with explicit bounds failure.

### Blob store

- explicitly stringify `process.pid` in temporary-file naming;
- replace the Node error-code type assertion with structural narrowing.

### Workspace file reader

- explicitly stringify file-size/max-size diagnostics without changing size validation.

### Workspace identity

- replace SQLite row type assertions with explicit structural row guards;
- malformed installation/workspace rows now fail closed with an explicit error rather than being trusted through a compile-time assertion;
- use bracket access inside `Record<string, unknown>` guards so `noPropertyAccessFromIndexSignature` remains satisfied without weakening the runtime guard.

## Contract preservation

The task does not change:

- UTF-8 half-open byte-range semantics, exact-quote hashing or boundary validation;
- content-addressed SHA-256 identity, atomic hard-link publication, dedupe or tamper detection;
- Workspace path containment, sensitive-file blocking, file-size limits or capture-race detection;
- installation/workspace identity keys, canonical realpath authority, external-binding update semantics or transaction boundaries.

No schema, migration, ADR, retrieval profile, P2 evaluation data/evidence, benchmark thresholds or product features are modified.

## Verification state

Initial GitHub CI run `34455969455` failed before lint in `npm run typecheck` with four S22-owned `TS4111` findings in the new `workspaceIdentity.ts` structural guards. The guards narrowed through `Record<string, unknown>`, so the repository's `noPropertyAccessFromIndexSignature` setting requires bracket access. This was a task-owned implementation defect, not inherited baseline debt.

Commit `d9944050229bd3368aaf108e555db531e4c75f54` fixed only those accesses. The initial run's P2 FTS Evidence `34455969441` and P2 Lexical Evidence `34455969464` both passed.

Follow-up GitHub CI run `34461165544` on code head `731272e487d00f8408f48c0e96f05a12f4d7acc8` established:

```text
npm run typecheck → PASS
ESLint 65 → 53
```

None of the four S22 production files appears in the authoritative lint output. The remaining 53 findings are inherited in other Knowledge/plugin/evaluation files; the global verify workflow remains red only because lint stops later stages.

P2 FTS Evidence run `34461166067` and P2 Lexical Evidence run `34461165563` both passed on the same code head. No frozen evidence/configuration was modified.

## Git discipline

Base: `chore/p3-t01-service-dispatch-lint` (#95)

Head: `chore/p3-t01-storage-primitives-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, benchmark retuning, P2 evidence mutation or unrelated cleanup.
