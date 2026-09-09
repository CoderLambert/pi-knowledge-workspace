# P1-T16 Verification — Durable Job state machine

Status: **OPEN / PARTIAL**

Branch: `feat/p1-durable-job-state-machine`

Direct base: `feat/p1-source-evidence-viewer`

## Automated/static gates

From a clean checkout:

```bash
npm ci
npx vitest run src/knowledge/storage/database.test.ts src/knowledge/storage/durableJobs.test.ts
npm run typecheck
npm run lint
npm run knip
npm test
npm run build
npm run pack:dry
git diff --check feat/p1-source-evidence-viewer...HEAD
```

Expected PASS evidence:

- schema-v5 and DurableJobStore focused tests pass;
- no task-attributable type/lint/knip/build/package failure;
- full suite has no new P1-T16 regression;
- direct-base diff contains only P1-T16 migration/state-machine/tests/docs.

## Real SQLite migration gate

Using the selected `better-sqlite3` runtime:

1. Create a schema-v4 database with representative existing P1-T07 queued/running/failed/succeeded/cancelled jobs and attempts.
2. Open it through the schema-v5 code.
3. Inspect `PRAGMA user_version`, `PRAGMA table_info(jobs)`, `PRAGMA table_info(job_attempts)` and indexes.
4. Reopen the migrated database.

Expected PASS evidence:

- migration is atomic and `user_version=5`;
- inherited rows remain readable;
- inherited job rows receive `attempt=0`, `fencing_token=0` and null lease/deadline/error fields unless already represented elsewhere;
- inherited attempt rows receive fencing token 0 / null worker id;
- failed migration rolls back to schema v4;
- reopening is idempotent.

## Lease / fencing concurrency gate

Use one real SQLite file and two independent `DurableJobStore` instances (preferably separate Node processes for the strongest evidence).

1. Submit one job with an idempotency key.
2. Race two workers to claim it.
3. Confirm exactly one claim succeeds and obtains fencing token N.
4. Heartbeat from the owner and confirm lease extension.
5. Advance/wait past lease expiry without heartbeat.
6. Recover the expired lease and re-claim with a second worker, obtaining N+1.
7. Attempt `succeed` and `heartbeat` using stale worker/token N.
8. Complete using current worker/token N+1.

Expected PASS evidence:

- at most one active claim exists at any moment;
- attempt/fencing numbers increase monotonically;
- old-token heartbeat/completion changes zero rows and fails explicitly;
- current-token completion succeeds once;
- attempt history records the expired attempt and final attempt distinctly.

## Cancellation gate

Verify separately:

- queued job: `requestCancel` moves directly to `cancelled`;
- running job: `requestCancel` keeps status `running` but sets `cancelRequested`;
- active worker observes cancellation and calls `acknowledgeCancellation` with current token;
- stale/non-owner acknowledgement fails.

Expected PASS evidence: no cancelled job is later reported succeeded by a stale worker.

## Deadline gate

1. Submit a job with a deadline already elapsed; claim must fail.
2. Submit a future-deadline job; claim succeeds before deadline.
3. P1-T17 will separately verify timeout policy for a job that crosses its deadline after claim.

P1-T16 PASS requires only persistence/new-claim deadline enforcement; in-flight timeout behavior belongs to P1-T17.

## Metadata bound gate

Configure small result/error limits and attempt oversized terminal metadata.

Expected PASS evidence:

- oversized metadata throws before the terminal database update;
- active job remains running/current rather than being partially completed;
- normal bounded JSON result/error persists and round-trips.

## Process-restart durability gate

1. Submit and claim a job; persist the lease/attempt/fencing token.
2. Kill the process without completing it.
3. Restart using the same database.
4. Read the job and confirm all lease/fencing/deadline/cancel state survived.
5. After expiry, invoke recovery and confirm the job becomes reclaimable with a new token.

Expected PASS evidence: state is derived from SQLite, not process memory.

## Deferred environment reason

The current automation shell cannot resolve `github.com`, so it cannot obtain a runnable checkout/dependency tree; no CI/status evidence exists for this branch at authoring time. The gates above remain OPEN and the task remains PARTIAL until actual outputs are recorded.
