# P3-T01S11 — Backup Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue inherited pre-P3 lint closure with one bounded backup test-harness slice after P3-T01S10 reduced the verified ESLint baseline to 210 findings.

## Changes

Only `src/knowledge/storage/backup.test.ts` is behaviorally touched:

- make the fake snapshot database `exec` no-op explicit;
- replace one unnecessary async artifact-provider fixture with `Promise.resolve`;
- replace two manifest-entry non-null assertions with fail-fast fixture narrowing;
- replace hard-to-count regex spaces with `{2}`;
- preserve backup publication, snapshot, blob/artifact verification, incomplete-backup rejection and no-overwrite semantics.

No production backup implementation is changed.

## Expected verification

```text
npm run typecheck → PASS
ESLint 210 → 205
```

The five targeted inherited findings in `backup.test.ts` should disappear. Remaining repository-wide lint findings are inherited baseline debt outside this slice.

## Scope exclusions

No production code, schema, backup format, ADR, retrieval configuration, P2 evidence, benchmark, merge, rebase or force-push changes.
