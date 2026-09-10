# P3-T01S8 Verification — Selected-Machine Federation Test Lint

Status: **PARTIAL — CI evidence pending**

## Automated acceptance

Run/observe repository CI on the P3-T01S8 head and verify:

1. `npm run typecheck` remains PASS.
2. ESLint count decreases from the verified P3-T01S7 baseline of 222 to 219, with the three targeted `no-confusing-void-expression` findings absent from `src/server/knowledgeSelectedMachineFederation.integration.test.ts`.
3. The focused test `src/server/knowledgeSelectedMachineFederation.integration.test.ts` still covers six scenarios and has no task-attributable failure when the test stage is reachable.
4. P2 FTS/Lexical evidence workflows, if path-triggered, are observational only; do not mutate or retune frozen evidence.
5. Direct-base diff contains only this test file plus this task's report and verification guide.

## Semantic regression checklist

The cleanup must preserve:

- selected remote Machine owns Knowledge execution;
- gateway-local sessiond is not used as fallback for a selected remote target;
- target-unavailable and target Knowledge-unavailable responses remain explicit;
- A→B selected-target switching does not leak stale results;
- inbound cancellation reaches the target request;
- explicit Local Machine stays on the local paired-backend route.

## User verification

None required. This task is repository-static/test implementation debt and should be resolved through CI, not deferred to the user's local environment.
