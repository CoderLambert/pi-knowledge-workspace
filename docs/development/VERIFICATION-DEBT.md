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
- **PR:** pending at time of branch preparation
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