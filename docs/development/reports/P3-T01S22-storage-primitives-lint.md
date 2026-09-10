# P3-T01S22 — Storage Primitives Lint

Status: **PARTIAL**

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

The parent CI reports 12 inherited findings in these four files:

```text
utf8Range.ts           6
blobStore.ts           2
workspaceFileReader.ts 2
workspaceIdentity.ts   2
```

Expected repository lint endpoint if all task-owned findings close cleanly:

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

Initial GitHub CI run `34455969455` failed before lint in `npm run typecheck` with four S22-owned `TS4111` findings in the new `workspaceIdentity.ts` structural guards. The guards narrowed through `Record<string, unknown>`, so the repository's `noPropertyAccessFromIndexSignature` setting requires `value["id"]` / `value["external_binding"]` access. This is a task-owned implementation defect, not inherited baseline debt.

Commit `d9944050229bd3368aaf108e555db531e4c75f54` fixes only those four accesses. The initial run's P2 FTS Evidence `34455969441` and P2 Lexical Evidence `34455969464` both passed.

Status remains **PARTIAL** until follow-up GitHub CI establishes:

```text
npm run typecheck → PASS
ESLint 65 → 53
```

All four task-owned production files must disappear from authoritative lint output. Relevant focused tests should pass when reachable; unrelated failures remain inherited baseline.

Because the task touches storage primitives used by P2 Evidence paths, path-triggered P2 FTS/Lexical workflows must remain green if triggered.

## Git discipline

Base: `chore/p3-t01-service-dispatch-lint` (#95)

Head: `chore/p3-t01-storage-primitives-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, benchmark retuning, P2 evidence mutation or unrelated cleanup.
