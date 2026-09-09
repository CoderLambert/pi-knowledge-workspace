# P3-T01S6 — UTF-8 Range Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue P3-T01 inherited static cleanup with a single-file, test-only slice after S5 reduced ESLint to 233 findings.

## Changes

`src/knowledge/storage/utf8Range.test.ts` converts six assertion callbacks from shorthand void expressions to block-bodied callbacks. Assertions, inputs, byte ranges and expected errors are unchanged.

## Expected verification

```text
npm run typecheck → PASS
ESLint 233 → 227 errors
```

Six inherited `@typescript-eslint/no-confusing-void-expression` findings are targeted.

## Scope exclusions

No production code, schema, ADR, retrieval configuration, P2 evidence or benchmark changes.
