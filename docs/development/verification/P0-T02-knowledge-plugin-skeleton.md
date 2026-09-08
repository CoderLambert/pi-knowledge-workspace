# P0-T02 — Knowledge Paired Plugin Skeleton Verification Guide

## What this verifies

This guide verifies the first runnable Knowledge integration slice introduced by P0-T02:

```text
Knowledge Workspace Panel
→ pairedBackend.request("knowledge.status", null)
→ PI WEB paired backend transport
→ Knowledge server plugin
→ host-authoritative Project / Workspace scope
→ browser rendering
```

It also verifies that the implementation remains a thin integration layer and does not require PI WEB core navigation changes.

This guide does **not** verify the standalone `pi-knowledge` service, SQLite, retrieval, Ask, Notes, or Course. Those are later tasks.

## Prerequisites

- Linux/macOS/Windows development environment supported by PI WEB.
- Node.js `>=22.19.0`.
- npm.
- Pi Coding Agent configured for the current user if your PI WEB development setup requires it.
- A local folder or Git repository that can be added as a PI WEB Project.

Confirm Node:

```bash
node --version
```

Expected:

```text
v22.19.0 or newer
```

## Checkout and setup

From an existing checkout:

```bash
git fetch origin
git switch feat/p0-knowledge-plugin-skeleton
npm install
```

Or clone fresh:

```bash
git clone https://github.com/CoderLambert/pi-knowledge-workspace.git
cd pi-knowledge-workspace
git switch feat/p0-knowledge-plugin-skeleton
npm install
```

## Automated verification

### 1. Run focused Knowledge tests

```bash
npm test -- \
  pi-web-plugins/knowledge/pi-web-plugin.test.ts \
  pi-web-plugins/knowledge/server-plugin.test.ts
```

Expected:

- both Knowledge test files execute;
- all Knowledge tests pass;
- no unhandled error is printed.

These tests cover:

- Knowledge Workspace Panel contribution;
- runtime-qualified workspace-tool navigation;
- browser call to `pairedBackend.request("knowledge.status", null)`;
- rendering returned Project/Workspace scope;
- missing paired-backend diagnostic behavior;
- host-authoritative scope returned by the server plugin;
- spoofed browser scope rejection;
- inconsistent Project/Workspace scope rejection;
- unsupported operation rejection.

### 2. Run repository verification

```bash
npm run verify
```

Expected:

```text
typecheck PASS
lint PASS
knip PASS
vitest PASS
```

Any non-zero exit code means this gate failed.

### 3. Build the application and bundled plugins

```bash
npm run build
```

Expected:

- TypeScript build succeeds;
- bundled plugin build succeeds;
- Vite build succeeds;
- no missing `knowledge` plugin module error appears.

## Start the feature

Run the full development stack:

```bash
npm run dev
```

This starts the session daemon, web/API process, bundled-plugin watcher/build, and Vite client.

Open the Vite development URL, normally:

```text
http://localhost:8505
```

If another port is shown in the Vite output, use that exact URL instead.

## Manual verification

### Case 1 — Knowledge panel is available for a Workspace

1. Open the PI WEB development UI.
2. Add or select a Project.
3. Select one Workspace under that Project.
4. Find the `Knowledge` workspace tool/tab next to the existing workspace tools.
5. Open `Knowledge`.

Expected:

- the Knowledge panel renders;
- the page does not crash;
- existing Files/Terminal/Git/Chat behavior remains usable;
- no separate duplicated Machine/Project/Workspace selector appears inside Knowledge.

If the Knowledge panel does not appear:

1. Open **Settings → PI WEB plugins**.
2. Confirm the bundled `knowledge` plugin is discovered/enabled for the selected machine.
3. Because Knowledge has a server entry, restart the development stack/session daemon if enablement changed.
4. Reload the browser page.

### Case 2 — Browser → paired backend → server plugin path works

1. Open the Knowledge panel for a selected Workspace.
2. Click **Check integration**.
3. Wait for the request to complete.

Expected UI values:

```text
Status: ready
Machine: <current selected machine>
Project: <current project id>
Workspace: <current workspace label/id>
Path: <current workspace filesystem path>
```

Expected behavior:

- `Status` becomes `ready`;
- no browser-authored path entry is required;
- the displayed Workspace corresponds to the Workspace selected in PI WEB;
- the displayed filesystem path corresponds to the host-resolved Workspace path.

### Case 3 — Workspace switching updates scope

Use two Workspaces if possible. For example:

```text
main checkout
feature worktree
```

Steps:

1. Open Workspace A.
2. Open Knowledge.
3. Click **Check integration**.
4. Record Project / Workspace / Path.
5. Switch to Workspace B.
6. Open Knowledge again.
7. Click **Check integration**.

Expected:

- Workspace B returns its own Workspace id/label/path;
- Workspace A's path is not reused;
- no `knowledgeSelectedWorkspace`-style duplicated state is visible or required;
- switching back to A returns A's scope again.

### Case 4 — Git worktree scope

If the Project is a Git repository with a worktree:

1. Select a non-main worktree Workspace.
2. Open Knowledge.
3. Click **Check integration**.

Expected:

- the returned `Path` is the selected worktree path;
- it is not automatically replaced with the repository main checkout path;
- Project and Workspace ids remain internally consistent.

## Negative / failure verification

### Case 5 — Automated spoofed-scope rejection

The current UI deliberately sends `null` for `knowledge.status`, so the browser does not provide a manual field for forging a filesystem scope.

Verify this security invariant through the server test:

```bash
npm test -- pi-web-plugins/knowledge/server-plugin.test.ts
```

Expected:

- the test that supplies browser-authored scope fields passes only because the server rejects that input;
- the server derives returned scope exclusively from host `PairedPluginRequestContext.project/workspace`.

### Case 6 — Unsupported operation rejection

Run:

```bash
npm test -- pi-web-plugins/knowledge/server-plugin.test.ts
```

Expected:

- unsupported Knowledge operations are rejected explicitly;
- there is no generic `proxy(anyOperation)` behavior.

### Case 7 — Paired-backend unavailable diagnostic

Run:

```bash
npm test -- pi-web-plugins/knowledge/pi-web-plugin.test.ts
```

Expected:

- the test constructing a Workspace context without the paired request capability renders an explicit backend-unavailable error state;
- the browser code does not fall back to a handcrafted localhost URL or legacy owner backend.

Note: depending on the host plugin lifecycle, a real server-backed browser module may not be published when its paired backend is unhealthy. For that reason, this specific missing-capability state is currently a deterministic automated verification case rather than a guaranteed reproducible manual host scenario.

## PASS checklist

P0-T02 can be manually accepted when all applicable items below pass:

- [ ] `node --version` is `>=22.19.0`.
- [ ] Focused Knowledge tests pass.
- [ ] `npm run verify` passes.
- [ ] `npm run build` passes.
- [ ] `npm run dev` starts successfully.
- [ ] Knowledge is visible for a selected Workspace.
- [ ] **Check integration** returns `Status: ready`.
- [ ] Project / Workspace / Path match the selected Workspace.
- [ ] Switching Workspace changes the returned scope correctly.
- [ ] Git worktree scope resolves to the selected worktree path when tested.
- [ ] Existing workspace tools still work.
- [ ] Spoofed-scope server test passes.
- [ ] Unsupported-operation server test passes.

## FAIL criteria

Treat P0-T02 as failed if any of these occur:

- Knowledge requires editing PI WEB core navigation to become usable;
- Knowledge opens against a different Workspace than the one selected;
- the browser must send or control the authoritative filesystem path;
- switching Workspaces leaves stale scope from the previous Workspace;
- `knowledge.status` accepts arbitrary browser-authored scope data;
- the Knowledge server entry accepts arbitrary/unbounded operations;
- focused tests fail;
- `npm run verify` fails because of P0-T02 changes;
- `npm run build` cannot build the Knowledge bundled plugin;
- existing Files/Terminal/Git workspace behavior regresses.

## Troubleshooting

### Knowledge tab does not appear

Check that the plugin source exists:

```bash
ls -la pi-web-plugins/knowledge
```

Rebuild plugins:

```bash
npm run build:plugins
```

Then restart the development stack:

```bash
# stop the current npm run dev with Ctrl-C
npm run dev
```

Also inspect **Settings → PI WEB plugins** and confirm `knowledge` is discovered/enabled for the selected machine.

### Knowledge panel shows a backend error

Check terminal output from:

```bash
npm run dev
```

Then run the focused server test:

```bash
npm test -- pi-web-plugins/knowledge/server-plugin.test.ts
```

If the focused test passes but the browser does not, capture:

- selected Machine;
- selected Project;
- selected Workspace;
- browser console error;
- sessiond/server logs;
- exact UI error message.

### Repository verification fails

Run gates individually:

```bash
npm run typecheck
npm run lint
npm run knip
npm test
```

Record the first failing command and its complete error output in the development report before changing code.

## Cleanup / reset

Stop the development stack with:

```text
Ctrl-C
```

No Knowledge database, persistent Source data, embeddings, or generated artifacts are created by P0-T02, so there is no task-specific data cleanup.

To return to your previous branch:

```bash
git switch -
```

## Verification limits

Passing this guide proves only the P0-T02 integration skeleton.

It does **not** prove:

- standalone `pi-knowledge` process behavior;
- service authentication/IPC;
- service restart/recovery;
- real remote Fleet E2E;
- Source import;
- SQLite persistence;
- retrieval quality;
- Evidence stability;
- Restricted Ask;
- Notes;
- Course generation.

Those require their own later task verification guides.

## Recording the result

After a human runs this guide, update:

```text
docs/development/reports/P0-T02-knowledge-plugin-skeleton.md
```

Record at minimum:

- OS/environment;
- Node/npm versions;
- commands executed;
- focused test result;
- `npm run verify` result;
- `npm run build` result;
- manual Cases 1–4 result;
- any failure/log evidence;
- final PASS / PARTIAL / BLOCKED status.
