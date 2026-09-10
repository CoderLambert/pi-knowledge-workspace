# P3-T01S18 — Worker / Import Production Lint Verification

Status: **PARTIAL — CI EVIDENCE PENDING**

## Automated verification

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/durableJobs.test.ts src/knowledge/storage/importJobs.test.ts src/knowledge/storage/workerLoop.test.ts
```

Expected task-owned delta:

- 8 inherited findings disappear from `durableJobs.ts`;
- 13 inherited findings disappear from `importJobs.ts`;
- 5 inherited findings disappear from `workerLoop.ts`;
- typecheck remains green;
- repository ESLint baseline should move from 126 to approximately 100; exact CI output is authoritative.

## Behavioral assertions

Verification must preserve:

- idempotent durable/import job submission;
- claim/heartbeat/completion owner and fencing-token predicates;
- stale/expired/non-owner lease rejection;
- cancellation and retry state transitions;
- expired-lease recovery;
- Markdown/TXT import path restrictions and Workspace-root lookup;
- capture hash/byte-length validation against the persisted SourceVersion;
- interruption recovery and attempt recording;
- worker lost-lease classification and timer cleanup;
- malformed SQLite/JSON rows fail closed.

This task does not claim to implement ADR-029 P3-A04 business-commit fencing beyond the existing durable job completion contract.

## Baseline classification

Any unrelated remaining lint findings are inherited P3-T01 baseline debt and must not be absorbed into S18.

## User verification

None. This production refactoring is repository/CI-verifiable and adds no user verification debt.
