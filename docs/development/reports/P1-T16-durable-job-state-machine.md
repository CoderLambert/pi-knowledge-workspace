# P1-T16 — Durable Job state machine

Status: **PARTIAL**

Branch: `feat/p1-durable-job-state-machine`

Direct base: `feat/p1-source-evidence-viewer` (P1-T15 / PR #25)

## Scope implemented

P1-T16 introduces the reusable durable state-transition contract required before the P1-T17 worker loop.

Schema v5 extends the existing P1-T07 `jobs` / `job_attempts` persistence with:

- durable `attempt` count;
- `lease_owner` and `lease_expires_at`;
- `heartbeat_at`;
- monotonically increasing `fencing_token`;
- durable `deadline_at`;
- durable bounded `error_json` in addition to existing bounded result handling at the state-machine layer;
- attempt-level fencing token and worker identity;
- `(status, lease_expires_at)` index for later stale-work discovery.

`DurableJobStore` implements the state-machine primitives:

- Workspace/kind/idempotency-scoped submit;
- queued → running claim;
- heartbeat/lease renewal;
- queued immediate cancellation;
- running cooperative cancellation request/acknowledgement;
- running → succeeded/failed completion;
- failed → queued retry;
- expired running lease → queued (or cancelled when cancellation was already requested) recovery.

## Fencing invariant

Every successful claim increments both `attempt` and `fencing_token` and creates one durable attempt record. Heartbeat and terminal transitions require the active worker identity and fencing token in the SQL compare-and-swap predicate.

Therefore a worker holding token N cannot complete work after its lease is recovered and a later worker has claimed token N+1.

P1-T17 must consume these primitives instead of updating running-job rows directly.

## Deadline semantics

P1-T16 stores and validates durable deadlines and refuses a new claim after the deadline has elapsed. P1-T17 owns the worker-loop policy that detects/terminates work crossing a deadline while already running; that behavior is intentionally not mixed into this task.

## Metadata bounds

The reusable state-machine boundary rejects oversized result/error JSON before persistence. Defaults are 32 KiB result metadata and 16 KiB error metadata. Payload submission is also bounded to 256 KiB so the job table cannot become an unbounded body store.

Large artifacts/results must remain in purpose-built immutable storage and be referenced by identifier.

## Compatibility with P1-T07

P1-T07's MD/TXT import-job implementation continues to operate against the same tables. New schema columns have safe defaults for inherited rows and P1-T07 attempt inserts: fencing defaults to 0 and worker id may be null.

P1-T16 does not silently rewrite the P1-T07 import runner into the generic worker model. Migration of execution to the worker loop belongs to P1-T17 so each task remains reviewable.

## Tests added/updated

Repository-owned contract coverage now checks:

- schema v5 fields/index and migration rollback;
- idempotent submit lookup;
- claim increments attempt/fencing and records attempt ownership;
- heartbeat SQL requires current owner/token and an unexpired lease;
- stale worker completion fails its CAS and rolls back;
- queued versus running cancellation semantics;
- expired lease recovery closes the fenced attempt and requeues work;
- deadline-expired jobs cannot be newly claimed;
- oversized result/error metadata is rejected before database writes.

The state-machine tests use a scripted `KnowledgeDatabase` seam so these contracts can be reviewed/tested independently of the still-open P1-T01/P1-T02 native `better-sqlite3` verification debt.

## Verification state

The current execution environment cannot resolve `github.com` from the shell and this branch currently has no demonstrated CI evidence. Focused tests, typecheck, lint, knip, build, package dry-run, full suite and real SQLite concurrency/process-restart acceptance therefore remain OPEN. P1-T16 is **PARTIAL**, not PASS.

## ADR impact

No new ADR is required. The task implements the job durability/lease/fencing model already explicitly specified by the development plan and does not introduce Redis, RabbitMQ, Kafka or another external queue.

## Consumer dependency

P1-T17 may proceed against the following unverified contract:

> one local worker claims through `DurableJobStore`; active execution owns a lease/fencing token; stale tokens cannot heartbeat or commit terminal state; worker recovery uses the state-machine transition rather than ad-hoc SQL.

The native SQLite/concurrency risk must remain recorded until executable acceptance is available.
