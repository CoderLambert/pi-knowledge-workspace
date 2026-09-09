# P1-T22 — Evidence Durability E2E Report

## Status

**PARTIAL**

Branch: `test/p1-evidence-durability-e2e`  
Direct base: `feat/p1-restore-cli` (P1-T21 / PR #31)

## Objective

Lock the P1 durability invariant with one repository-owned lifecycle scenario:

```text
Import
→ Parse
→ Search
→ create/open Evidence
→ rechunk
→ reparse
→ Source update
→ old IndexBuild GC
→ process restart
→ backup
→ restore
→ original Evidence still resolves to exact historical text
```

P1 must not be considered accepted merely because the current Source or SQLite database opens. Historical Evidence is the durable user-facing invariant.

## Implementation

Added `src/knowledge/storage/evidenceDurability.e2e.test.ts`.

The scenario composes the existing P1 implementations rather than introducing a parallel test architecture:

- file-backed `openKnowledgeDatabase` / current migrations;
- `ContentAddressedBlobStore`;
- `SourceDomain`;
- `MdTextImportJobs` and the safe Workspace file reader;
- `ParsedArtifactCanonicalizer`;
- `chunkParsedArtifact`;
- `Fts5BaselineIndex`;
- `IndexBuildPublisher`;
- server-derived `StableEvidence` + `EvidenceReadApi`;
- `IndexBuildRetention.gcRetained`;
- process-close/reopen semantics;
- `KnowledgeBackupCreator`;
- `KnowledgeRestore`.

The fixture uses a Chinese + emoji Evidence quote and an ASCII lexical search anchor so the E2E tests Evidence UTF-8 durability without conflating the gate with Chinese tokenizer quality.

## ParsedArtifact dependency

P1-T08 still has no production durable ParsedArtifact materialization/read store. P1-T20 and P1-T21 already fail closed around that missing provider.

P1-T22 therefore uses a deliberately test-owned immutable artifact bundle store implementing only the already-defined narrow interfaces:

- `ParsedArtifactReadStore`;
- `BackupArtifactProvider`;
- `RestoreArtifactSink`.

The bundle stores exact canonical bytes, document structure and lineage metadata. Restore re-hashes the bundle and checks its metadata against the backup manifest before publication.

This fixture is not promoted to production code and does not waive the missing production provider.

## Historical Evidence verification

The restore path receives an explicit `RestoreEvidenceVerifier`. Before the restore directory is atomically published it:

1. opens the restored SQLite snapshot read-only;
2. enumerates every Evidence row;
3. loads the exact historical ParsedArtifact id referenced by that Evidence;
4. reruns `assertEvidenceMatchesArtifact` against restored canonical bytes;
5. performs an exact `EvidenceReadApi` read;
6. requires the returned text to equal persisted `exact_quote`.

The final post-restore assertion also proves:

- the original Evidence still points to the original ParsedArtifact;
- the original SourceVersion remains available;
- the later SourceVersion is also present;
- the current artifact does not replace historical citation authority.

## Rebuild / GC coverage

The scenario creates and publishes four IndexBuild generations:

1. original artifact, normal chunk budget;
2. same artifact, different rechunk budget;
3. same SourceVersion under a different parser fingerprint/artifact id;
4. updated SourceVersion/current artifact.

It then GCs retained builds and requires the first three IndexBuilds to be removed while the historical SourceVersion, ParsedArtifact and Evidence remain readable.

## Verification state

No GitHub commit status/CI run is present for the current branch HEAD. This execution environment does not have a runnable repository dependency tree, so the focused test, TypeScript, ESLint, knip, build, package and full-suite gates are not represented as PASS.

The test itself also requires the selected native `better-sqlite3`/FTS5 runtime; that target-runtime acceptance is intentionally left as verification debt rather than mocked away.

## Scope review

P1-T22 is a gate/test task. It adds only the integrated durability harness and task records. It does not add P2 retrieval evaluation, vector search, model execution, new UI, distributed infrastructure, or a production artifact-store design.

## Remaining gate debt

P1 remains **PARTIAL** until at minimum:

- the T22 integrated test executes successfully on the supported target runtime;
- static/build/package/full-suite gates have no new P1-attributable failures;
- `better-sqlite3` is a real packaged dependency rather than a local `--no-save` verification install;
- a production durable ParsedArtifact materialization/read provider is implemented and wired into viewer/backup/restore paths;
- backup→restore from the production provider proves the original historical Evidence exact quote after process restart and old IndexBuild GC;
- all earlier P1 mandatory verification debt required by the phase gate is reconciled.

Until then this branch is implementation-complete but acceptance-incomplete.