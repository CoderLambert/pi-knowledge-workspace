# P3-T01S18 — Worker / Import Production Lint

Status: **PARTIAL — CI EVIDENCE PENDING**

Date: 2026-09-10

## Objective

Continue P3-T01 from the verified 126 checkpoint with one cohesive durable-worker/import production slice.

Production files:

- `src/knowledge/storage/durableJobs.ts`
- `src/knowledge/storage/importJobs.ts`
- `src/knowledge/storage/workerLoop.ts`

Targeted inherited findings: **26** (8 + 13 + 5).

## Changes

- replace nullable truthiness checks in idempotency/dedup/job lookup paths with explicit nullish checks;
- replace SQLite row and JSON payload/result assertions with structural fail-closed parsing;
- remove redundant `unknown | null` unions while preserving runtime null values;
- replace worker row type assertions with explicit record validation;
- make optional display-name/cancellation-attempt handling explicit without changing fallback behavior;
- preserve existing lease, heartbeat, cancellation, retry and recovery state transitions.

## Preserved contracts

- DurableJob claim/heartbeat/completion continue to require the same owner/fencing-token/lease predicates;
- stale/expired/non-owner completion still fails closed;
- cancellation remains checked before and during handler execution;
- expired lease recovery retains fencing-token checks;
- import submission remains idempotent per Workspace/key;
- Markdown/TXT path restrictions are unchanged;
- capture still validates SourceVersion content hash/byte length against captured bytes;
- once SourceVersion persistence begins, import continues to finish atomically/idempotently rather than report cancellation after durable persistence;
- worker handler success is not redefined as P3-A04 business-commit authority.

## Expected verification

```text
npm run typecheck → PASS
ESLint baseline: 126 → expected 100
```

CI determines the authoritative endpoint. Focused durable job/import/worker tests should retain existing behavior when reachable.

## Scope exclusions

No P3-A04 business-commit fencing implementation, no Source publication semantics, no schema/ADR/retrieval change, no P2 evidence mutation, no benchmark retuning, no merge, rebase, force-push or unrelated cleanup.
