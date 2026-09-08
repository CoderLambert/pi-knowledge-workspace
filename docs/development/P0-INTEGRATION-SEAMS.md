# P0-T01 — Integration Seam Analysis

Status: **PASS**

Repository: `CoderLambert/pi-knowledge-workspace`

Scope: identify the smallest stable integration surface for Knowledge without implementing product behavior.

## Executive conclusion

The current PI WEB codebase already exposes the exact extension seams needed by Knowledge. The Thin Fork should **not** add a second workspace navigation system, a custom browser-to-server transport, or a separate fleet-routing protocol.

The preferred integration is:

```text
Bundled Knowledge browser plugin
  → WorkspacePanelContribution
  → WorkspacePanelContext.pairedBackend.request(...)
  → existing paired-plugin backend transport
  → existing local / selected-machine routing
  → paired Knowledge server plugin
  → authoritative PairedPluginRequestContext
  → future standalone pi-knowledge service
```

This materially reduces the expected fork surface.

---

## 1. Navigation seam

### Chosen seam

- `src/client/src/plugins/types.ts`
  - `WorkspacePanelContribution`
  - `PluginContributions.workspacePanels`
- `src/client/src/plugins/registry.ts`
  - `PluginRegistry.register()`
  - `PluginRegistry.getWorkspacePanels()`
  - `PluginRegistry.qualifyWorkspacePanel()`
- `src/client/src/components/WorkspacePanel.ts`
  - `WorkspacePanel`

### Responsibility

`WorkspacePanel` is already the generic workspace-tool container. Workspace tools are contributed through `workspacePanels`; the registry qualifies, scopes, orders and filters those contributions, and `WorkspacePanel` renders the selected contribution.

An existing first-party example is:

- `pi-web-plugins/workspace-tasks/pi-web-plugin.ts`
  - contributes `workspace.tasks`
  - adds a workspace panel without modifying AppShell

### Decision

Implement Knowledge as another bundled `WorkspacePanelContribution`.

Recommended contribution shape for the next task:

```text
id:    workspace.knowledge
title: Knowledge
order: choose relative to existing workspace tools
```

### Do not use

- `src/client/src/appShell/navigationState.ts`
- `NAVIGATION_SECTION_ORDER`
- `src/client/src/appShell/appShellController.ts`

`navigationState.ts` models the hierarchy:

```text
Machines → Projects → Workspaces → Sessions
```

It is not the workspace tool-tab seam.

`AppShellController` is primarily responsive/PWA shell behavior and is also not the Knowledge integration point.

### Expected core changes

**0** for navigation if Knowledge is implemented as a bundled plugin.

---

## 2. Workspace context seam

### Canonical client state

- `src/client/src/appState.ts`
  - `AppState.selectedMachine`
  - `AppState.selectedProject`
  - `AppState.selectedWorkspace`
  - `AppState.workspaceTool`
  - `AppState.mainView`

### Chosen Knowledge seam

- `src/client/src/plugins/types.ts`
  - `WorkspaceContext`
  - `WorkspacePanelContext`
- `src/client/src/components/PiWebApp.ts`
  - `createWorkspacePanelContext()`
  - `visibleWorkspacePanels()`
  - `renderWorkspacePanel()`

`createWorkspacePanelContext()` binds a panel to the host-selected:

```text
machine
workspace
state
files
backend / pairedBackend
host capabilities
```

### Decision

Knowledge browser code must consume the supplied `WorkspacePanelContext`.

Do not create a second store containing:

```text
knowledgeSelectedMachine
knowledgeSelectedProject
knowledgeSelectedWorkspace
```

That would duplicate host state and create synchronization bugs.

### Trust boundary

Browser context is sufficient for UI behavior, but **not authoritative for privileged filesystem scope**.

The authoritative project/workspace scope is resolved again in sessiond before a paired server-plugin callback executes.

---

## 3. Client request seam

### Chosen seam

- `src/client/src/plugins/workspaceBackend.ts`
  - `createPairedPluginWorkspaceBackend()`
  - `pluginBackendTarget()`
- `src/client/src/api/pluginBackends.ts`
  - `requestPairedPluginBackend()`
  - `scopedPluginBackendRequestPath()`

### Request API

Knowledge browser code should call:

```ts
context.pairedBackend?.request(operation, input, options)
```

`createPairedPluginWorkspaceBackend()` binds the request target to:

```text
pluginId
backendRevision
machineId
workspace.projectId
workspace.id
```

### Decision

The browser must **not**:

- know the `pi-knowledge` port
- know a local service token
- construct `localhost` URLs
- submit a filesystem path as an authoritative scope
- construct PI WEB machine/federation URLs manually

### Why pairedBackend instead of backend

Knowledge is not the workspace owner/provider. It is an independently paired browser/server feature package.

Therefore use `pairedBackend`, not the legacy/owner-backed `backend` path.

---

## 4. Local server route seam

### Browser-facing HTTP edge

- `src/server/app.ts`
  - `buildApp()`
  - registers local paired plugin proxy routes
  - registers remote machine proxy routes

### Local paired backend proxy

- `src/server/plugins/pluginBackendProxyRoutes.ts`
  - `registerPairedPluginBackendProxyRoutes()`

The web/API process accepts the browser request and forwards it to sessiond. It does not own Knowledge workspace authority.

### Sessiond route

- `src/server/sessiond/pluginBackendRoutes.ts`
  - `registerPairedPluginBackendRoutes()`
  - common bounded request handling

This layer validates:

```text
plugin id
operation
project id
workspace id
revision envelope
```

It resolves the project before dispatch and propagates request cancellation.

### Decision

Do **not** add `/api/knowledge/*` routes to `src/server/app.ts` for V1.

The existing paired backend route is the correct boundary.

---

## 5. Authoritative server-plugin scope seam

### Chosen seam

- `src/server/plugins/pluginBackendRegistry.ts`
  - `PluginBackendRegistry.request()`
  - internal dispatch path
  - authoritative workspace resolution
- `server-plugin-api.ts`
  - `PairedPluginRequestContext`

Before the paired plugin receives a request, PI WEB re-resolves the current workspace and constructs a frozen context containing:

```text
project
workspace
operation
input
signal
```

The resolved `workspace` contains the host-authoritative workspace path.

### Existing reference implementation

- `pi-web-plugins/terminal/server/server-plugin.ts`
  - `createTerminalBackend()`
  - `terminalRequest()`
  - `terminalScope()`

Terminal derives its privileged scope from:

```text
context.project.id
context.workspace.id
context.workspace.path
```

rather than trusting caller-supplied cwd/path.

### Decision

Knowledge server plugin should use the same rule:

```text
browser input = operation-specific data only
host context  = machine-local project/workspace authority
```

The future thin adapter should derive Knowledge scope from `PairedPluginRequestContext.project/workspace` and forward that bound scope to `pi-knowledge`.

---

## 6. Machine / Fleet routing seam

### Browser routing

- `src/client/src/api/pluginBackends.ts`
  - `scopedPluginBackendRequestPath()`

Behavior:

```text
machineId === local
  → /api/paired-plugin-backends/...

machineId !== local
  → /api/machines/:machineId/paired-plugin-backends/...
```

### Gateway routing

- `src/server/machines/machineProxyRoutes.ts`
  - `registerMachineProxyRoutes()`

The gateway proxies supported machine-scoped routes to the selected remote PI WEB instance.

### Federation allowlist

- `src/shared/federatedRoutes.ts`
  - `FEDERATED_HTTP_ROUTES`
  - `FEDERATED_WEBSOCKET_ROUTES`

Paired plugin backend request/channel routes are already federated, bounded and cancellation-aware.

### Decision

Knowledge must reuse this path.

Do not add:

```text
KnowledgeMachineRouter
/api/machines/:id/knowledge/*
custom fleet RPC
browser → remote localhost knowledge service
```

### Resulting remote flow

```text
Knowledge browser panel
  ↓
context.pairedBackend.request()
  ↓
Gateway /api/machines/:machineId/paired-plugin-backends/...
  ↓
registerMachineProxyRoutes()
  ↓
Target PI WEB /api/paired-plugin-backends/...
  ↓
Target sessiond
  ↓
Target Knowledge paired server plugin
  ↓
Target-machine pi-knowledge service
```

This naturally satisfies the rule that Knowledge belongs to the selected Machine.

---

## 7. Bundled plugin packaging seam

### Existing bundled plugin root

- `pi-web-plugins/`

Existing examples include:

```text
files
git
info
terminal
updates
workspace-tasks
```

### Discovery

- `src/server/piWebPluginCatalog.ts`
  - `defaultPluginRoots()`
  - bundled root resolves to `dist/pi-web-plugins`
  - bundled packages are discovered by directory scan
  - package metadata uses `piWeb.plugins`

### Build

- `scripts/build-plugins.mjs`

The build already recursively handles normal bundled plugin packages. Files and Terminal have special browser-bundle handling, but ordinary plugins are transpiled by the generic directory build.

### Best reference for Knowledge

Use the normal `git` plugin package structure rather than special-casing the build:

```text
pi-web-plugins/knowledge/
├── package.json
├── browser/
│   └── pi-web-plugin.ts
├── server-plugin.ts
└── ...tests / local modules
```

Recommended metadata shape:

```json
{
  "name": "@pi-web/knowledge-plugin",
  "private": true,
  "type": "module",
  "piWeb": {
    "plugins": [
      {
        "id": "knowledge",
        "browserRoot": "browser",
        "module": "browser/pi-web-plugin.js",
        "serverModule": "server-plugin.js",
        "machineSpecific": true
      }
    ]
  }
}
```

### Expected core changes

For a normal bundled plugin, **no manual `PiWebApp` registration should be required**. The catalog/build/discovery machinery already exists.

---

## 8. Runtime entry seam

### Browser

- `src/client/src/main.ts`
  - imports `PiWebApp`

No Knowledge-specific change required.

### Web/API process

- `src/server/index.ts`
  - calls `buildApp()`
  - listens on configured host/port, default `127.0.0.1:8504`

### Session daemon

- `src/server/sessiond.ts`
  - owns session runtime
  - activates server plugins
  - constructs `PluginBackendRegistry`
  - registers paired plugin backend routes

### CLI / process management

- `src/cli.ts`
- root `package.json`

Current production process model exposes:

```text
pi-web-server
pi-web-sessiond
```

Development scripts run:

```text
dev:sessiond
dev:web
dev:client
```

### Future Knowledge runtime

The architecture still calls for a standalone `pi-knowledge` process because parsing, embedding, indexing and course generation must not run as heavy work inside sessiond.

The paired Knowledge server plugin should therefore remain a **thin in-process adapter**:

```text
validate operation
bind authoritative workspace scope
forward to local pi-knowledge
propagate timeout/cancellation
validate bounded response
```

It must not become the Knowledge engine.

---

## 9. Confirmed end-to-end request chain

### Local machine

```text
WorkspacePanelContribution: Knowledge
  ↓
WorkspacePanelContext
  ↓
pairedBackend.request()
  ↓
requestPairedPluginBackend()
  ↓
POST /api/paired-plugin-backends/:pluginId/projects/:projectId/workspaces/:workspaceId/:operation
  ↓
registerPairedPluginBackendProxyRoutes()
  ↓
sessiond
  ↓
registerPairedPluginBackendRoutes()
  ↓
PluginBackendRegistry
  ↓
authoritative project/workspace resolution
  ↓
Knowledge server plugin PairedPluginRequestContext
  ↓
future local pi-knowledge service
```

### Remote selected machine

```text
WorkspacePanelContribution: Knowledge
  ↓
pairedBackend.request()
  ↓
POST /api/machines/:machineId/paired-plugin-backends/...
  ↓
Gateway registerMachineProxyRoutes()
  ↓
Target PI WEB
  ↓
Target paired backend route
  ↓
Target sessiond
  ↓
Target Knowledge server plugin
  ↓
Target pi-knowledge service
```

No new fleet protocol is required.

---

## 10. Files that should NOT be modified for initial Knowledge integration

Unless a later verified requirement proves the public plugin seam insufficient, avoid changes to:

```text
src/client/src/appShell/navigationState.ts
src/client/src/appShell/appShellController.ts
src/client/src/components/PiWebApp.ts
src/client/src/appState.ts
src/client/src/api/pluginBackends.ts
src/client/src/plugins/workspaceBackend.ts
src/server/app.ts
src/server/plugins/pluginBackendProxyRoutes.ts
src/server/sessiond/pluginBackendRoutes.ts
src/server/plugins/pluginBackendRegistry.ts
src/server/machines/machineProxyRoutes.ts
src/shared/federatedRoutes.ts
src/server/piWebPluginCatalog.ts
```

These are upstream infrastructure seams to reuse, not Fork customization points.

---

## 11. Expected modification surface for P0-T02

The next implementation should start with only a new bundled plugin package.

Expected new files:

```text
pi-web-plugins/knowledge/
├── package.json
├── browser/
│   ├── pi-web-plugin.ts
│   └── knowledge-panel.ts
├── server-plugin.ts
├── contract.ts
├── pi-web-plugin.test.ts
└── server-plugin.test.ts
```

Initial behavior should be deliberately small:

```text
Knowledge workspace tab
  → pairedBackend.request("knowledge.capabilities", null)
  → server plugin receives authoritative workspace context
  → returns bounded diagnostic payload
  → UI displays machine/workspace/service state
```

Do not add the standalone Knowledge Service until this host integration skeleton is proven.

### Estimated upstream-core files changed

```text
0 expected
```

### Estimated Knowledge-owned files added

```text
5–8 for the initial skeleton/tests
```

---

## 12. Correction to the original P0 plan

Original assumption:

```text
P0-T02 Knowledge Feature Shell under src/features/knowledge
P0-T03 modify Workspace top-level navigation
P0-T07 create first-party custom Knowledge gateway
P0-T10/P0-T11 add or adapt target routing
```

Recommended correction after source review:

```text
P0-T02 Knowledge bundled paired-plugin skeleton
  - WorkspacePanelContribution
  - paired server backend
  - capabilities/echo probe

P0-T03 standalone pi-knowledge service contract + skeleton

P0-T04 thin server-plugin → pi-knowledge adapter

P0-T05 local E2E

P0-T06 remote selected-machine E2E
```

Reason:

PI WEB already provides the navigation contribution point, workspace scoping, browser/server paired transport, revision pairing, bounded JSON, cancellation, authoritative workspace resolution and fleet routing.

Reimplementing any of these would increase fork cost without adding product value.

---

## 13. P0-T01 acceptance matrix

| Required seam | Result | Chosen boundary |
|---|---|---|
| Workspace navigation | PASS | `WorkspacePanelContribution` |
| Workspace context | PASS | `WorkspacePanelContext` |
| Selected Machine | PASS | host-scoped `context.machine` / paired target |
| Selected Project | PASS | `AppState` for UI; authoritative server `context.project` |
| Selected Workspace | PASS | host-scoped panel context; authoritative server `context.workspace` |
| Client request | PASS | `pairedBackend.request()` |
| Local server route | PASS | paired plugin backend proxy → sessiond |
| Server authority | PASS | `PluginBackendRegistry` + `PairedPluginRequestContext` |
| Fleet routing | PASS | existing machine proxy + federated paired routes |
| Runtime entry | PASS | `src/server/index.ts`, `src/server/sessiond.ts`, `src/cli.ts` |
| Thin Fork viability | PASS | initial core changes expected: 0 |

---

## Final decision

**P0-T01 passes. Thin Fork remains viable and is simpler than originally planned.**

The key implementation rule for all following work is:

```text
Knowledge owns product behavior.
PI WEB owns shell, workspace authority and machine routing.
```

The next coding task should be **P0-T02 — Knowledge bundled paired-plugin skeleton**, not a direct AppShell/navigation modification.
