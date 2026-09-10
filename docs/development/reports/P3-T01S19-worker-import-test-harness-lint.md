# P3-T01S19 — Worker / Import Test-Harness Lint

Status: **PARTIAL**

## Purpose

Continue P3-T01 inherited baseline closure from the verified 100-error checkpoint with the test harnesses adjacent to the already-clean worker/import production boundary.

## Scope

Changed test files:

- `src/knowledge/storage/importJobs.test.ts`
- `src/knowledge/storage/workerLoop.test.ts`

Support documentation:

- this report;
- `docs/development/verification/P3-T01S19-worker-import-test-harness-lint.md`.

Authoritative CI at the parent checkpoint reported 23 inherited findings in these two files:

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
- replace the in-flight cancellation non-null assignment pattern with an explicitly initialized optional fixture reference;
- replace the interrupted-job non-null assertion with fail-fast fixture narrowing.

### Worker test harness

- replace `Array<T>` spellings with `T[]`;
- make no-op database methods explicit;
- make the fake store extend `DurableJobStore` so the worker receives a nominally valid store without type assertions;
- model the one-shot claim-race injection with explicit fake-store state instead of method reassignment/type assertion;
- replace unnecessary async handlers with explicit `Promise.resolve` handlers;
- add the required `override` modifiers to fake-store methods that intentionally override `DurableJobStore` methods.

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

## Verification state

Initial GitHub CI run `34443652575` on head `517cf46dc525bad026fb255d0aca633c39987748` failed during `npm run typecheck` before lint. The failure was task-owned and isolated to `workerLoop.test.ts`: seven methods on `FakeStore extends DurableJobStore` required explicit `override` modifiers under the repository TypeScript configuration.

That defect was corrected in commit `1d8eabe9359e84f2ebd7d0cee17e8a8b698d2b08` without changing test scenarios or production code. P2 FTS Evidence run `34443652562` and P2 Lexical Evidence run `34443652553` both passed on the initial S19 head; no frozen evidence/configuration changed.

A follow-up CI run has not yet been published for the corrected head at the time of this report update. Until CI proves typecheck remains green and the 23 task-owned lint findings are removed without new task-owned failures, task status remains **PARTIAL**.

Expected inherited repository lint endpoint if all targeted findings close cleanly:

```text
100 → 77
```

Any remaining repository failures outside the two task files must be classified against the inherited baseline rather than pulled into this scope.

## Git discipline

Base: `docs/p3-t01-100-checkpoint-clean` (#90)

Head: `chore/p3-t01-worker-import-test-harness-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, benchmark retuning, P2 evidence mutation, or unrelated cleanup.
