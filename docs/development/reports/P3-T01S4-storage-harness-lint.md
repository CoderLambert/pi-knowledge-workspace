# P3-T01S4 — Storage Harness Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue the inherited pre-P3 static baseline closure with a test-only storage harness slice after P3-T01S3 reduced ESLint to 247 errors.

## Scope

Changed only test fixtures:

- `src/knowledge/storage/indexBuildPublication.test.ts`
- `src/knowledge/storage/indexBuildRetention.test.ts`
- `src/knowledge/storage/sourceEvidenceViewer.utf8.test.ts`
- `src/knowledge/storage/workspaceFileReader.test.ts`

No production code, schema, ADR, retrieval configuration, P2 evidence or benchmark data is changed.

## Changes

- Replace four lint-reported empty fixture methods with explicit `return undefined` no-ops.
- Remove the unused `WorkspaceFileReadError` import while retaining the existing error-name assertion string.

The fixture semantics remain unchanged: database `close`/`exec` methods still perform no work and Workspace reader tests continue asserting the same runtime error shape.

## Expected verification

Baseline before this slice:

```text
npm run typecheck → PASS
ESLint → 247 errors
```

Target after this slice:

```text
npm run typecheck → PASS
ESLint → 242 errors
```

The task remains **PARTIAL** until CI confirms those five targeted findings are removed without new findings in the changed files.

## User verification

None. This is autonomous repository static/test debt and must not be added to `VERIFICATION-DEBT.md`.
