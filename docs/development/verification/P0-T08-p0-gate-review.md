# P0-T08 — P0 Gate Review Verification Guide

## Current gate status

**PARTIAL / NOT PASS** until all mandatory P0 verification debt is resolved.

This guide is intentionally evidence-oriented. It does not ask reviewers to infer PASS from code presence.

## Preconditions

Use the stacked P0 branches/PRs in dependency order:

```text
chore/autonomous-development-policy       # PR #5
feat/p0-thin-knowledge-adapter            # PR #6
test/p0-local-knowledge-integration-e2e   # PR #7
test/p0-selected-machine-federation-routing # PR #8
experiment/p0-restricted-pi-runtime-probe # PR #9
chore/p0-gate-review
```

Do not merge automatically. Review/verify from oldest dependency to newest.

## 1. Repository gate checks

Run the focused suites documented by P0-T04 through P0-T07, then:

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

For every branch, also run its direct-base diff check. For P0-T08:

```bash
git diff --check origin/experiment/p0-restricted-pi-runtime-probe...HEAD
git diff --name-status origin/experiment/p0-restricted-pi-runtime-probe...HEAD
```

### Expected PASS evidence

- focused P0-T04/P0-T05/P0-T06/P0-T07 suites pass with their documented expected counts;
- typecheck, lint, knip, build and package dry-run pass;
- full suite has no new task-attributable failures;
- the known `piSessionService.promptQueue` failure may remain only if its inherited signature is unchanged;
- P0-T08 direct-base diff contains documentation/gate-review changes only and no P1 implementation.

## 2. Local Knowledge integration acceptance

Follow the P0-T04 and P0-T05 verification guides with a real browser, PI WEB web/API process, sessiond and standalone `pi-knowledge` process.

Required observations:

- Knowledge panel reaches `ready` through the existing paired backend;
- Project/Workspace/path exactly match host-authoritative selection;
- A → B → A Workspace switching has no stale scope;
- browser source/network does not expose service token/host/port authority;
- service unavailable, wrong token, protocol mismatch and timeout fail closed;
- service restart recovers without a new browser-visible service endpoint;
- Files/Terminal/Git/Chat continue to work.

## 3. Selected-Machine acceptance

Follow P0-T06 verification using two isolated PI WEB instances and, when available, a real Fleet/multi-host setup.

Required observations:

- explicit Local Machine uses local sessiond/local `pi-knowledge`;
- gateway A selecting target B uses B sessiond/B `pi-knowledge`;
- A local Knowledge receives no fallback request;
- target unavailable fails explicitly;
- target `pi-knowledge` unavailable fails explicitly;
- A → B → A target switching follows each newly selected target;
- cancellation propagates to the selected target;
- only actual multi-host evidence may be labeled real Fleet E2E.

## 4. Restricted Pi runtime acceptance

Run:

```bash
npm test -- src/knowledge/runtime/restrictedPiRuntime.test.ts
```

Inspect the runtime test output and current SDK integration.

Required observations:

- model-visible tools are exactly `knowledge_sources`, `knowledge_search`, `knowledge_read`, `submit_answer`;
- `bash`, filesystem read/write/edit and discovery tools are absent;
- seeded project/global AGENTS, extensions, skills and prompts are not discovered;
- persisted command credentials are not loaded;
- model config/network refresh is disabled by the probe contract.

## 5. P0 architecture stop-condition review

Confirm the implemented P0 path remains:

```text
Knowledge Workspace Panel
→ existing pairedBackend
→ existing selected-Machine federation
→ target sessiond paired plugin
→ thin adapter
→ standalone pi-knowledge
```

### PASS

No widespread private PI WEB core patches, second Machine/Workspace/Session stack, custom Knowledge Fleet protocol, browser-to-service credential path, or heavy Knowledge processing inside sessiond is required.

### FAIL / architecture review required

Any acceptance evidence shows that P0 can work only by duplicating or replacing those upstream-owned boundaries.

## 6. Gate closure procedure

After all required evidence exists:

1. Move P0-T04..P0-T08 verification-debt entries from OPEN to resolved with dates and evidence.
2. Update each originating report and PR description.
3. Update `DEVELOPMENT-PLAN.md` task states and current project position.
4. Update `CHANGELOG.md`.
5. Rerun this gate review.
6. Mark P0-T08 and P0 **PASS only if every mandatory P0 gate row is satisfied**.

Until then, the correct state is **PARTIAL** even if later P1 implementation has begun under the autonomous-development policy.
