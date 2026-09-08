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
- Local focused tests pass (8/8) and the production build succeeds.
- `npm run verify` exposed four ESLint violations in the Knowledge browser plugin/test; the redundant capability check, unsafe assertion, floating promise, and `as never` test fixture have been corrected on the branch.
- A fresh local `npm run verify` rerun is still required before P0-T02 can be promoted to PASS.

### P0-T01 — PASS

- Verified the stable Knowledge integration seams: Workspace Panel + paired backend + existing selected-machine federation + authoritative server Workspace context.
- Corrected the plan to reuse PI WEB plugin/federation infrastructure instead of building custom navigation, gateway, or Fleet routing.
