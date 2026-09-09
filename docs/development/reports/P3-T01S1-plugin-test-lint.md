# P3-T01S1 — Knowledge Plugin Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Reduce the inherited ESLint baseline exposed after P3-T01 fixed the 12 TypeScript errors, starting with one coherent and low-risk tranche: Knowledge paired-plugin test files only.

Parent:

```text
P3-T01 / chore/p3-baseline-closure
```

## Scope

Only the four plugin test files that had deterministic style/safety lint findings:

```text
pi-web-plugins/knowledge/local-integration.e2e.test.ts
pi-web-plugins/knowledge/server-plugin.test.ts
pi-web-plugins/knowledge/server-plugin.viewer.test.ts
pi-web-plugins/knowledge/service-client.test.ts
```

Changes are test-harness-only:

- replace forbidden `Array<T>` forms with `T[]`;
- remove a trivially inferred numeric type annotation on a defaulted test helper parameter;
- ensure Promise rejection fixtures always reject with an `Error` even if an AbortSignal reason is non-Error.

No production plugin/service behavior changes are included.

## Why this is a support slice

The newly exposed lint baseline contains 261 errors across many historical Knowledge files. Folding all of those into P3-T01 would create an unreviewable repository-wide cleanup and violate one-concern PR discipline.

P3-T01 therefore remains PARTIAL while lint closure proceeds through bounded stacked support slices.

## Verification

Required CI evidence:

1. `npm run typecheck` remains PASS;
2. these four files no longer appear in ESLint output for the addressed findings;
3. focused plugin tests remain behaviorally unchanged and pass when CI/test stage is reachable;
4. unrelated lint debt remains explicitly inherited rather than silently modified.

Until CI confirms the tranche, status remains **PARTIAL**.

## User verification

None required. This is autonomous repository hygiene and test-harness debt.
