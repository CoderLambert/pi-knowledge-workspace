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

### P0-T02 — PASS

- Knowledge Workspace paired-plugin skeleton accepted locally.
- Host-authoritative Project / Workspace / Path and Workspace switching were verified.
- Git worktree scope and existing Files / Terminal / Git / Chat behavior were verified without regression.
- The sole remaining full-suite auth/session failure was reproduced on the P0-T01 baseline and classified as inherited.

### P0-T01 — PASS

- Verified the stable Knowledge integration seams: Workspace Panel + paired backend + existing selected-machine federation + authoritative server Workspace context.
- Corrected the plan to reuse PI WEB plugin/federation infrastructure instead of building custom navigation, gateway, or Fleet routing.
