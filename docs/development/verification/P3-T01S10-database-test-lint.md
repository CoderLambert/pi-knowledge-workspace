# P3-T01S10 — Database Migration Test Lint Verification

Status: **PARTIAL — CI evidence pending**

## Automated verification

Run on the task branch:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/database.test.ts
```

Expected static result:

```text
typecheck: PASS
ESLint inherited baseline: 215 → 210
```

Confirm the five prior findings in `src/knowledge/storage/database.test.ts` are gone:

1. nullable `failOn` strict-boolean finding;
2. nullable regex-capture strict-boolean finding;
3. first void-expression assertion callback;
4. `Array<T>` tuple-list syntax;
5. second void-expression assertion callback.

## Behavioral assertions

The focused test must continue to prove:

- migrations advance to the current Knowledge schema version;
- existing databases upgrade without replaying migration 1;
- current-schema migration is idempotent;
- newer unsupported schemas fail closed;
- failed migration steps roll back to the previously committed schema version;
- `withTransaction` commits successful operations and rolls back failures while preserving the original error.

## User verification

None. This is repository test-harness/static debt and should be verified by CI; do not add user verification debt.
