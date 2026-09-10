# P3-T01S12 — Restore Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue inherited pre-P3 lint closure with one bounded restore test-harness slice after P3-T01S11 reduced the verified ESLint baseline to 205 findings.

## Changes

Only `src/knowledge/storage/restore.test.ts` is behaviorally touched:

- make the fake snapshot database `exec` / `close` no-op methods explicit;
- make optional blob fixture checks explicit rather than relying on nullable string/Buffer truthiness;
- replace the restored-blob non-null assertion with fail-fast fixture narrowing;
- preserve restore checksum, atomic target publication, blob identity, artifact materialization and historical Evidence verification assertions.

No production restore implementation is changed.

## Verification evidence

Initial GitHub CI run `34436851039` confirmed:

```text
npm run typecheck → PASS
ESLint 205 → 202
```

Three of the four task-owned findings closed, but one `strict-boolean-expressions` finding remained at the optional `blobHash` result construction. That task-owned remainder was corrected with an explicit `blobHash !== undefined` guard. Follow-up CI is required before this slice can be PASS.

Expected corrected endpoint:

```text
npm run typecheck → PASS
ESLint 202 → 201
```

The remaining repository-wide lint findings are inherited baseline debt outside this slice.

## Scope exclusions

No production code, schema, restore format, ADR, retrieval configuration, P2 evidence, benchmark, merge, rebase or force-push changes.
