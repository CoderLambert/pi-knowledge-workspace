# P3-T01S11 — Backup Test Lint Verification

Status: **PARTIAL — CI evidence pending**

## Automated verification

Run on the task branch:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/backup.test.ts
```

Expected static result:

```text
typecheck: PASS
ESLint inherited baseline: 210 → 205
```

Confirm the five prior findings in `src/knowledge/storage/backup.test.ts` are gone:

1. empty snapshot-database `exec` method;
2. `readArtifactBundle` fixture with `async` but no `await`;
3. first manifest-entry non-null assertion;
4. second manifest-entry non-null assertion;
5. hard-to-count two-space regex literal.

## Behavioral assertions

The focused test must continue to prove:

- backup publication is based on a consistent SQLite snapshot;
- referenced SourceVersion blobs and ParsedArtifact bundles are copied and hashed;
- incomplete ParsedArtifact backup fails closed;
- SourceVersion blob identity/length mismatches fail closed;
- an existing backup destination is never overwritten.

## User verification

None. This is repository test-harness/static debt and should be verified by CI; do not add user verification debt.
