# P3-T01S5 — Storage Test Harness Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue inherited pre-P3 static cleanup with a bounded test-only storage slice after S4 reduced ESLint to 242 findings.

## Changes

- `durableJobs.test.ts`: make the no-op test-database `close()` explicit.
- `searchQuery.test.ts`: make no-op `exec()` / `close()` fixtures explicit.
- `sourceDomain.test.ts`: make no-op database methods explicit and stringify the generated numeric id in the template literal.
- `fts5Index.test.ts`: make no-op `close()` explicit and convert two void-expression assertion callbacks to block bodies.

The test semantics and production contracts are unchanged.

## Expected verification

```text
npm run typecheck → PASS
ESLint 242 → 233 errors
```

Nine inherited lint findings are targeted. CI evidence is required before PASS.

## Scope exclusions

No production code, schema, ADR, retrieval configuration, P2 evidence or benchmark changes.
