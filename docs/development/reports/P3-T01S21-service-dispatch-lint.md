# P3-T01S21 — Service Dispatch Validation Lint

Status: **PASS**

## Purpose

Continue P3-T01 inherited baseline closure after S20 with a deliberately small, high-risk production boundary: authority-bearing viewer dispatch input validation.

## Scope

Production file:

- `src/knowledge/service/dispatch.ts`

Support documentation:

- this report;
- `docs/development/verification/P3-T01S21-service-dispatch-lint.md`.

The verified 68-error parent baseline reported three `consistent-type-assertions` findings in this file.

## Changes

- replace the post-check `Record<string, unknown>` assertion with an explicit `isRecord` type guard;
- require `maxBytes` to narrow to `number` before `Number.isSafeInteger`/positive checks;
- return the narrowed number directly instead of asserting it.

## Contract preservation

The dispatch contract remains unchanged:

- viewer request bodies must be non-array objects;
- unsupported top-level and scope fields remain rejected;
- Project / Workspace / Path scope remains host-authoritative input to the viewer boundary;
- required strings remain non-empty;
- optional `maxBytes` remains a positive safe integer when supplied;
- invalid input still maps to `INVALID_REQUEST` / HTTP 400 through the existing `KnowledgeServiceError` path.

No operation list, protocol version, viewer semantics or P3 feature behavior changes are introduced.

## Verification evidence

GitHub CI run `34452039976` on code head `ec8e87697186c30d4d8248b75cb121d285b28f59` established:

```text
npm run typecheck → PASS
ESLint 68 → 65
```

`src/knowledge/service/dispatch.ts` no longer appears in the authoritative ESLint output. All 65 remaining findings are in pre-existing files outside S21 scope, so the workflow remains globally red only because of inherited baseline debt.

The repository `verify` workflow stops at inherited lint before focused tests/build. No task-owned typecheck or lint regression remains. P2 FTS/Lexical workflows were not triggered for this service-only path, and no P2 evaluation/evidence/configuration files changed.

## Git discipline

Base: `chore/p3-t01-golden-dataset-test-lint` (#94)

Head: `chore/p3-t01-service-dispatch-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, architecture change, benchmark retuning, P2 evidence mutation or unrelated cleanup.
