# P3-T01S2 — Runtime Contract Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue the inherited pre-P3 lint closure with a minimal runtime/contract slice after P3-T01S1 reduced the repository ESLint baseline from 261 to 254 errors.

Base:

```text
chore/p3-t01-plugin-test-lint
```

## Changes

### `src/knowledge/contracts/operations.ts`

Replaced the lint-forbidden array type assertion in `isKnowledgeOperation()` with a precomputed `ReadonlySet<string>` membership check.

The accepted operation allowlist is unchanged:

```text
capabilities.get
workspace.echo
viewer.sources.list
viewer.source.get
viewer.artifact.open
```

### `src/knowledge/runtime/restrictedPiRuntime.ts`

Removed an `async` modifier from the probe tool executor and returned `Promise.resolve(...)` explicitly. This preserves the asynchronous tool contract and exact probe payload while satisfying `@typescript-eslint/require-await`.

## Scope exclusions

This slice does not change:

- ADR-029;
- Knowledge operation names or allowlist membership;
- restricted tool names or isolation policy;
- Source/ParsedArtifact/retrieval schemas;
- P2 evidence or benchmark configuration;
- production P3 Slice A behavior.

## Verification status

CI must confirm:

1. TypeScript remains green;
2. the two targeted lint findings disappear;
3. restricted-runtime and operation-contract tests remain green when the workflow reaches tests;
4. remaining lint findings are classified as inherited baseline and handled in later bounded slices.

Until CI evidence is observed, this task remains **PARTIAL**.

## User verification

No user-local verification is required. This is deterministic repository lint/type behavior and should be verified through GitHub CI.
