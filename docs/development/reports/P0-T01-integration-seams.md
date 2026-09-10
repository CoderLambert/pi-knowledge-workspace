# P0-T01 — Integration Seam Analysis Report

## Task metadata

- **Task:** P0-T01
- **Phase:** P0a — Thin Fork integration spike
- **Date:** 2026-09-08
- **Branch:** `chore/p0-integration-seam-analysis`
- **PR:** #2 — `docs: define P0 Knowledge integration seams`
- **Status:** **PASS**
- **Runtime behavior changed:** No

## Objective

Identify the smallest stable PI WEB integration surface required for the Knowledge product without prematurely modifying PI WEB core navigation, inventing a second browser/server protocol, or duplicating Fleet routing.

The task was investigative by design. Its job was to determine where P0-T02 should integrate, not to implement the Knowledge runtime itself.

## Scope

### Included

- Workspace navigation/tool contribution seam.
- Browser Workspace context seam.
- Browser-to-server plugin request seam.
- Local sessiond routing seam.
- Selected-machine / Fleet routing seam.
- Authoritative Project/Workspace identity boundary.
- Runtime/process boundary relevant to the future `pi-knowledge` service.
- Expected PI WEB core modification surface.

### Excluded

- Knowledge UI implementation.
- `pi-knowledge` process implementation.
- database/schema work.
- ingestion/parsing.
- FTS/vector retrieval.
- Pi restricted Ask runtime.
- production service lifecycle.

## Changes

The task added the detailed integration analysis:

- `docs/development/P0-INTEGRATION-SEAMS.md`

The analysis verified that the existing PI WEB plugin system already exposes the required seams for a first-party Knowledge surface.

The preferred path was fixed as:

```text
Bundled Knowledge browser plugin
  → WorkspacePanelContribution
  → WorkspacePanelContext.pairedBackend.request(...)
  → existing paired-plugin transport
  → existing local / selected-machine routing
  → paired Knowledge server plugin
  → authoritative PairedPluginRequestContext
  → future standalone pi-knowledge service
```

## Files and subsystems inspected

The analysis mapped the following PI WEB areas.

### Browser navigation and panel contribution

- `src/client/src/plugins/types.ts`
  - `WorkspacePanelContribution`
  - `WorkspacePanelContext`
- `src/client/src/plugins/registry.ts`
- `src/client/src/components/WorkspacePanel.ts`
- existing bundled plugin examples such as `pi-web-plugins/workspace-tasks/`

### Browser Workspace context

- `src/client/src/appState.ts`
- `src/client/src/components/PiWebApp.ts`
  - host-created Workspace panel context

### Browser request transport

- `src/client/src/plugins/workspaceBackend.ts`
- `src/client/src/api/pluginBackends.ts`
- `WorkspacePanelContext.pairedBackend`

### Server/sessiond routing

- `src/server/plugins/pluginBackendProxyRoutes.ts`
- `src/server/sessiond/pluginBackendRoutes.ts`
- public server plugin API and paired backend request context

### Fleet / selected-machine routing

The existing PI WEB machine/federation request path was inspected to determine whether Knowledge needed its own remote transport. The conclusion was no: Knowledge should ride the existing machine-aware paired-plugin transport.

## Architecture decisions

### 1. Knowledge will be a bundled Workspace plugin

**Decision:** use `WorkspacePanelContribution` rather than modifying AppShell or creating a new global navigation subsystem.

**Reason:** Workspace tools are already the public extensibility seam for this class of UI.

**Rejected:** direct modification of `navigationState.ts`, `AppShellController`, or a second Knowledge-only navigation model.

### 2. Knowledge will consume host Workspace context

**Decision:** use the host-supplied `WorkspacePanelContext`.

**Reason:** PI WEB already owns Machine/Project/Workspace selection. Duplicating this state would create synchronization and routing errors.

**Rejected:** Knowledge-specific selected-machine / selected-project / selected-workspace stores.

### 3. Browser requests will use `pairedBackend`

**Decision:** Knowledge browser code calls `context.pairedBackend.request(...)`.

**Reason:** Knowledge is a paired feature package, not the owner/provider of the Workspace.

**Rejected:** browser-constructed localhost URLs, custom `/knowledge/*` gateway routes, or direct access to the future service port/token.

### 4. PI WEB remains routing authority

**Decision:** browser-supplied Project/Workspace values are not trusted for privileged scope.

The authoritative scope is reconstructed by PI WEB before the paired server plugin callback receives the request.

### 5. No custom Fleet protocol

**Decision:** reuse PI WEB's selected-machine routing and federation path.

**Reason:** implementing an additional Knowledge-specific remote protocol would duplicate mature host behavior and materially increase fork maintenance cost.

### 6. Future heavy Knowledge work stays outside sessiond

The paired server plugin should eventually be a thin adapter to a standalone `pi-knowledge` process. Parsing, indexing, embeddings, retrieval and generation should not execute as heavy in-process sessiond work.

## Security and correctness invariants established

P0-T01 established these invariants for all later Knowledge tasks:

1. Browser Project/Workspace identity is not authoritative.
2. Browser code must not construct Machine/Fleet backend URLs.
3. Browser code must not know the local Knowledge service port/token.
4. Knowledge must operate on the PI WEB selected Machine, not silently fall back to gateway-local state.
5. Knowledge integration should not change Git/Terminal/Session ownership semantics.
6. PI WEB core should remain unchanged unless a public plugin seam is proven insufficient.

## Verification and evidence

### Performed

- Static source inspection of PI WEB plugin APIs, Workspace panel lifecycle, paired backend transport, sessiond routes, and machine routing.
- Cross-check against existing bundled PI WEB plugins.
- Detailed integration seam document committed to the repository.
- PR #2 created with no runtime behavior changes.

### Result

The investigation found a complete public integration path for P0-T02. No blocker requiring invasive core modifications was identified.

## Known limitations / unresolved items

P0-T01 intentionally did **not** prove runtime execution of the complete chain. Those validations were deferred to P0-T02 and later P0 tasks:

- actual Knowledge Workspace panel rendering;
- actual browser `pairedBackend.request()` invocation;
- actual paired server callback;
- service-down behavior;
- target-offline behavior;
- standalone `pi-knowledge` process lifecycle;
- cancellation and version/capability mismatch behavior.

These are not failures of P0-T01 because they were outside its investigation scope.

## Result

**PASS**

P0-T01 successfully reduced the integration design to existing PI WEB public seams and removed several unnecessary implementation ideas from the plan.

The most important outcome is that Knowledge can remain a thin product layer over PI WEB rather than becoming a broad core fork.

## Impact on the plan

P0-T02 was corrected from a possible first-party core navigation patch to a **bundled paired Knowledge plugin skeleton**.

The expected initial core change count for Knowledge navigation became:

```text
0
```

The future standalone service boundary remained intact.

## Next task

**P0-T02 — Knowledge bundled paired-plugin skeleton**

Required proof:

```text
Knowledge Workspace Panel
→ pairedBackend.request()
→ PI WEB host routing
→ authoritative PairedPluginRequestContext
→ Knowledge paired server plugin
```

No database, RAG, ingestion or heavy Knowledge processing should be introduced yet.
