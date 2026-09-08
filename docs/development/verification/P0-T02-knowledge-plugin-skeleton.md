# P0-T02 — Knowledge Paired Plugin Skeleton Verification Guide

## What this verifies

This guide verifies the first runnable Knowledge integration slice:

```text
Knowledge Workspace Panel
→ pairedBackend.request("knowledge.status", null)
→ PI WEB paired backend transport
→ Knowledge server plugin
→ host-authoritative Project / Workspace scope
→ browser rendering
```

It does not verify the standalone `pi-knowledge` process, persistence, retrieval, Ask, Notes, or Course.

## Prerequisites

- Node.js `>=22.19.0`
- npm
- git
- a local folder or Git repository that can be opened as a PI WEB Project

Check runtime:

```bash
node --version
npm --version
```

## Checkout and install

```bash
git fetch origin
git switch feat/p0-knowledge-plugin-skeleton
git pull
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

- focused Knowledge tests pass;
- typecheck, lint, knip and Vitest pass;
- the application and bundled plugins build successfully.

## Important: use an isolated development backend

Do **not** run the feature checkout against an already-installed PI WEB backend on the default API port.

The Vite development client normally runs on port `8505` and proxies PI WEB API/plugin requests to the API port configured by `PI_WEB_PORT`. If an older installed PI WEB service is already listening on the default API port `8504`, a new development client can accidentally talk to that older backend. A typical symptom is:

```text
Failed to load PI WEB plugins: Unsupported plugin manifest lifecycle version
```

That is a mixed-version frontend/backend environment, not a Knowledge plugin manifest field that should be edited.

For this task, start an isolated development instance:

```bash
mkdir -p .tmp/p0-t02-data

PI_WEB_PORT=8604 \
PI_WEB_DATA_DIR="$PWD/.tmp/p0-t02-data" \
npm run dev
```

Keep this terminal running.

The Vite URL is normally:

```text
http://localhost:8505
```

If Vite prints another port, use the printed URL.

### Confirm the development backend is the one serving the browser

In another terminal:

```bash
curl -fsS http://127.0.0.1:8604/pi-web-plugins/manifest.json
```

Expected:

- HTTP request succeeds;
- JSON contains the current development plugin manifest;
- the response is from port `8604`, not the installed/default `8504` service.

If `jq` is installed, inspect the lifecycle value directly:

```bash
curl -fsS http://127.0.0.1:8604/pi-web-plugins/manifest.json | jq '.lifecycleVersion'
```

Do not change the Knowledge package to make it match an older backend. The frontend and backend from the same checkout must be run together.

## Manual verification

### Case 1 — Knowledge panel appears

1. Open the Vite development URL.
2. Add or select a Project.
3. Select a Workspace.
4. Find and open `Knowledge`.

Expected:

- no `Unsupported plugin manifest lifecycle version` banner;
- Knowledge is available as a Workspace tool;
- no duplicated Machine/Project/Workspace selector exists inside Knowledge;
- existing Files/Terminal/Git/Chat surfaces remain usable.

If `Knowledge` is not visible, open **Settings → PI WEB plugins** and confirm the bundled `knowledge` plugin is discovered/enabled for the selected machine. Because it has a server entry, restart the dev stack after changing enablement, then reload the browser.

### Case 2 — Integration request works

1. Open `Knowledge`.
2. Click **Check integration**.

Expected:

```text
Status: ready
Machine: <selected machine>
Project: <current project id>
Workspace: <current workspace>
Path: <host-resolved workspace path>
```

The browser must not ask the user for an authoritative filesystem path.

### Case 3 — Workspace switching updates scope

1. Open Workspace A.
2. `Knowledge → Check integration`.
3. Record Workspace and Path.
4. Switch to Workspace B or another worktree.
5. Run the integration check again.

Expected:

- Workspace and Path change to Workspace B;
- Workspace A scope is not reused;
- switching back returns Workspace A scope again.

### Case 4 — Git worktree scope

If the project has a worktree:

```bash
git worktree list
```

Select a non-main worktree in PI WEB and run `Knowledge → Check integration`.

Expected: `Path` is the selected worktree path, not the main checkout path.

## Negative/security checks

Run:

```bash
npm test -- pi-web-plugins/knowledge/server-plugin.test.ts
```

This must verify that:

- browser-authored Project/Workspace scope is rejected;
- inconsistent host Project/Workspace scope is rejected;
- unsupported Knowledge operations are rejected.

Run:

```bash
npm test -- pi-web-plugins/knowledge/pi-web-plugin.test.ts
```

This must verify that the browser uses `pairedBackend.request("knowledge.status", null)` and reports an unavailable paired backend explicitly rather than constructing its own localhost/service URL.

## PASS checklist

- [ ] Node.js is `>=22.19.0`.
- [ ] Focused Knowledge tests pass.
- [ ] `npm run verify` passes.
- [ ] `npm run build` passes.
- [ ] isolated dev stack starts with API port `8604`.
- [ ] `curl http://127.0.0.1:8604/pi-web-plugins/manifest.json` succeeds.
- [ ] no plugin lifecycle-version mismatch banner appears in the Vite UI.
- [ ] Knowledge is visible for the selected Workspace.
- [ ] **Check integration** returns `Status: ready`.
- [ ] Project / Workspace / Path match the selected Workspace.
- [ ] switching Workspace updates scope correctly.
- [ ] worktree path is correct when tested.
- [ ] existing Workspace tools still work.

## FAIL criteria

Treat the task as failed if:

- typecheck/tests/build fail after pulling the latest branch;
- the Vite client still talks to a backend from another PI WEB version;
- Knowledge is unavailable on the isolated same-checkout dev stack;
- Knowledge resolves a different Workspace than the selected one;
- browser input can control authoritative filesystem scope;
- Workspace switching leaves stale scope;
- existing Files/Terminal/Git behavior regresses.

## Troubleshooting

### `Unsupported plugin manifest lifecycle version`

First confirm which backend is being queried:

```bash
curl -i http://127.0.0.1:8604/pi-web-plugins/manifest.json
curl -i http://127.0.0.1:8504/pi-web-plugins/manifest.json
```

For this verification, the browser must use the development backend on `8604`.

Stop the current dev process with `Ctrl-C`, then restart exactly with:

```bash
PI_WEB_PORT=8604 \
PI_WEB_DATA_DIR="$PWD/.tmp/p0-t02-data" \
npm run dev
```

Do not try to fix this error by adding/changing a `lifecycleVersion` field in `pi-web-plugins/knowledge/package.json`.

### Knowledge does not appear

```bash
npm run build:plugins
```

Restart the isolated dev stack and inspect **Settings → PI WEB plugins**.

### Repository verification fails

Run gates independently:

```bash
npm run typecheck
npm run lint
npm run knip
npm test
```

Record the first failing output.

## Cleanup

Stop development with `Ctrl-C`.

P0-T02 creates no Knowledge database or source data. The isolated PI WEB development state can be removed if no longer needed:

```bash
rm -rf .tmp/p0-t02-data
```

## Verification limits

Passing this guide proves only the P0-T02 paired-plugin integration skeleton. It does not prove standalone `pi-knowledge`, real remote Fleet E2E, Source import, persistence, retrieval, Evidence durability, Restricted Ask, Notes, or Course.

## Record the result

After executing the guide, update:

```text
docs/development/reports/P0-T02-knowledge-plugin-skeleton.md
```

Record the environment, commands run, automated results, manual cases, failure evidence, and final PASS / PARTIAL / BLOCKED status.
