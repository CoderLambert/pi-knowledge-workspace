# P3-T01S19 — Worker / Import Test-Harness Lint

Status: **PASS**

## Purpose

Continue P3-T01 inherited baseline closure from the verified 100-error checkpoint with the test harnesses adjacent to the already-clean worker/import production boundary.

## Scope

Changed test files:

- `src/knowledge/storage/importJobs.test.ts`
- `src/knowledge/storage/workerLoop.test.ts`

Support documentation:

- this report;
- `docs/development/verification/P3-T01S19-worker-import-test-harness-lint.md`.

Authoritative parent CI reported 23 inherited findings in these two files:

```text
importJobs.test.ts  11
workerLoop.test.ts  12
```

No production code, ADR, schema, retrieval configuration, P2 evaluation data/evidence, benchmark configuration, or product behavior is in scope.

## Changes

### Import test harness

- make no-op database methods explicit instead of empty functions;
- replace nullable-string truthiness with explicit undefined narrowing;
- stringify numeric fixture identifiers before template interpolation;
- replace unnecessary `async` test doubles with explicit resolved/rejected Promises;
- replace the in-flight cancellation non-null assignment pattern with an explicit holder;
- replace the interrupted-job non-null assertion with fail-fast fixture narrowing.

### Worker test harness

- replace `Array<T>` spellings with `T[]`;
- make no-op database methods explicit;
- make the fake store extend `DurableJobStore` so the worker receives a nominally valid store without type assertions;
- model the one-shot claim-race injection with explicit fake-store state instead of method reassignment/type assertion;
- replace unnecessary async handlers with explicit `Promise.resolve` handlers;
- add required `override` modifiers and remove the redundant constructor exposed by the stricter type/lint rules.

## Contract preservation

The test scenarios remain the same:

- import submission/idempotency and Markdown/TXT restriction;
- authoritative Workspace capture and SourceVersion persistence;
- failure/retry convergence;
- queued and in-flight cancellation;
- restart recovery;
- worker expired-lease recovery and queued-deadline expiration;
- fenced success/failure/cancellation;
- stale terminal-write rejection;
- claim-race fallback to the next candidate.

The task does not alter production worker/import semantics and does not reopen ADR-029.

## Verification evidence

Initial CI exposed task-owned type/lint interactions and they were corrected within this same bounded task. Final production/test code head:

```text
a1a07c2b0c408e1043d419c7c8ba789efd8afb5c
```

GitHub CI run `34446070579` confirmed:

```text
npm run typecheck → PASS
ESLint 100 → 77
```

Neither `src/knowledge/storage/importJobs.test.ts` nor `src/knowledge/storage/workerLoop.test.ts` appears in the final authoritative ESLint output. The remaining 77 findings are inherited baseline outside S19 scope; CI remains globally red because `npm run verify` stops at repository lint before knip/full tests.

Frozen P2 regression workflows passed on the same final code head:

```text
P2 FTS Evidence     34446070590 → PASS
P2 Lexical Evidence 34446070612 → PASS
```

No frozen evidence, evaluation inputs, thresholds, retrieval configuration, or benchmark tuning changed.

## Status decision

**PASS.** All 23 task-owned inherited lint findings are closed, typecheck is green, the frozen P2 regression workflows are green, and no user-local acceptance is required for this static/test-harness task.

## Git discipline

Base: `docs/p3-t01-100-checkpoint-clean` (#90)

Head: `chore/p3-t01-worker-import-test-harness-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, benchmark retuning, P2 evidence mutation, or unrelated cleanup.
