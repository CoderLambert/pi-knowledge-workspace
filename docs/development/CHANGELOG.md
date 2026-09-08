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

## 2026-09-09

### P0-T04 — PARTIAL

- Thin Knowledge server-plugin adapter implemented: host-authoritative `PairedPluginRequestContext` scope is sent to standalone `pi-knowledge` through authenticated loopback HTTP using fixed `workspace.echo` dispatch.
- Browser input cannot choose service host/port/token/operation or override Project/Workspace scope; service echo mismatches, non-loopback targets, oversized traffic, protocol/request-id mismatches, cancellation and deadlines fail closed.
- Focused adapter tests were added, including direct client → real P0-T03 Fastify service coverage; executable test/static/build and real local sessiond→service evidence is recorded as deferred verification debt.
- Under the autonomous-development policy, P0-T05 may proceed on a separate stacked branch while P0-T04 remains PARTIAL.

### P0-T03 — PASS

- Standalone authenticated loopback `pi-knowledge` process/contract accepted with protocol v1, `capabilities.get`, `workspace.echo`, stable errors, auth, request/response bounds, and independent process lifecycle.
- Focused tests passed 14/14; TypeScript, ESLint, knip, build, package dry-run, dist entry, and diff check passed.
- Full suite recorded 3752 passed / 1 inherited failed / 2 skipped; the sole `piSessionService.promptQueue` failure matches the P0-T01/P0-T02 inherited baseline and is not a P0-T03 regression.
- Real built-process acceptance passed loopback bind, non-loopback rejection, health/dispatch, negative cases, request/response limits, and clean SIGINT/SIGTERM shutdown. P0-T04 was not started.

### P0-T02 — PASS

- Knowledge Workspace paired-plugin skeleton accepted locally.
- Host-authoritative Project / Workspace / Path and Workspace switching were verified.
- Git worktree scope and existing Files / Terminal / Git / Chat behavior were verified without regression.
- The sole remaining full-suite auth/session failure was reproduced on the P0-T01 baseline and classified as inherited.

## 2026-09-08

### P0-T01 — PASS

- Verified the stable Knowledge integration seams: Workspace Panel + paired backend + existing selected-machine federation + authoritative server Workspace context.
- Corrected the plan to reuse PI WEB plugin/federation infrastructure instead of building custom navigation, gateway, or Fleet routing.
