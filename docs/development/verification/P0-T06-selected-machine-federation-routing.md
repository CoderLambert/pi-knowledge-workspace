# P0-T06 — Selected Machine / Fleet Routing Verification

## Status

**PARTIAL** until the repository gates and the physical multi-instance/Fleet checks below are executed and recorded.

Branch: `test/p0-selected-machine-federation-routing`  
PR: #8  
Direct base: `test/p0-local-knowledge-integration-e2e` (PR #7)

## Automated repository checks

From a clean checkout of this branch:

```bash
npm ci
npm test -- src/server/knowledgeSelectedMachineFederation.integration.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/test/p0-local-knowledge-integration-e2e...HEAD
git diff --name-status origin/test/p0-local-knowledge-integration-e2e...HEAD
```

Expected focused behavior:

- local Machine remains on local paired-backend/sessiond;
- selected target uses `/api/machines/:machineId/paired-plugin-backends/knowledge/...` and forwards to target `/api/paired-plugin-backends/knowledge/...`;
- target transport failure is explicit;
- target `pi-knowledge` 503 is preserved;
- target A then target B returns the corresponding target result;
- inbound cancellation aborts the target Machine request;
- remote scenarios never call gateway-local sessiond.

For the full suite, do not patch the inherited `src/server/sessions/piSessionService.promptQueue.test.ts` baseline failure merely to make the suite green. Record it only if its signature remains unchanged; any new P0-T06-attributable failure must be fixed.

## Physical local-Machine check

1. Start PI WEB web/API, sessiond and `pi-knowledge` using the same server-side `PI_KNOWLEDGE_TOKEN`.
2. Open a Workspace on the explicit Local Machine.
3. Open Knowledge and run **Check integration**.
4. Confirm the response renders `ready` and the exact selected Project / Workspace / Path.
5. Confirm browser network traffic goes through PI WEB paired backend and contains no direct `pi-knowledge` token/host/port authority.

**PASS evidence:** screenshot/network capture plus server/sessiond/service logs showing the local paired-backend chain and exact authoritative scope.

## Two-isolated-instance routing-contract check

This proves routing semantics only; do **not** label it remote Fleet E2E.

Prepare two isolated instances with distinct ports, state directories, sessiond processes and Knowledge services/tokens:

```text
Gateway A
Target B
```

Use a test Workspace on B whose path/label is visibly different from any Workspace on A.

1. Register/select B from A using normal PI WEB Machine support.
2. In A's browser, select B's Workspace and open Knowledge.
3. Run **Check integration**.
4. Confirm the returned Project / Workspace / Path belongs to B.
5. Confirm B sessiond and B `pi-knowledge` logs receive the request.
6. Confirm A sessiond and A `pi-knowledge` receive no Knowledge request for that operation.

**PASS evidence:** correlated browser + A gateway + B sessiond + B service logs, with the B workspace identity and no A-local fallback.

## Failure and switching cases

### Target unavailable

Stop the selected target PI WEB/API while leaving gateway-local Knowledge healthy. Run the Knowledge check again.

Expected: explicit remote-machine failure; no `ready`; gateway-local service receives no fallback request.

### Target `pi-knowledge` unavailable

Keep target PI WEB/sessiond healthy but stop target `pi-knowledge`. Keep gateway-local `pi-knowledge` healthy.

Expected: explicit target Knowledge/service-unavailable failure; no `ready`; no gateway-local fallback.

### Switch target

With targets A and B distinguishable, execute:

```text
select A → Check integration
select B → Check integration
select A → Check integration
```

Expected: A/B/A scope follows the selected Machine on each new request; no stale B result after returning to A.

### In-flight cancellation

Make target Knowledge handling long enough to observe cancellation, start a check, then navigate/close/cancel the initiating request so the browser disconnects.

Expected: cancellation propagates gateway → Machine request → target paired backend/adapter; no late fallback request is sent locally.

## Real Fleet / multi-host acceptance

When two actual PI WEB Fleet machines are available, repeat the selected-target success, unavailable target, target-service unavailable, switching and cancellation cases across hosts.

Only this evidence may be described as **real remote Fleet E2E**.

## Final PASS criteria

P0-T06 may change from PARTIAL to PASS only when:

1. focused test passes;
2. typecheck/lint/knip/build/pack gates pass;
3. full suite has no new task-attributable failure;
4. diff check confirms task-only scope;
5. physical local and selected-target routing evidence proves no gateway-local fallback;
6. required real Fleet evidence is recorded if the P0/P0-T08 gate requires remote Fleet acceptance.

Record evidence in this guide, `docs/development/reports/P0-T06-selected-machine-federation-routing.md`, `docs/development/VERIFICATION-DEBT.md`, DEVELOPMENT-PLAN and changelog before upgrading status.
