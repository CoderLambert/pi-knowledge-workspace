# P0-T05 — Local Integration E2E Report

## Task metadata

- **Task:** P0-T05
- **Phase:** P0 — Integration / security / process boundary
- **Date:** 2026-09-09
- **Branch:** `test/p0-local-knowledge-integration-e2e`
- **Stacked base:** `feat/p0-thin-knowledge-adapter` (PR #6)
- **PR:** #7 — `test: add P0-T05 local Knowledge integration E2E` (draft)
- **Status:** **PARTIAL**
- **P0-T06 implementation mixed into this branch:** no
- **Verification guide:** `docs/development/verification/P0-T05-local-integration-e2e.md`
- **Verification debt ledger:** `docs/development/VERIFICATION-DEBT.md`

## Objective

Prove the local Knowledge integration chain as far as possible with repository-owned executable coverage, while preserving PI WEB's existing browser/server/sessiond seams:

```text
Knowledge Workspace Panel
→ pairedBackend request
→ sessiond paired-plugin HTTP route
→ PluginBackendRegistry
→ host-authoritative Project / Workspace scope
→ Knowledge server-plugin adapter
→ authenticated loopback HTTP
→ standalone pi-knowledge
→ authoritative scope response
→ Knowledge UI
```

The complete real process/browser acceptance remains a developer-machine gate because the autonomous execution environment cannot launch the repository's browser, web/API process and sessiond together.

## Delivered automated cross-layer E2E

Added:

```text
pi-web-plugins/knowledge/local-integration.e2e.test.ts
```

The test intentionally composes existing production boundaries rather than inventing a Knowledge-specific testing transport.

It uses:

- the real Knowledge browser plugin and Lit panel rendering;
- the existing browser-facing `knowledge.status` contract (`null` input);
- the real sessiond `registerPairedPluginBackendRoutes()` HTTP handler through Fastify injection;
- the real `PluginBackendRegistry`;
- the real `WorkspaceProviderRegistry` folder workspace authority;
- the real Knowledge server plugin activation;
- the real P0-T04 service client/adapter;
- a real P0-T03 `buildKnowledgeApp()` listener on an ephemeral IPv4 loopback port;
- the browser panel's normal success/error parsing and rendering path.

This is stronger than a browser mock wired directly to the Knowledge server plugin: sessiond request envelope validation, module revision, project lookup, workspace re-resolution and registry dispatch are part of the automated chain.

## Automated scenarios written

### 1. Successful local chain

The test clicks the actual Knowledge panel integration button and verifies:

- browser request operation is exactly `knowledge.status`;
- browser input is exactly `null`;
- sessiond route accepts the paired request envelope;
- registry resolves host Project/Workspace scope;
- Knowledge adapter calls real `pi-knowledge`;
- the final UI renders `ready`;
- rendered Project, Workspace id, Workspace path and label equal the host-resolved values.

### 2. Service unavailable + restart recovery

The test:

1. starts a real service and binds the adapter to that port;
2. stops the service;
3. runs the panel integration request and expects an explicit backend error rather than a false ready state;
4. confirms the service token does not appear in rendered error text;
5. restarts `pi-knowledge` on the same port;
6. reuses the same browser/sessiond/plugin adapter fixture;
7. confirms the next integration request returns to `ready`.

This checks that the adapter does not cache a permanent unavailable state and does not require browser knowledge of service restart.

### 3. Wrong service token

The test runs real `pi-knowledge` with one token and activates the server plugin with another.

Expected behavior is fail-closed:

- UI renders an explicit backend error;
- `AUTH_INVALID` attribution survives the integration boundary;
- neither the actual nor incorrect token appears in UI text;
- no ready result is accepted.

### 4. Incompatible protocol version

A loopback HTTP fixture returns an otherwise correlated response with protocol version `2`.

The real adapter rejects the response before the UI can render a ready result. This proves the integration does not silently accept version drift.

## Architecture / boundary decisions

1. **Reuse sessiond's existing paired route.** The E2E test calls `registerPairedPluginBackendRoutes()` instead of creating a Knowledge route.
2. **Reuse registry authority resolution.** The test does not pass an arbitrary workspace path directly to the Knowledge adapter.
3. **Use a real service for success/auth/restart cases.** Mocking is limited to the intentionally incompatible protocol fixture.
4. **Keep web/API proxy and physical browser process as deferred acceptance.** Fastify sessiond injection is executable repository coverage, but it is not falsely described as a complete OS-process/browser E2E.
5. **Do not start P0-T06 in this branch.** Machine/Fleet routing remains separate.

## Invariants preserved

- no PI WEB core navigation modification;
- no custom Knowledge browser gateway;
- no custom sessiond Knowledge route;
- no browser knowledge of the `pi-knowledge` token/port;
- no browser-authored authoritative workspace path;
- sessiond re-resolves host workspace authority before server-plugin dispatch;
- wrong token/version/unavailable service do not produce `ready`;
- service restart does not require a new browser-visible endpoint;
- service credentials are not rendered in UI errors;
- no persistence/RAG/model behavior enters P0-T05.

## Verification state

**PARTIAL.** The cross-layer E2E implementation is written but has not been executed in the current automation environment.

Required deferred evidence includes:

```text
P0-T05 focused cross-layer test execution
TypeScript / ESLint / knip / build / package gates
full-suite regression
real browser + web/API process + sessiond process + standalone-service success
real Workspace A → B → A switching
real service unavailable / wrong token / incompatible version / timeout / restart observations
```

The exact procedure is in the verification guide and the debt is recorded in `docs/development/VERIFICATION-DEBT.md`.

## Relationship to P0-T04 debt

P0-T05's real-process acceptance can simultaneously satisfy several P0-T04 real-adapter rows when the evidence explicitly demonstrates:

- server-plugin → service authentication;
- host-authoritative scope round trip;
- wrong-token/unavailable/version failures;
- token remains server-only.

It does not replace P0-T04's focused/static/build checks.

## Assumptions used for continued P0-T06 development

- the P0-T04 adapter contract remains as documented;
- the existing local paired-backend route/registry behavior remains upstream-owned;
- the browser plugin continues using runtime-qualified paired backend identity supplied by PI WEB;
- local success/failure semantics expressed by the new E2E test are representative of the same target-side chain P0-T06 will route to;
- actual Machine/Fleet routing must still be proven separately and must not fall back to gateway-local `pi-knowledge`.

## Out of scope

- selected Machine / remote routing acceptance (P0-T06);
- restricted Pi runtime (P0-T07);
- P0 gate acceptance (P0-T08);
- persistence, parsing, indexing, retrieval or models.

## Result

**PARTIAL — repository-owned cross-layer local integration E2E coverage is implemented, including sessiond HTTP dispatch and real standalone-service success/failure/restart behavior, but actual execution and real browser/process acceptance remain deferred verification debt.**

Under the autonomous-development policy, P0-T06 may proceed on a separate stacked branch without converting P0-T05 to PASS.
