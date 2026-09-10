# P3-T01S12 — Restore Test Lint Verification

Status: **PARTIAL — follow-up CI evidence pending**

## Automated verification

Run on the task branch:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/restore.test.ts
```

Initial GitHub CI run `34436851039` produced:

```text
typecheck: PASS
ESLint inherited baseline: 205 → 202
```

The first repair removed three task-owned findings but left one `strict-boolean-expressions` finding in the optional `blobHash` result guard. That guard is now explicit and requires follow-up CI confirmation.

Expected corrected result:

```text
typecheck: PASS
ESLint inherited baseline: 202 → 201
```

Confirm the four original findings in `src/knowledge/storage/restore.test.ts` are gone:

1. empty snapshot-database `exec` method;
2. empty snapshot-database `close` method;
3. nullable blob fixture/result guard;
4. restored-blob non-null assertion.

## Behavioral assertions

The focused test must continue to prove:

- backup checksum is verified before target publication;
- raw SourceVersion blobs restore into the controlled target;
- tampered manifests fail before creating the target;
- missing ParsedArtifact sink fails closed when artifact materialization is required;
- historical Evidence verification is mandatory when Evidence exists;
- a complete restore succeeds only after artifact materialization and Evidence verification.

## User verification

None. This is repository test-harness/static debt and should be verified by CI; do not add user verification debt.
