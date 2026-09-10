# P3-T01S18 — Worker / Import Production Lint

Status: **PASS**

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
- preserve existing lease, heartbeat, cancellation, retry and recovery state transitions;
- reject non-JSON top-level `undefined`/function/symbol values explicitly before serialization, preserving the existing fail-closed JSON contract without relying on a lint-redundant post-`JSON.stringify` check.

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

## Verification evidence

GitHub CI run `34441857553` on production code head `2a121385e754bb0f00dd7a11cae7d07d241ee539` confirmed:

```text
npm run typecheck → PASS
ESLint baseline: 126 → 100
```

All 26 task-owned findings are closed. The repository-wide CI remains red only because 100 inherited P3-T01 ESLint findings remain outside this slice. P2 FTS Evidence run `34441857510` and P2 Lexical Evidence run `34441857478` both passed on the same production head; no frozen P2 evidence or retrieval configuration was modified.

## Scope exclusions

No P3-A04 business-commit fencing implementation, no Source publication semantics, no schema/ADR/retrieval change, no P2 evidence mutation, no benchmark retuning, no merge, rebase, force-push or unrelated cleanup.
