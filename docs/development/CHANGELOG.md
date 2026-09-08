# Development Changelog

A concise progress log for Pi Knowledge Workspace.

Use this file to answer quickly:

> What development task changed most recently, what was delivered, and what is its current status?

Detailed implementation evidence belongs in `docs/development/reports/`. Human acceptance steps belong in `docs/development/verification/`.

## Format

```text
YYYY-MM-DD  TASK-ID  STATUS
- one-line outcome
- optional one-line important consequence / blocker
```

Only record task-level progress. Do not duplicate commit-by-commit history.

---

## 2026-09-08

### P0-T02 — PARTIAL

- Added the first runnable Knowledge Workspace paired-plugin skeleton with host-authoritative Project/Workspace scope and zero PI WEB core navigation changes.
- Local focused Knowledge tests pass (8/8), typecheck/lint/knip pass, and the production build succeeds.
- Real verification exposed Node experimental Web Storage shadowing happy-dom `localStorage`; Vitest workers now start with `--no-experimental-webstorage`, reducing the full suite from 297 failures to one unrelated auth/session baseline candidate.
- One existing `piSessionService.promptQueue` auth-warning test still fails and must be compared against the P0-T01 baseline before P0-T02 can be promoted to PASS.

### P0-T01 — PASS

- Verified the stable Knowledge integration seams: Workspace Panel + paired backend + existing selected-machine federation + authoritative server Workspace context.
- Corrected the plan to reuse PI WEB plugin/federation infrastructure instead of building custom navigation, gateway, or Fleet routing.
