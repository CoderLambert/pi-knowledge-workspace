# P0-T06 — Selected Machine / Fleet Routing Verification Report

## Task metadata

- **Task:** P0-T06
- **Phase:** P0 — Integration / security / process boundary
- **Date:** 2026-09-09
- **Branch:** `test/p0-selected-machine-federation-routing`
- **Stacked base:** `test/p0-local-knowledge-integration-e2e` (PR #7)
- **PR:** #8 — `test: verify P0-T06 selected-machine Knowledge federation` (draft)
- **Status:** **PARTIAL**
- **P0-T07 implementation mixed into this branch:** no
- **Verification guide:** `docs/development/verification/P0-T06-selected-machine-federation-routing.md`
- **Verification debt ledger:** `docs/development/VERIFICATION-DEBT.md`

## Objective

Lock down the contract that Knowledge follows PI WEB's selected Machine and its existing paired-backend federation path instead of resolving `pi-knowledge` from the browser/gateway host.

```text
Browser / Gateway
→ /api/machines/:machineId/paired-plugin-backends/knowledge/...
→ existing MachineService / MachineClient federation
→ selected target PI WEB
→ target sessiond paired backend
→ target Knowledge adapter
→ target pi-knowledge
```

No Knowledge-specific remote route, discovery protocol, retry layer or fallback path is introduced.

## Implementation

Added `src/server/knowledgeSelectedMachineFederation.integration.test.ts`.

The suite exercises the production `buildApp()` route graph and the real generic `machineProxyRoutes` federation registration through the existing app test harness. It deliberately treats the remote target as a MachineClient boundary: this is deterministic routing-contract coverage, not a claim of physical Fleet E2E.

### Covered contracts

1. **Explicit local Machine** — `/api/machines/local/paired-plugin-backends/...` remains on the existing local paired-backend route and reaches local sessiond.
2. **Selected target Machine** — `/api/machines/:targetId/paired-plugin-backends/knowledge/...` is forwarded to the target path `/api/paired-plugin-backends/knowledge/...` with the existing plugin federation timeout and cancellation signal.
3. **Target unavailable** — a remote transport failure is returned as the existing gateway error; the gateway-local session daemon remains untouched.
4. **Target `pi-knowledge` unavailable** — the target's explicit 503 Knowledge error is preserved; no gateway-local fallback is attempted.
5. **Target switching** — independent requests addressed to target A then target B return their respective target result and do not leak the previous target response.
6. **Cancellation propagation** — aborting the inbound gateway request aborts the signal passed to the selected target Machine request.
7. **No fallback invariant** — every remote-path scenario asserts zero gateway-local sessiond requests.

## Production-code impact

None. Inspection confirmed that P0-T06 can be satisfied by locking down existing behavior:

- `src/shared/federatedRoutes.ts` already allowlists `PAIRED_PLUGIN_BACKEND_REQUEST_ROUTE_PATH` with `PLUGIN_BACKEND_FEDERATION_TIMEOUT_MS`, request/response bounds and `propagateCancellation: true`.
- `src/server/machines/machineProxyRoutes.ts` already converts `/api/machines/:machineId/...` to the corresponding target `/api/...` request and passes the bounded cancellation signal.
- `src/server/plugins/pluginBackendProxyRoutes.ts` owns the explicit local paired-backend route.

Adding a Knowledge-specific production route would duplicate upstream-owned routing and violate the P0 integration-seam decision.

## Verification state

**PARTIAL.** Source-level implementation/review is complete in GitHub, but this automation environment has no runnable checkout/dependency tree and no real two-instance/Fleet topology. Therefore executable repository gates and physical routing acceptance are OPEN verification debt.

Required deferred evidence:

- focused P0-T06 test execution;
- typecheck, lint, knip, build and package dry-run;
- full-suite regression classification;
- direct local Machine browser check;
- two isolated PI WEB instances proving gateway → selected target → target sessiond → target `pi-knowledge`;
- target unavailable / target service unavailable / A→B switching / in-flight cancellation observations;
- a real Fleet/multi-host run before describing the behavior as remote Fleet E2E.

## Assumptions for later tasks

- the generic paired-backend federation contract remains authoritative;
- the selected Machine id used by the browser/runtime determines the `/api/machines/:machineId/...` authority for each request;
- remote transport/service failures remain explicit and fail closed;
- PI WEB must never retry a selected remote Knowledge request against gateway-local sessiond/service;
- P0-T04/P0-T05 target-side Knowledge contracts remain as documented while their acceptance debt is open.

Later tasks should consume Knowledge through the paired-backend contract and must not add a second Machine-routing abstraction.

## Architecture decision record

No new ADR is required: P0-T06 changes no architecture. It verifies the already accepted P0-T01 federation seam and adds regression coverage only.

## Out of scope

- real Fleet topology provisioning;
- changing Machine discovery/authentication;
- new Knowledge transport or retry/fallback behavior;
- P0-T07 restricted Pi runtime;
- persistence, retrieval or model work.

## Result

**PARTIAL — deterministic selected-Machine Knowledge federation coverage is implemented without production routing changes; executable gates and physical two-instance/Fleet acceptance remain OPEN verification debt.**
