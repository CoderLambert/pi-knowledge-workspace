# P3-T01S8 — Selected-Machine Federation Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue inherited pre-P3 lint closure with one test-only selected-Machine federation slice after P3-T01S7 reduced the verified baseline to 222 ESLint findings.

## Changes

Only `src/server/knowledgeSelectedMachineFederation.integration.test.ts` is behaviorally touched:

- replace the abort rejection callback with an explicit block-bodied `void` callback;
- replace two shorthand `vi.waitFor` assertion callbacks with block bodies;
- preserve request routing, cancellation propagation, selected-target authority, zero gateway-local fallback, and all assertions.

No production routing implementation is changed.

## Verification evidence

Initial CI run `34426042135` established:

```text
npm run typecheck → PASS
ESLint 222 → 220
```

Two of the three intended findings disappeared, but one task-owned `no-confusing-void-expression` finding remained on the abort rejection callback. S8 therefore remained PARTIAL rather than being overclassified as PASS.

That callback has now been repaired with a block-bodied `(): void` function. The branch was then aligned to the corrected S7 docs base using an ordinary merge commit; no rebase or force-push was used. The direct-base diff remains exactly this test file plus this report and the verification guide.

Latest CI rerun is pending. Expected successful endpoint:

```text
npm run typecheck → PASS
ESLint 220 → 219
```

The focused federation test must preserve its six existing scenarios. Any remaining repository-wide lint findings are inherited baseline debt outside this slice.

## Scope exclusions

No ADR change, no Machine/Fleet production route change, no schema change, no retrieval change, no P2 evidence mutation, no benchmark rerun/tuning, no PR merge, no rebase and no force-push.
