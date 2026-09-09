# P1-T17 Verification — Worker loop and crash recovery

Status: **OPEN / PARTIAL**

Branch: `feat/p1-worker-loop-crash-recovery`  
Direct base: `feat/p1-durable-job-state-machine`

## Automated/static gates

Run from a clean checkout of this branch:

```bash
npm ci
npm test -- src/knowledge/storage/workerLoop.test.ts src/knowledge/storage/durableJobs.test.ts src/knowledge/storage/database.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-durable-job-state-machine...HEAD
git diff --name-status origin/feat/p1-durable-job-state-machine...HEAD
```

Expected PASS evidence:

- P1-T17 focused scenarios and P1-T16 regressions pass;
- no task-attributable TypeScript/lint/knip/build/package/full-suite failure;
- direct-base diff is worker-loop/test/report/verification/bookkeeping only.

## Real SQLite candidate/claim acceptance

Use a file-backed schema-v5 Knowledge DB with at least three queued jobs.

1. Give two jobs valid future deadlines and one an already-expired deadline.
2. Run one worker iteration.
3. Confirm the expired queued job becomes `failed` with `DEADLINE_EXPIRED` before claim.
4. Confirm the oldest remaining `(created_at,id)` candidate is selected.
5. Race two worker processes against the same queue and confirm only one P1-T16 claim CAS succeeds for a job.
6. Confirm only one handler executes per `runOnce()` invocation.

Expected: discovery never grants ownership and no duplicate running owner exists.

## Heartbeat acceptance

Use a handler that runs longer than one heartbeat interval but shorter than the overall acceptance window.

1. Configure e.g. `leaseMs=3000`, `heartbeatMs=500` for the test only.
2. Start the handler.
3. Observe `heartbeat_at` and `lease_expires_at` advancing while the same worker/fencing token remains active.
4. Confirm the handler eventually succeeds and the final write clears lease owner/expiry/heartbeat fields.

Expected: automatic heartbeat prevents an active job from being recovered as stale.

## Crash recovery acceptance

This requires two actual Node processes or equivalent isolated workers.

1. Worker A claims a job with a short lease and begins a handler.
2. Kill Worker A without running graceful cleanup.
3. Wait until the persisted `lease_expires_at` is in the past.
4. Start Worker B and run one iteration.
5. Confirm Worker B calls fenced expired-lease recovery, closes A's running attempt as failed, requeues the job, claims it with a higher fencing token and completes it.
6. If practical, allow a suspended/stale A process to attempt a late terminal write after B has recovered/claimed; confirm P1-T16 rejects it.

Expected PASS evidence:

```text
attempt 1 / token N     -> failed LEASE_EXPIRED
job                     -> queued
attempt 2 / token N+1   -> running -> succeeded
stale token N completion -> rejected
```

No manual database repair should be needed.

## Cancellation acceptance

1. Start a long-running handler that observes its supplied `AbortSignal`.
2. Request cancellation while it is running.
3. Confirm the worker heartbeat/check observes `cancel_requested` and aborts the signal.
4. Confirm terminal state becomes `cancelled`, not `succeeded` or `failed` from stale handler output.
5. Restart the process and confirm cancellation state/attempt history remains durable.

## Handler failure / unknown kind

1. Register a handler that throws a representative error; confirm durable state is `failed` with bounded serialized name/message and the attempt closes.
2. Submit a job kind with no registered handler; confirm it is claimed then explicitly failed with `UNSUPPORTED_JOB_KIND` rather than repeatedly scanned forever.
3. Restart and confirm both failures remain readable.

## Resource/concurrency boundary

Confirm there is no Redis/RabbitMQ/Kafka dependency, broker daemon, multi-worker scheduler, or unbounded scan. V1 may repeatedly call `runOnce()` from a simple service-owned loop later, but P1-T17 itself must retain one-handler-at-a-time semantics.

## PASS criteria

P1-T17 may move from PARTIAL to PASS only when repository gates pass, real SQLite race/heartbeat/cancellation cases pass, a real process-kill/restart demonstrates stale-lease recovery and fencing, the direct-base diff remains task-only, and the resulting evidence is written back to the report/plan/changelog/debt/PR.
