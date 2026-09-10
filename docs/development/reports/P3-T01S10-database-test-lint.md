# P3-T01S10 — Database Migration Test Lint Baseline

Status: **PASS**

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

## Verification evidence

GitHub CI run `34435790425` confirmed:

```text
npm run typecheck → PASS
ESLint 215 → 210
```

All five S10-owned findings disappeared. The CI workflow remains red only because 210 inherited repository-wide ESLint findings remain and `npm run verify` stops at lint before knip/tests/build. P2 FTS Evidence run `34435790418` and P2 Lexical Evidence run `34435790390` both succeeded on the same head.

## Scope exclusions

No production code, migration/schema change, ADR change, retrieval change, P2 evidence mutation, benchmark tuning, merge, rebase or force-push.
