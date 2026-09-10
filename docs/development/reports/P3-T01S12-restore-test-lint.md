# P3-T01S12 — Restore Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue inherited pre-P3 lint closure with one bounded restore test-harness slice after P3-T01S11 reduced the verified ESLint baseline to 205 findings.

## Changes

Only `src/knowledge/storage/restore.test.ts` is behaviorally touched:

- make the fake snapshot database `exec` / `close` no-op methods explicit;
- make the optional blob fixture guard explicit rather than relying on nullable truthiness;
- replace the restored-blob non-null assertion with fail-fast fixture narrowing;
- preserve restore checksum, atomic target publication, blob identity, artifact materialization and historical Evidence verification assertions.

No production restore implementation is changed.

## Expected verification

```text
npm run typecheck → PASS
ESLint 205 → 201
```

The four targeted inherited findings in `restore.test.ts` should disappear. Remaining repository-wide lint findings are inherited baseline debt outside this slice.

## Scope exclusions

No production code, schema, restore format, ADR, retrieval configuration, P2 evidence, benchmark, merge, rebase or force-push changes.
