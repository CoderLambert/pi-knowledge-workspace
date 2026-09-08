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

- Node.js `>=22.19.0`.
- npm.
- A local folder or Git repository that can be added as a PI WEB Project.

## Checkout and setup

```bash
git fetch origin
git switch feat/p0-knowledge-plugin-skeleton
git pull --ff-only
npm install
```

## Automated verification

Run the focused Knowledge tests:

```bash
npm test -- \
  pi-web-plugins/knowledge/pi-web-plugin.test.ts \
  pi-web-plugins/knowledge/server-plugin.test.ts
```

Then run the repository gates:

```bash
npm run verify
npm run build
```

Expected:

- 2 focused test files pass;
- 8 Knowledge tests pass;
- typecheck passes;
- ESLint passes;
- knip passes;
- full Vitest suite passes;
- production build succeeds.

Any non-zero exit code means this gate failed.

## Start the feature

Normally:

```bash
npm run dev
```

The Vite client can become ready before the API/session daemon. During those first seconds, messages such as the following may appear:

```text
[vite] http proxy error: ...
AggregateError [ECONNREFUSED]
```

Do not classify these startup-order messages as a persistent failure by themselves. Wait for the backend logs. A healthy startup must subsequently show the PI WEB API listening, the Knowledge server plugin activating, and the session daemon socket listening.

Open the Vite development URL, normally:

```text
http://localhost:8505
```

## If an installed PI WEB instance conflicts with the checkout

A previous local run displayed:

```text
Failed to load PI WEB plugins: Unsupported plugin manifest lifecycle version
```

If that error returns, isolate the feature checkout from any separately installed PI WEB backend:

```bash
mkdir -p .tmp/p0-t02-data

PI_WEB_PORT=8604 \
PI_WEB_DATA_DIR="$PWD/.tmp/p0-t02-data" \
npm run dev
```

Then confirm the development API is serving its own plugin manifest:

```bash
curl -fsS http://127.0.0.1:8604/pi-web-plugins/manifest.json
```

Do not modify `pi-web-plugins/knowledge/package.json` lifecycle metadata to compensate for a host-version mismatch.

## Manual verification

### Case 1 — Knowledge panel is available

1. Open PI WEB.
2. Add or select a Project.
3. Select a Workspace.
4. Open the `Knowledge` workspace tool.

Expected:

- Knowledge renders;
- the page does not crash;
- no plugin lifecycle error remains;
- existing workspace tools remain usable;
- Knowledge does not introduce a second Machine/Project/Workspace selector.

### Case 2 — paired backend scope works

Click **Check integration**.

Expected:

```text
Status: ready
Machine: <selected machine>
Project: <current project id>
Workspace: <current workspace label/id>
Path: <host-resolved workspace path>
```

The browser must not provide the authoritative filesystem path.

### Case 3 — Workspace switching

Use two Workspaces if possible:

1. Open Workspace A → Knowledge → **Check integration**.
2. Record Project / Workspace / Path.
3. Switch to Workspace B.
4. Open Knowledge → **Check integration**.

Expected:

- B returns B's id/label/path;
- A's path is not retained;
- switching back to A returns A's scope again.

### Case 4 — Git worktree

If the Project has a non-main worktree, select it and run **Check integration**.

Expected:

- returned path is the selected worktree path;
- it is not silently replaced by the main checkout path.

## Negative / security verification

Run:

```bash
npm test -- pi-web-plugins/knowledge/server-plugin.test.ts
```

The tests must confirm:

- spoofed browser-authored scope is rejected;
- inconsistent host Project/Workspace scope is rejected;
- unsupported operations are rejected.

Run:

```bash
npm test -- pi-web-plugins/knowledge/pi-web-plugin.test.ts
```

The tests must confirm:

- runtime-qualified workspace-tool navigation;
- paired backend request behavior;
- explicit paired-backend-unavailable diagnostics.

## PASS checklist

P0-T02 can be accepted only when all applicable items pass:

- [ ] focused Knowledge tests pass on current branch head;
- [ ] `npm run verify` passes on current branch head;
- [ ] `npm run build` passes on current branch head;
- [ ] `npm run dev` reaches a healthy backend/sessiond startup;
- [ ] Knowledge is visible for the selected Workspace;
- [ ] no plugin lifecycle error remains;
- [ ] **Check integration** returns `Status: ready`;
- [ ] Project / Workspace / Path match the selected Workspace;
- [ ] switching Workspace changes scope correctly;
- [ ] Git worktree path is correct when tested;
- [ ] existing workspace tools still work;
- [ ] spoofed-scope and unsupported-operation tests pass.

## FAIL criteria

Treat P0-T02 as failed if any of these persist after startup:

- `npm run verify` or `npm run build` fails because of P0-T02 changes;
- Knowledge cannot load;
- plugin manifest lifecycle error remains with a matched frontend/backend checkout;
- Knowledge opens against a different Workspace;
- browser input controls authoritative filesystem scope;
- Workspace switching retains stale scope;
- existing workspace tools regress.

## Troubleshooting

### Early Vite ECONNREFUSED

If proxy errors occur immediately after starting `npm run dev`, wait for backend startup messages. If the PI WEB API and session daemon subsequently listen and requests return 200, these initial errors are startup-order transients.

If the backend never begins listening, inspect the first server/sessiond error before the proxy messages.

### Plugin lifecycle mismatch

Use the isolated `PI_WEB_PORT=8604` / `PI_WEB_DATA_DIR` procedure above and verify the manifest directly on port 8604.

### Repository verification fails

Run gates individually:

```bash
npm run typecheck
npm run lint
npm run knip
npm test
```

Record the first failing command and its complete output in the development report before changing code.

## Cleanup

Stop the development stack with:

```text
Ctrl-C
```

P0-T02 creates no Knowledge database, source snapshots, embeddings, or indexes.

## Verification limits

Passing P0-T02 proves only the PI WEB Knowledge integration skeleton. It does not prove standalone service behavior, persistence, retrieval quality, Stable Evidence, Restricted Ask, Notes, Course, or real remote Fleet E2E.

## Recording the result

After the final human run, update:

```text
docs/development/reports/P0-T02-knowledge-plugin-skeleton.md
```

Record the exact commands, results, manual cases, and final PASS / PARTIAL / BLOCKED status.
