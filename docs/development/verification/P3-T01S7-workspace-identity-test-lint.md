# P3-T01S7 — Verification

Status: **CI-FIRST / USER VERIFICATION NOT REQUIRED**

## Automated acceptance

GitHub CI must establish:

```text
npm run typecheck
npm run lint
```

Expected progression:

```text
TypeScript remains green
ESLint 227 → 222
```

The five target findings are the inherited `workspaceIdentity.test.ts` findings reported by the P3-T01S6 CI baseline.

## Focused behavioral check

When CI reaches tests, the existing Workspace identity suite must still prove:

- same realpath resolves to the same durable Knowledge Workspace identity;
- distinct worktree realpaths remain isolated;
- external routing metadata may change without changing canonical Knowledge identity.

## User verification

None. This is deterministic repository test-harness cleanup and should not create verification debt.