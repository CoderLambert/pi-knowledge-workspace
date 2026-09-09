# Deferred Verification Debt

This ledger tracks acceptance checks that autonomous development cannot execute because they require the user's local environment or another unavailable capability.

The authoritative execution policy is `docs/development/AUTONOMOUS-EXECUTION.md`.

## Rules

- Missing local/manual evidence keeps the originating task `PARTIAL` when that evidence is required for PASS.
- Verification debt does not by itself stop later implementation.
- Later tasks must document assumptions when they consume an unverified contract.
- Each task remains isolated in its own branch/PR.
- A phase/release gate cannot be declared PASS while required debt for that gate remains unresolved.
- When evidence is later supplied, update this ledger, the task report, plan/changelog status, and PR description.

## Open debt

### P0-T04 — Thin server-plugin adapter acceptance

- **Task status:** PARTIAL
- **Branch:** `feat/p0-thin-knowledge-adapter`
- **PR:** #6
- **Debt status:** OPEN
- **Why deferred:** the autonomous execution environment can edit/review GitHub but does not have a runnable repository checkout/dependency tree, GitHub has not supplied task CI evidence, and the real PI WEB/sessiond → standalone-service acceptance requires the user's local runtime environment.
- **Required verification:**
  1. Run the focused P0-T04 adapter suite: `npm test -- pi-web-plugins/knowledge/server-plugin.test.ts pi-web-plugins/knowledge/service-client.test.ts` and record the exact count (expected 15).
  2. Run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, and `npm run pack:dry`.
  3. Confirm `dist/pi-web-plugins/knowledge/server-plugin.js` and `dist/pi-web-plugins/knowledge/service-client.js` are emitted.
  4. Run `git diff --check origin/chore/autonomous-development-policy...HEAD`.
  5. Run the full test suite and confirm any failure is only the already classified inherited `src/server/sessions/piSessionService.promptQueue.test.ts` assertion unless a new P0-T04 defect is found.
  6. Start standalone `pi-knowledge` and PI WEB/sessiond with the same server-side `PI_KNOWLEDGE_TOKEN`; confirm `knowledge.status` traverses the real server-plugin adapter and returns host-authoritative Project/Workspace/Path.
  7. Confirm service unavailable, wrong token and protocol mismatch fail closed without a false `ready` result or credential disclosure.
  8. Confirm cancellation/deadline behavior and that browser code contains no `pi-knowledge` token/host/port authority.
- **Expected PASS evidence:** focused/static/build/package gates pass; real server-plugin → service call authenticates and returns exact host scope; negative cases fail explicitly; no new task-attributable full-suite failures; no service credential or connection authority reaches browser code.
- **Assumptions used for continued development:** P0-T03 protocol v1 and `workspace.echo` remain stable; `PairedPluginRequestContext` Project/Workspace/signal remain host-owned; sessiond and `pi-knowledge` can share `PI_KNOWLEDGE_TOKEN` through server-side environment configuration; the browser continues to call `knowledge.status` with null/empty input; existing PI WEB paired-backend/federation routing remains authoritative.
- **Dependent tasks:** P0-T05, P0-T06, P0-T08, P1 tasks that reuse the service boundary
- **Resolution:** pending user verification; later implementation may proceed against the documented contract under the autonomous-development policy.

### P0-T05 — Real local Browser → PI WEB → sessiond → pi-knowledge E2E

- **Task status:** PARTIAL
- **Branch:** `test/p0-local-knowledge-integration-e2e`
- **PR:** #7
- **Debt status:** OPEN
- **Why deferred:** the repository-owned cross-layer E2E is written but cannot be executed in the autonomous environment, and complete acceptance requires the user's real browser plus PI WEB web/API process, sessiond process, local Workspace state and standalone service.
- **Required verification:**
  1. Run `npm test -- pi-web-plugins/knowledge/local-integration.e2e.test.ts` and record the exact count (expected 4).
  2. Rerun the P0-T04 focused dependency suite (expected 15), then TypeScript, ESLint, knip, build and package dry-run.
  3. Run `git diff --check origin/feat/p0-thin-knowledge-adapter...HEAD` and the full suite; classify the known promptQueue failure only if its inherited signature is unchanged.
  4. Start real `pi-knowledge`, PI WEB web/API, sessiond and browser with one server-side token; select a Workspace, open Knowledge, click Check integration, and confirm ready plus exact host Project/Workspace/Path.
  5. Switch Workspace A → B → A and confirm Knowledge scope follows without stale state; include a real Git worktree path if available.
  6. Verify service stopped, wrong token, incompatible protocol, request timeout and service restart behavior; none may produce a false ready state or leak credentials.
  7. Confirm browser network/source contains no direct `pi-knowledge` token/host/port authority and continues through PI WEB's paired backend.
  8. Smoke Files/Terminal/Git/Chat while Knowledge integration is active.
- **Expected PASS evidence:** P0-T05 focused/static/build/package gates pass; full suite has no new task-attributable failure; real browser local integration renders exact authoritative scope; A→B→A follows host state; all five failure/recovery cases behave explicitly; browser never receives service credentials or direct localhost service authority; existing Workspace tools remain functional.
- **Assumptions used for continued development:** P0-T04 adapter semantics and the new cross-layer sessiond-route test correctly model the target-side local chain; PI WEB selected-Machine routing remains unchanged and will be proven separately in P0-T06; no gateway-local fallback is permitted when a selected target Machine owns the paired backend.
- **Dependent tasks:** P0-T06, P0-T08, later Knowledge browser surfaces
- **Resolution:** pending user verification; compatible real E2E evidence may also close P0-T04 real-adapter rows, but not P0-T04's separate focused/static/build rows.

### P0-T06 — Selected Machine / Fleet Knowledge routing acceptance

- **Task status:** PARTIAL
- **Branch:** `test/p0-selected-machine-federation-routing`
- **PR:** #8
- **Debt status:** OPEN
- **Why deferred:** deterministic repository coverage is implemented, but the autonomous execution environment has no runnable checkout/dependency tree and no physical two-instance or real Fleet/multi-host topology. Those capabilities are required to produce executable and environmental acceptance evidence.
- **Required verification:**
  1. Run `npm test -- src/server/knowledgeSelectedMachineFederation.integration.test.ts` and record the exact result (expected 6 tests).
  2. Run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, `npm run pack:dry`, then the full `npm test` suite; do not patch the known inherited promptQueue baseline merely to obtain green.
  3. Run `git diff --check origin/test/p0-local-knowledge-integration-e2e...HEAD` and `git diff --name-status origin/test/p0-local-knowledge-integration-e2e...HEAD`; confirm only P0-T06 test/report/verification/plan/changelog/debt records are present.
  4. With the explicit Local Machine selected, confirm Knowledge `ready` follows the normal local paired-backend → local sessiond → local adapter/service chain.
  5. With two isolated PI WEB instances, select target B from gateway A and confirm Knowledge returns B's distinct Workspace identity, B sessiond/B `pi-knowledge` receive the request, and A sessiond/A `pi-knowledge` receive no fallback request. This proves routing semantics only and must not be labeled real Fleet E2E.
  6. Stop target PI WEB/API while gateway-local Knowledge remains healthy; confirm an explicit remote-machine failure and zero local fallback.
  7. Keep target PI WEB/sessiond healthy but stop target `pi-knowledge`; confirm the target's explicit service-unavailable failure and zero gateway-local fallback.
  8. Switch target A → B → A and confirm each new request follows the currently selected Machine with no stale result.
  9. Cancel an in-flight selected-target Knowledge request and confirm cancellation propagates through the gateway Machine request to the target-side chain without a late local fallback.
  10. When actual Fleet/multi-host machines are available, repeat success, target-unavailable, service-unavailable, switching and cancellation cases across hosts. Only this evidence may be described as real remote Fleet E2E.
- **Expected PASS evidence:** focused/static/build/package gates pass; full suite has no new P0-T06-attributable failure; direct-base diff is task-only; local and selected-target physical logs prove the target owns Knowledge execution; failure/cancellation cases fail closed; gateway-local Knowledge is never used as fallback; real Fleet evidence is recorded when required by the P0 gate.
- **Assumptions used for continued development:** `PAIRED_PLUGIN_BACKEND_REQUEST_ROUTE_PATH` remains in PI WEB's generic federation allowlist with bounded cancellation; selected Machine identity remains request authority; P0-T04/P0-T05 target-side Knowledge contracts remain valid while their own debts are open; later tasks must reuse pairedBackend instead of adding Knowledge-specific Machine routing.
- **Dependent tasks:** P0-T07, P0-T08, later remote-capable Knowledge surfaces
- **Resolution:** pending executable/local/Fleet verification; later tasks may proceed against the locked routing contract under the autonomous-development policy.

### P0-T07 — Restricted Pi runtime acceptance

- **Task status:** PARTIAL
- **Branch:** `experiment/p0-restricted-pi-runtime-probe`
- **PR:** #9
- **Debt status:** OPEN
- **Why deferred:** repository-owned runtime code/tests are present, but the autonomous environment cannot execute the repository dependency tree and GitHub has not supplied CI evidence for the branch.
- **Required verification:**
  1. Run `npm test -- src/knowledge/runtime/restrictedPiRuntime.test.ts` and record the exact test count/result.
  2. Run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, `npm run pack:dry`, and the full `npm test` suite.
  3. Run `git diff --check origin/test/p0-selected-machine-federation-routing...HEAD` and confirm the P0-T07 direct-base diff is task-only.
  4. Confirm active model-visible tools are exactly `knowledge_sources`, `knowledge_search`, `knowledge_read`, and `submit_answer`.
  5. Confirm `bash`, `read`, `write`, `edit`, `grep`, `find`, `ls`, arbitrary project extensions, AGENTS/context, skills and prompt templates are not loaded by the restricted runtime fixture.
  6. Confirm the runtime uses in-memory settings/session state, an in-memory credential store, `modelsPath: null`, no create-time model refresh, and no model-network refresh according to the current Pi SDK surface.
- **Expected PASS evidence:** focused/static/build/package/full-suite gates show no P0-T07-attributable failure; the runtime exposes only the four Knowledge tools and discovers none of the seeded hostile project/global resources or persisted command credentials/configuration.
- **Assumptions used for continued development:** the current Pi SDK configuration semantics used by the probe remain stable enough for P3 to later implement the production restricted runtime; no P1 task should depend on model execution; if SDK semantics change, P3 must revalidate rather than inherit an obsolete isolation assumption.
- **Dependent tasks:** P0-T08, P3-T03, P3-T04 and grounded Ask runtime work
- **Resolution:** pending executable repository verification.

### P0-T08 — P0 gate closure evidence

- **Task status:** PARTIAL
- **Branch:** `chore/p0-gate-review`
- **PR:** #10
- **Debt status:** OPEN
- **Why deferred:** P0-T08 is a strict phase gate. P0-T04 through P0-T07 still have mandatory executable/local/Fleet/runtime acceptance debt, so the gate cannot become PASS in the autonomous environment.
- **Required verification:**
  1. Resolve the mandatory P0-T04 through P0-T07 debt rows above with dated evidence.
  2. Run `git diff --check origin/experiment/p0-restricted-pi-runtime-probe...HEAD` and confirm P0-T08 contains documentation/gate-review scope only.
  3. Re-run the P0-T08 verification guide's repository, local integration, selected-Machine/Fleet, restricted-runtime and architecture stop-condition checks.
  4. Update the originating reports, PR descriptions, `DEVELOPMENT-PLAN.md`, `CHANGELOG.md`, and this ledger with the final evidence.
- **Expected PASS evidence:** every mandatory P0 gate condition is green; no P0-T04..T08 required debt remains OPEN; no invasive PI WEB infrastructure rewrite is required; P0-T08 and the P0 phase may then be marked PASS.
- **Assumptions used for continued development:** autonomous P1 implementation may proceed against documented P0 contracts, but P0 remains explicitly PARTIAL and later tasks may not cite this gate as accepted evidence until closure.
- **Dependent tasks:** P1 implementation may proceed under policy; release/phase acceptance depends on eventual closure.
- **Resolution:** pending P0 verification-debt closure and gate rerun.

### P1-T01 — SQLite driver target-runtime acceptance

- **Task status:** PARTIAL
- **Branch:** `experiment/p1-sqlite-driver-decision`
- **PR:** #11
- **Debt status:** OPEN
- **Why deferred:** the autonomous environment can review repository/upstream sources but cannot install or execute the selected native SQLite binding on the user's target Omarchy/Linux x64 environment.
- **Required verification:**
  1. After P1-T02 integrates `better-sqlite3` 13.x, run `npm install` on the target supported Node runtime and confirm the native binding resolves.
  2. Create/query an FTS5 virtual table and confirm no `no such module: fts5` failure.
  3. Verify explicit commit and rollback semantics used by the migration layer.
  4. Create a file-backed database, run the driver's online backup, open the backup independently and confirm snapshot contents.
  5. Verify safe local extension loading feasibility when a trusted test extension is available; do not use untrusted binaries merely to satisfy this check.
  6. After dependency integration, run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, `npm run pack:dry`, and `npm test`.
  7. Verify packaged `pi-knowledge` resolves the native binding on target Linux x64.
- **Expected PASS evidence:** selected dependency installs/resolves; FTS5, transactions and backup work; package/build gates show no driver-attributable failures; packaged service starts with the native binding. Extension loading either passes or is explicitly deferred only for extension-dependent later work.
- **Assumptions used for continued development:** `better-sqlite3` 13.x remains the selected direct driver; P1-T02 may implement against it without a dual-driver abstraction; if target packaging or mandatory FTS5 fails materially, ADR-028 must be reopened rather than silently adding a second backend.
- **Dependent tasks:** P1-T02 database bootstrap/migrations, P1-T12 FTS5 baseline, P1-T20/P1-T21 backup/restore; P2-T07 extension work depends specifically on extension feasibility.
- **Resolution:** pending target-runtime verification; P1-T02 may proceed against ADR-028 under the autonomous-development policy.

### P1-T04 — Blob-store executable/filesystem acceptance

- **Task status:** PARTIAL
- **Branch:** `feat/p1-content-addressed-blob-store`
- **PR:** #14
- **Debt status:** OPEN
- **Why deferred:** the GitHub-only automation environment cannot execute the repository dependency tree or filesystem acceptance harness, and the PR head currently has no GitHub Actions workflow run.
- **Required verification:**
  1. Run `npm test -- src/knowledge/storage/blobStore.test.ts` and confirm 6/6 tests pass.
  2. Run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, `npm run pack:dry`, and full `npm test`.
  3. Run `git diff --check origin/feat/p1-knowledge-workspace-identity...HEAD` and confirm the direct-base diff is P1-T04-only.
  4. Exercise a real temporary filesystem root and confirm exact raw-byte roundtrip at `blobs/sha256/<hash>`.
  5. Confirm repeated and concurrent identical writes converge on one final object without overwrite/truncation.
  6. Tamper with a published object and confirm `read`, `verify`, and an identical `put` fail closed with `BlobIntegrityError`.
  7. Confirm traversal-shaped/uppercase/wrong-length/non-hex hashes are rejected before path access.
  8. Confirm stale store-owned temp files are cleaned while recent and unrelated files remain untouched.
- **Expected PASS evidence:** focused/static/build/package/full-suite gates show no new P1-T04-attributable failure; direct-base diff is task-only; filesystem evidence demonstrates atomic immutable publication, dedupe, tamper detection and bounded cleanup behavior.
- **Assumptions used for continued development:** P1-T05 may use `put(rawBytes)`, `read(hash)` and SHA-256 blob identity; the store root remains a local filesystem where hard links within `blobs/sha256` are supported; if target packaging/filesystem constraints invalidate hard-link publication, P1-T04 must be revised without changing SourceVersion identity semantics.
- **Dependent tasks:** P1-T05, P1-T07, P1-T20, P1-T21 and all historical-content durability work
- **Resolution:** pending executable/filesystem verification; later tasks may proceed against the narrow content-addressed contract.

### P1-T05 — Source/SourceVersion domain acceptance

- **Task status:** PARTIAL
- **Branch:** `feat/p1-source-version-domain`
- **PR:** #15
- **Debt status:** OPEN
- **Why deferred:** the GitHub-only automation environment cannot execute the repository dependency tree or real `better-sqlite3` database; P1-T05 also inherits unresolved P1-T02 native SQLite and P1-T04 blob-store acceptance risk.
- **Required verification:**
  1. Run `npm test -- src/knowledge/storage/sourceDomain.test.ts` and confirm 5/5 tests pass.
  2. Run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, `npm run pack:dry`, and full `npm test`.
  3. Run `git diff --check origin/feat/p1-content-addressed-blob-store...HEAD` and confirm the direct-base diff is P1-T05-only.
  4. With a real file-backed Knowledge DB, create/list/rename/archive a Source and confirm metadata changes create no SourceVersion.
  5. Capture byte sequence A twice and confirm the same SourceVersion id/row is reused.
  6. Capture changed bytes B and confirm exactly one new SourceVersion with a different content hash.
  7. Run concurrent identical captures and confirm `UNIQUE(source_id, content_sha256)` converges on one version.
  8. Confirm archived Source history remains readable and Workspace A list results never expose Workspace B Sources.
  9. Confirm every stored `blob_key` is the content address rather than an absolute mutable path and resolves through P1-T04 verified read.
- **Expected PASS evidence:** focused/static/build/package/full-suite gates show no new P1-T05-attributable failure; real SQLite demonstrates byte-change-only version creation, metadata-only stability, concurrency dedupe, archive preservation and Workspace isolation; blob integrity remains valid.
- **Assumptions used for continued development:** P1-T02 schema constraints behave as written under the selected SQLite driver; P1-T04 content-addressed publication remains immutable; P1-T06 may feed captured bytes only after performing its own containment, sensitivity, size and race checks.
- **Dependent tasks:** P1-T06, P1-T07, P1-T08 and all historical SourceVersion consumers
- **Resolution:** pending executable/SQLite/blob dependency verification; later tasks may proceed against the explicit Source capture contract.

### P1-T06 — Safe Workspace file-reader acceptance

- **Task status:** PARTIAL
- **Branch:** `feat/p1-safe-workspace-file-reader`
- **PR:** #16
- **Debt status:** OPEN
- **Why deferred:** the GitHub-only automation environment cannot execute the repository dependency tree or target Linux filesystem acceptance, and the PR head has no GitHub Actions workflow run.
- **Required verification:**
  1. Run `npm test -- src/knowledge/storage/workspaceFileReader.test.ts` and confirm 8/8 tests pass.
  2. Run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, `npm run pack:dry`, and full `npm test`.
  3. Run `git diff --check origin/feat/p1-source-version-domain...HEAD` and confirm the direct-base diff is P1-T06-only.
  4. On the target filesystem, capture a contained MD/TXT file and confirm exact returned bytes and SHA-256.
  5. Confirm parent traversal, absolute paths and an escaping symlink fail before bytes are returned; confirm a symlink whose canonical target stays inside the Workspace remains usable.
  6. Confirm `.env`, `.env.*`, `.ssh/**`, common `id_*` private keys, `*.pem` and `*.key` fail with `SENSITIVE_FILE`.
  7. Confirm files above the configured limit fail with `FILE_TOO_LARGE` and non-regular paths fail closed.
  8. Replace, rewrite, remove or retarget a selected path during capture and confirm `FILE_CHANGED_DURING_CAPTURE`; no ambiguous bytes may be returned.
  9. Confirm P1-T06 itself creates no blob, SourceVersion, job or parser artifact.
- **Expected PASS evidence:** focused/static/build/package/full-suite gates show no new P1-T06-attributable failure; direct-base diff is task-only; target filesystem evidence proves containment, symlink, sensitivity, size and replacement-race defenses plus exact-byte hashing.
- **Assumptions used for continued development:** successful `CapturedWorkspaceFile.bytes` are the only bytes P1-T07 may ingest; P1-T07 must not reopen the path after P1-T06 validation; the target Node/Linux filesystem exposes stable `dev`/`ino` identity through `stat`/`fstat`; P1-T04/P1-T05 remain the only blob/SourceVersion persistence path.
- **Dependent tasks:** P1-T07 and any later Workspace-file reimport/update flow
- **Resolution:** pending executable/target-filesystem verification; later implementation may proceed against the captured-byte contract.

### P1-T07 — Durable MD/TXT import-job acceptance

- **Task status:** PARTIAL
- **Branch:** `feat/p1-md-txt-import-job`
- **PR:** #17
- **Debt status:** OPEN
- **Why deferred:** the GitHub-only automation environment cannot execute repository dependencies, native `better-sqlite3`, real process restart/crash injection, or target filesystem acceptance; the PR has no trusted CI evidence yet.
- **Required verification:**
  1. Run `npm test -- src/knowledge/storage/database.test.ts src/knowledge/storage/importJobs.test.ts` and confirm the migration suite plus 6/6 import-job cases pass.
  2. Rerun P1-T04/P1-T05/P1-T06 dependency focused suites, then `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, `npm run pack:dry`, and full `npm test`.
  3. Run `git diff --check origin/feat/p1-safe-workspace-file-reader...HEAD` and confirm the direct-base diff contains only P1-T07 migration/import/test/docs/plan/changelog/debt scope.
  4. Open a real schema-v1 fixture and confirm migration to schema v2 preserves data, creates the idempotency index, and rollback preserves schema v1 if migration 2 fails.
  5. Submit an MD/TXT import twice with one idempotency key; confirm exactly one job and one Source are created.
  6. Execute the import and confirm the SourceVersion id/hash/length recorded in `result_json` exactly matches P1-T06 captured bytes and P1-T04/P1-T05 persistence.
  7. Inject failure then retry; confirm durable attempt history and no duplicate SourceVersion for identical bytes.
  8. Verify queued cancellation and running cancellation before persistence create no SourceVersion.
  9. Kill/restart with an import marked `running`; run recovery, confirm unfinished attempt becomes failed and job becomes queued, then replay successfully.
  10. Reproduce a crash after SourceVersion persistence but before success metadata if practical; replay and confirm SourceVersion uniqueness converges rather than duplicating content.
  11. Confirm only `.md`, `.markdown`, `.txt` are accepted and the persisted job payload contains a relative path/source id, never caller authority over an absolute Workspace root.
- **Expected PASS evidence:** focused/static/build/package/full-suite gates show no new P1-T07-attributable failure; schema v1→v2 works on real SQLite; idempotency, retry, cancellation and crash recovery behave as documented; imported content identity exactly matches the safe captured bytes.
- **Assumptions used for continued development:** P1-T06 safe capture remains the sole mutable-filesystem trust boundary; P1-T05 `(source_id, content_sha256)` uniqueness makes post-persistence replay idempotent; P1-T16/T17 will later generalize leases/heartbeats/fencing/worker claiming without changing successful SourceVersion identity; P1-T08 must parse immutable SourceVersion content rather than reopen Workspace paths.
- **Dependent tasks:** P1-T08 and later parser/index pipeline; P1-T16/P1-T17 will generalize the job engine.
- **Resolution:** pending executable/native-SQLite/restart acceptance; later implementation may proceed against the immutable SourceVersion result contract.

### P1-T08 — ParsedArtifact canonicalization acceptance

- **Task status:** PARTIAL
- **Branch:** `feat/p1-parsed-artifact-canonicalization`
- **PR:** #18
- **Debt status:** OPEN
- **Why deferred:** the GitHub-only automation environment cannot execute the repository dependency tree or target filesystem/blob acceptance harness, and the PR head currently has no GitHub commit status evidence.
- **Required verification:**
  1. Run `npm test -- src/knowledge/storage/parsedArtifact.test.ts` and confirm 7/7 focused tests pass.
  2. Run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, `npm run pack:dry`, and full `npm test`.
  3. Run `git diff --check origin/feat/p1-md-txt-import-job...HEAD` and `git diff --name-status origin/feat/p1-md-txt-import-job...HEAD`; confirm only P1-T08 implementation/tests/report/verification/plan/changelog/debt records are present.
  4. Confirm LF and BOM+CRLF/CR forms of equivalent UTF-8 content produce identical canonical text and canonical-text SHA-256.
  5. Confirm Chinese, emoji, combining characters, duplicated prose, headings, lists, tables and fenced code preserve deterministic UTF-8 byte addressing.
  6. Confirm invalid UTF-8 fails closed rather than replacement-decoding.
  7. Canonicalize through `ParsedArtifactCanonicalizer.fromSourceVersion()` after changing/removing the original Workspace file; confirm immutable blob content remains authoritative and no Workspace reread occurs.
  8. Confirm mismatched SourceVersion `blobKey`/content hash, byte length, or tampered blob fails closed before an artifact is accepted.
- **Expected PASS evidence:** focused/static/build/package/full-suite gates show no new P1-T08-attributable failure; direct-base diff is task-only; canonicalization is deterministic across newline/BOM variants; Unicode and Markdown/TXT structure use stable canonical UTF-8 byte ranges; immutable SourceVersion/blob identity is enforced.
- **Assumptions used for continued development:** P1-T04 verified blob reads and P1-T05 SourceVersion identity remain valid while their own debt is open; P1-T09 may treat P1-T08 canonical bytes as valid UTF-8 with BOM removed and newlines normalized to LF; any parser/normalization fingerprint change requires artifact regeneration rather than reinterpretation of existing byte ranges.
- **Dependent tasks:** P1-T09, P1-T10, P1-T11, P1-T12 and all later Evidence/retrieval consumers
- **Resolution:** pending executable/filesystem/blob verification; later tasks may proceed against the documented canonical-byte contract.

P0-T03 is already fully accepted and remains PASS.

## Entry template

```markdown
### <TASK-ID> — <short verification name>

- **Task status:** PARTIAL
- **Branch:** `<branch>`
- **PR:** #<number>
- **Debt status:** OPEN
- **Why deferred:** <capability unavailable to automation>
- **Required verification:**
  1. <exact step>
  2. <exact step>
- **Expected PASS evidence:** <observable result/log/UI state>
- **Assumptions used for continued development:** <documented contract or assumption>
- **Dependent tasks:** <task ids or none>
- **Resolution:** pending user verification
```

## Resolved debt

Move completed entries here with the date, supplied evidence, and resulting task-status change.