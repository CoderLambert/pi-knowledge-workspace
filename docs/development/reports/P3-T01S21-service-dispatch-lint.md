# P3-T01S21 — Service Dispatch Validation Lint

Status: **PARTIAL**

## Purpose

Continue P3-T01 inherited baseline closure after S20 with a deliberately small, high-risk production boundary: authority-bearing viewer dispatch input validation.

## Scope

Production file:

- `src/knowledge/service/dispatch.ts`

Support documentation:

- this report;
- `docs/development/verification/P3-T01S21-service-dispatch-lint.md`.

The verified 68-error baseline reports three `consistent-type-assertions` findings in this file.

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

## Verification state

Status remains **PARTIAL** until GitHub CI confirms:

```text
npm run typecheck → PASS
ESLint 68 → 65
```

`src/knowledge/service/dispatch.ts` must disappear from authoritative lint output. Relevant service/viewer tests and frozen P2 FTS/Lexical workflows must remain green when reached.

## Git discipline

Base: `chore/p3-t01-golden-dataset-test-lint` (#94)

Head: `chore/p3-t01-service-dispatch-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, architecture change, benchmark retuning, P2 evidence mutation or unrelated cleanup.
