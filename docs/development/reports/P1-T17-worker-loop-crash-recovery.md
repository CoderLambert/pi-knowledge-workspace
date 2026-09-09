# P1-T17 — Worker loop and crash recovery

Status: **PARTIAL**

Branch: `feat/p1-worker-loop-crash-recovery`  
Direct base: `feat/p1-durable-job-state-machine`

## Scope implemented

P1-T17 adds the V1 single-concurrency durable worker that consumes P1-T16's lease/fencing state machine. SQLite remains the only queue/state store; no Redis, RabbitMQ, Kafka, distributed scheduler or multi-worker orchestration is introduced.

The worker performs one bounded iteration:

```text
recover expired running leases
→ fail queued jobs whose deadline expired before claim
→ discover queued candidates
→ claim one through DurableJobStore CAS/fencing
→ run the registered handler
→ heartbeat while running
→ observe cooperative cancellation
→ fenced terminal success/failure/cancel
```

## Implementation

Added `src/knowledge/storage/workerLoop.ts` with `DurableJobWorker`.

### Candidate discovery

Queued candidates are selected in deterministic `(created_at,id)` order, excluding `cancel_requested` and already-expired deadlines. Discovery does not itself grant ownership; every candidate must still pass P1-T16 `claim()` so racing workers cannot both own the same job.

### Crash recovery

Before new work, the worker scans a bounded set of expired `running` leases and calls P1-T16 `recoverExpiredLease(jobId,fencingToken)`. Recovery is fenced; a lease renewed or replaced after the scan is not overwritten.

Queued jobs whose durable deadline expires before claim are transitioned to `failed` with a bounded `DEADLINE_EXPIRED` error instead of remaining permanently unclaimable.

### Handler execution

Handlers are registered by durable job `kind`. Unknown kinds are failed explicitly after a valid claim. Only one handler runs per `runOnce()` invocation, preserving the V1 concurrency target of one heavy ingestion/rebuild worker.

While a handler is pending, an automatic heartbeat timer:

- reloads durable cancellation state;
- aborts the handler signal when cancellation is requested;
- renews only through the current worker/fencing token;
- aborts on heartbeat/lease rejection.

Handler success is committed only after re-reading cancellation state and then calling P1-T16 fenced `succeed()`. Handler errors are serialized to bounded name/message metadata and committed through fenced `fail()`. Cancellation uses fenced `acknowledgeCancellation()`.

If terminal persistence rejects a stale/expired/non-owner lease, the worker reports `lost-lease` and does not retry the terminal write with guessed ownership.

## Locked invariants

1. Queue discovery never equals ownership; P1-T16 fenced claim remains authoritative.
2. At most one job handler runs per worker iteration.
3. Expired leases are recovered only with the observed fencing token.
4. A stale worker cannot publish success/failure after losing its lease.
5. Running cancellation is cooperative and never converted into success after the flag is observed.
6. Handler code receives an `AbortSignal` but no direct ability to bypass fenced terminal state.
7. Unknown job kinds fail explicitly rather than spinning forever.
8. Deadline-expired queued jobs do not remain permanently stuck.
9. All scans are bounded.
10. No external queue infrastructure is introduced.

## Tests

`src/knowledge/storage/workerLoop.test.ts` covers:

- expired-lease recovery plus pre-claim deadline expiry;
- one queued job claim and successful fenced completion;
- unsupported job kind failure;
- cooperative cancellation after handler completion;
- lost fencing token during terminal completion;
- claim race followed by the next candidate.

The tests use a scripted database and P1-T16-compatible fake store so loop policy can be checked without weakening the real store contract.

## Deferred verification

The autonomous environment cannot execute repository dependencies or orchestrate real process crashes. P1-T17 therefore remains PARTIAL until the verification guide proves:

- focused/static/build/package/full-suite gates;
- real `better-sqlite3` candidate scanning and CAS behavior;
- automatic heartbeat extends a live lease;
- killing a worker leaves a lease that another process recovers after expiry;
- stale worker completion is rejected after recovery/fencing-token increment;
- cooperative cancellation aborts a real long-running handler;
- deadline timeout and unknown-kind failure are durable across process restart.

## Scope check

Direct-base comparison must contain only P1-T17 worker-loop implementation/tests and required task records. No P1-T18 IndexBuild publication, retrieval/model/UI changes, backup/restore or unrelated baseline repair belongs in this PR.
