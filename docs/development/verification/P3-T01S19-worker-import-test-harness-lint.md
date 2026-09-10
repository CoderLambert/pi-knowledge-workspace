# P3-T01S19 Verification — Worker / Import Test-Harness Lint

Status: **PARTIAL**

## Automated verification

Run on the task branch:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/importJobs.test.ts src/knowledge/storage/workerLoop.test.ts
```

Required result for task PASS:

- typecheck remains PASS;
- both focused test files pass;
- neither `importJobs.test.ts` nor `workerLoop.test.ts` appears in authoritative ESLint output;
- repository lint total moves from the verified parent baseline of 100 to 77, unless CI exposes a directly task-owned interaction that is corrected within this same task;
- any unrelated remaining lint/test failure is recorded as inherited baseline rather than expanded into this task.

## Semantic regression checks

The focused tests must continue proving:

1. MD/TXT import submission remains idempotent.
2. Unsupported file extensions remain rejected.
3. Workspace-authoritative bytes produce the expected SourceVersion hash/result.
4. Capture failure can be explicitly retried and converges on one durable SourceVersion.
5. Queued cancellation performs no capture/persistence.
6. In-flight cancellation after safe capture prevents SourceVersion persistence.
7. Interrupted running imports recover to queued with the crashed attempt marked failed.
8. Worker recovery handles expired leases and queued deadlines before reporting idle.
9. Handler success commits through the fenced store.
10. Unsupported job kinds fail explicitly.
11. Cooperative cancellation prevents success publication.
12. Lost lease/fencing authority prevents retrying the terminal write.
13. A claim race skips the raced candidate and attempts the next queued job.

## Frozen boundaries

Verification must not modify or retune:

- ADR-029;
- P2 golden/holdout datasets or evidence artifacts;
- retrieval profile/compiler/Top-K configuration;
- benchmark inputs or acceptance thresholds;
- production worker/import behavior merely to make lint green.

## User verification debt

None expected. This is a repository test-harness/static-cleanup task and should be fully verifiable by CI/focused automated tests. If CI cannot execute a required repository-owned check for an environmental reason, record that as implementation/CI evidence limitation first; do not create user-local verification debt unless the missing check genuinely requires user hardware, browser, Fleet, system service, or manual semantic acceptance.
