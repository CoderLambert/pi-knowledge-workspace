# P0-T02 — Knowledge Paired Plugin Skeleton Report

## Task metadata

- **Task:** P0-T02
- **Phase:** P0a — Thin Fork integration spike
- **Date:** 2026-09-08
- **Branch:** `feat/p0-knowledge-plugin-skeleton`
- **PR:** #3 — `feat: add P0 Knowledge paired-plugin skeleton`
- **Status:** **PARTIAL**
- **Reason for PARTIAL:** implementation and test coverage are present, but repository CI has not yet executed for the PR head.
- **PI WEB core files changed:** 0

## Objective

Implement the first runnable Knowledge product surface using only the public integration seams proven in P0-T01.

The task had to prove the following path without introducing the standalone Knowledge service yet:

```text
Knowledge Workspace Panel
→ context.pairedBackend.request()
→ PI WEB machine/federation transport
→ host-authoritative PairedPluginRequestContext
→ Knowledge paired server plugin
```

The task also had to preserve the architectural rule that heavy Knowledge work does not move into sessiond.

## Scope

### Included

- bundled `knowledge` PI WEB plugin package;
- first-party Knowledge Workspace panel;
- action for opening the Knowledge workspace tool;
- paired browser/server plugin wiring;
- `knowledge.status` integration-check operation;
- host-authoritative Project/Workspace scope projection;
- explicit capability-unavailable diagnostics;
- browser bridge tests;
- server scope/trust-boundary tests;
- public PI WEB plugin API compatibility review.

### Excluded

- standalone `pi-knowledge` process;
- IPC/HTTP contract to that service;
- SQLite;
- source ingestion/parsing;
- FTS/vector retrieval;
- embeddings;
- reranking;
- Pi restricted Ask runtime;
- citations/course generation;
- production service lifecycle/restart behavior.

These items remain intentionally deferred to later P0/P1 tasks.

## Changes

### 1. Added bundled Knowledge plugin manifest

Path:

- `pi-web-plugins/knowledge/package.json`

The package declares a bundled plugin with:

```text
id: knowledge
browser module: browser/pi-web-plugin.js
server module: server-plugin.js
machineSpecific: true
```

This keeps the Knowledge browser and server revision paired on the selected machine and avoids creating an unrelated host routing mechanism.

### 2. Added Knowledge Workspace panel

Path:

- `pi-web-plugins/knowledge/browser/pi-web-plugin.ts`

The plugin contributes:

- Workspace panel id: `workspace.knowledge`;
- title: `Knowledge`;
- order: `35`;
- route alias: `knowledge`;
- `view.knowledge` action;
- runtime-qualified navigation using `runtimePluginId`.

No AppShell/navigation core code is patched.

### 3. Added paired backend integration check

The browser invokes:

```ts
context.pairedBackend.request("knowledge.status", null)
```

The browser never supplies authoritative Project/Workspace identity to the operation.

The response is validated before rendering and displays:

- status;
- selected Machine;
- host Project id;
- host Workspace id/label;
- host Workspace path.

### 4. Added explicit backend-unavailable state

The Knowledge panel remains visible even if the paired request capability is unavailable.

This was an intentional diagnostic decision: hiding the entire panel would make plugin/service/fleet failures harder to distinguish from missing product registration.

When the request capability is missing, the panel records and renders an explicit error rather than silently disappearing.

### 5. Added paired Knowledge server plugin

Path:

- `pi-web-plugins/knowledge/server-plugin.ts`

The server entry:

- implements public Server Plugin API v1;
- activates only under plugin id `knowledge`;
- exposes paired request capability v1;
- implements `knowledge.status`;
- reports healthy plugin lifecycle status;
- rejects unsupported operations;
- rejects non-empty browser-authored input for `knowledge.status`;
- validates that host Workspace project scope matches the host Project id;
- returns scope only from `PairedPluginRequestContext.project/workspace`.

The server plugin performs no parsing/indexing/model/database work.

## Files changed

Primary task files:

| Path | Responsibility |
|---|---|
| `pi-web-plugins/knowledge/package.json` | Bundled browser/server plugin declaration. |
| `pi-web-plugins/knowledge/browser/pi-web-plugin.ts` | Knowledge Workspace UI and paired request initiation. |
| `pi-web-plugins/knowledge/server-plugin.ts` | Thin paired backend and authoritative scope projection. |
| `pi-web-plugins/knowledge/pi-web-plugin.test.ts` | Browser contribution/navigation/bridge tests. |
| `pi-web-plugins/knowledge/server-plugin.test.ts` | Server trust-boundary and operation tests. |

Documentation added after implementation:

| Path | Responsibility |
|---|---|
| `docs/development/REPORTING.md` | Mandatory task reporting standard. |
| `docs/development/reports/README.md` | Chronological report index. |
| `docs/development/reports/P0-T01-integration-seams.md` | Historical P0-T01 execution report. |
| `docs/development/reports/P0-T02-knowledge-plugin-skeleton.md` | This report. |

## Architecture decisions

### 1. No PI WEB core navigation patch

**Decision:** continue using the existing Workspace plugin contribution model.

**Result:** P0-T02 modifies no PI WEB core file.

This confirms the P0-T01 prediction that Knowledge can be introduced without a second navigation system.

### 2. Use paired backend, not workspace-owner backend

**Decision:** use `WorkspacePanelContext.pairedBackend`.

**Reason:** Knowledge is a paired product feature, not the provider that owns the Workspace.

### 3. Runtime-qualified plugin identity

**Decision:** navigation uses `runtimePluginId` when constructing the qualified Workspace tool id.

**Reason:** federated/remote machines may expose machine-qualified runtime identities; hard-coding `knowledge:workspace.knowledge` would be incorrect for those cases.

### 4. Host scope is authoritative

**Decision:** the server derives Project/Workspace scope only from `PairedPluginRequestContext`.

Browser-authored scope fields are deliberately rejected for the status operation.

### 5. Keep server plugin thin

**Decision:** the paired server plugin currently returns only bounded integration metadata.

**Reason:** PI WEB server plugin code executes inside sessiond. Heavy parsing, embeddings, retrieval and course/model work belong in a standalone service introduced in P0-T03.

### 6. Keep failure surface observable

**Decision:** Knowledge remains visible when its paired backend capability is missing.

**Reason:** a visible diagnostic state is operationally safer than silently removing the product surface.

## Security and correctness invariants

The implementation enforces or preserves these rules:

1. Browser JSON cannot choose authoritative Project/Workspace scope.
2. `knowledge.status` accepts only `null` or an empty object as request input.
3. Scope returned to the browser is derived from host-owned `project` and `workspace` context.
4. Workspace `projectId` must match host Project `id`.
5. Unsupported Knowledge operations fail explicitly.
6. Browser code does not construct Knowledge service URLs, machine proxy URLs, or filesystem authority.
7. Browser navigation uses runtime plugin identity, preserving machine/federation correctness.
8. Heavy Knowledge processing is still absent from sessiond.

## Test coverage added

### Browser tests

`pi-web-plugins/knowledge/pi-web-plugin.test.ts` covers:

- Knowledge Workspace panel contribution;
- panel id/title/order/route alias;
- runtime plugin identity when opening the Workspace tool;
- actual `pairedBackend.request("knowledge.status", null)` invocation;
- rendering host-scope values returned through the bridge;
- paired backend unavailable diagnostic behavior.

### Server tests

`pi-web-plugins/knowledge/server-plugin.test.ts` covers the paired backend contract, including:

- returning host-resolved Project/Workspace scope;
- rejecting browser-authored/spoofed scope input;
- rejecting inconsistent host Project/Workspace scope;
- rejecting unsupported operations.

## Verification and evidence

### Performed successfully

- Source-level review of the public PI WEB Browser Plugin API used by the implementation.
- Source-level review of the public PI WEB Server Plugin API used by the implementation.
- Confirmed `WorkspacePanelContext.pairedBackend`, `host.requestRender()`, runtime plugin identity and paired server request context are public seams.
- Reviewed the PR diff to confirm the task changes only the new Knowledge plugin and its tests before reporting documents were added.
- Confirmed no PI WEB core navigation/server-route patch was required.
- Added browser and server automated regression tests.
- PR #3 created and remains the implementation review surface.

### Not executed / not yet proven

The repository CI has not produced a workflow/check run for the current PR head.

The configured CI normally executes:

```text
npm ci
→ npm run verify
→ npm run build
→ package smoke/dry-pack checks
```

However, no PR workflow run was available for the P0-T02 head during this task.

A separate local-container verification attempt could not install dependencies because that execution environment could not resolve/access GitHub. This is an environment limitation, not evidence that the code passes or fails.

Therefore this report deliberately does **not** claim:

- TypeScript build PASS;
- Vitest PASS;
- lint PASS;
- knip PASS;
- package smoke PASS;
- Linux/Windows CI PASS.

Those gates remain outstanding.

## Known limitations / unresolved items

### 1. CI execution pending

This is the only reason P0-T02 is currently `PARTIAL` instead of `PASS`.

### 2. No standalone service yet

`knowledge.status` currently terminates in the paired server plugin. P0-T03 must introduce the independent process/service boundary.

### 3. No service-down semantics yet

Because there is no external service, P0-T02 cannot yet verify:

- service unavailable;
- service restart;
- IPC timeout;
- process version mismatch.

### 4. No real target-offline/fleet failure proof yet

The implementation is designed to reuse PI WEB federation, but P0c still owns explicit failure/routing validation.

### 5. No persistence or knowledge behavior

The panel is an integration skeleton only. It does not represent Source, Evidence, retrieval or Ask functionality.

## Result

**PARTIAL — implementation complete, CI pending**

The architecture objective of P0-T02 has been achieved:

```text
Knowledge Workspace surface
+ public paired browser/server seam
+ authoritative host scope
+ zero PI WEB core modifications
```

The task must not be promoted to `PASS` until the repository's required verification commands/CI are successfully executed.

## Impact on the plan

P0-T02 confirms the thin-fork direction and removes the need for:

- custom Knowledge browser/server gateway routes;
- a second Fleet protocol;
- duplicated Project/Workspace selection state;
- AppShell Knowledge patches.

The next architectural boundary is now concrete:

```text
PI WEB Browser Plugin
→ PI WEB paired transport
→ Knowledge Server Plugin (thin adapter)
→ standalone pi-knowledge service
```

## Next task

**P0-T03 — Standalone `pi-knowledge` service contract + process skeleton**

P0-T03 should introduce only the minimum external-process boundary required to prove:

```text
Knowledge server plugin
→ bounded local IPC/HTTP contract
→ standalone pi-knowledge process
→ health/version/scope request
```

It should still avoid database, RAG, embeddings or production ingestion logic unless required to prove the service boundary.

P0-T03 must also produce its own repository report before being marked complete.
