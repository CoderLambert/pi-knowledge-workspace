# P3-T01S10 — Database Migration Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue inherited pre-P3 lint closure with one bounded database migration test slice after P3-T01S9 reduced the verified ESLint baseline to 215 findings.

## Changes

Only `src/knowledge/storage/database.test.ts` is behaviorally touched:

- make nullable `failOn` / regex-capture checks explicit;
- replace `Array<T>` tuple-list syntax with `T[]` syntax;
- convert void-expression assertion callbacks to block bodies;
- preserve migration ordering, rollback, schema-version and transaction assertions.

No production database or migration implementation is changed.

## Expected verification

```text
npm run typecheck → PASS
ESLint 215 → 210
```

The five targeted inherited findings in `database.test.ts` should disappear. Remaining repository-wide lint findings are inherited baseline debt outside this slice.

## Scope exclusions

No production code, migration/schema change, ADR change, retrieval change, P2 evidence mutation, benchmark tuning, merge, rebase or force-push.
