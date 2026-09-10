# P1-T07 — MD/TXT import job

Status: **PARTIAL**  
Branch: `feat/p1-md-txt-import-job`  
Base: `feat/p1-safe-workspace-file-reader`

## Scope

Implemented the first durable Workspace MD/TXT import path:

```text
submit import
→ durable queued job + Source
→ P1-T06 safe file capture
→ captured bytes
→ P1-T04/P1-T05 SourceVersion persistence
→ durable result
```

No parser, ParsedArtifact, chunking, indexing, worker loop, lease/heartbeat/fencing system, browser UI, or retrieval logic is included.

## Schema v2

Migration 2 adds only the minimum fields needed by this task to the existing `jobs` table:

- `idempotency_key`;
- `cancel_requested`;
- `result_json`;
- unique `(knowledge_workspace_id, kind, idempotency_key)` index when the key is non-null.

P1-T16 remains responsible for the general durable job state machine additions such as lease, heartbeat, fencing token and deadline.

## Import contract

`MdTextImportJobs` supports:

- `.md`, `.markdown` and `.txt` submissions;
- idempotent submit per Workspace/job-kind/key;
- Source creation transactionally bound to first job creation;
- explicit single-job execution;
- exact P1-T06 safe captured bytes passed directly into SourceVersion persistence;
- verification that the persisted SourceVersion hash/length matches the captured-byte identity;
- durable attempt rows;
- explicit retry from `failed`;
- queued cancellation;
- cooperative in-flight cancellation after safe capture and before SourceVersion persistence;
- restart recovery of inherited `running` imports back to `queued` while marking unfinished attempts failed.

## Crash/idempotency reasoning

A process may die after SourceVersion persistence but before the job's success result is committed. Replaying the recovered job is safe because P1-T05 converges identical bytes on `UNIQUE(source_id, content_sha256)`. The import job therefore does not invent a second persistence identity.

The job obtains the Workspace root from `knowledge_workspaces.canonical_realpath`; it does not persist or trust a browser-provided absolute root. P1-T06 is the single path/byte trust boundary.

## Cancellation boundary

P1-T07 does not add preemptive cancellation inside P1-T06's bounded file read. Cancellation is checked before capture and immediately after capture. Once SourceVersion persistence starts, the operation is allowed to finish atomically/idempotently rather than report cancellation after a durable side effect may already exist.

## Tests

- database migration tests now cover schema v1 → v2 and rollback preservation;
- six `MdTextImportJobs` scenarios cover submit idempotency/type filtering, real safe-capture success, failure + retry, queued cancellation, in-flight cancellation before persistence, and restart recovery.

## Verification status

The current execution environment cannot run repository dependencies, native SQLite, or target filesystem/process restart acceptance, and no CI evidence is assumed. P1-T07 remains PARTIAL with OPEN verification debt.

P1-T08 may proceed against the immutable SourceVersion/result contract; it must parse SourceVersion bytes, not reopen mutable Workspace files.
