# P3-T01S8 — Selected-Machine Federation Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue inherited pre-P3 lint closure with one test-only selected-Machine federation slice after P3-T01S7 reduced the verified baseline to 222 ESLint findings.

## Changes

Only `src/server/knowledgeSelectedMachineFederation.integration.test.ts` is behaviorally touched:

- replace one shorthand abort callback with an explicit block-bodied branch;
- replace two shorthand `vi.waitFor` assertion callbacks with block bodies;
- preserve request routing, cancellation propagation, selected-target authority, zero gateway-local fallback, and all assertions.

No production routing implementation is changed.

## Expected verification

```text
npm run typecheck → PASS
ESLint 222 → 219
```

The focused federation test must preserve its six existing scenarios. Any remaining repository-wide lint findings are inherited baseline debt outside this slice.

## Scope exclusions

No ADR change, no Machine/Fleet production route change, no schema change, no retrieval change, no P2 evidence mutation, no benchmark rerun/tuning, no merge/rebase/force-push.
