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

The repository config disables Node's experimental Web Storage inside Vitest workers so happy-dom owns `localStorage` consistently. No manual `NODE_OPTIONS=--no-experimental-webstorage` prefix is required after pulling the current branch head.

Run the focused Knowledge tests:

```bash
npm test -- \
  pi-web-plugins/knowledge/pi-web-plugin.test.ts \
  pi-web-plugins/knowledge/server-plugin.test.ts
```

Expected:

```text
Test Files  2 passed (2)
Tests       8 passed (8)
```

Then run the repository gates:

```bash
npm run verify
npm run build
```

Expected for P0-T02-owned code:

- typecheck passes;
- ESLint passes;
- knip passes;
- focused Knowledge tests pass;
- production build succeeds.

The current inherited baseline has one confirmed inherited auth/session failure:

```text
src/server/sessions/piSessionService.promptQueue.test.ts
→ refreshes auth state and dedupes warnings when logout removes the current model's credentials
```

The same test was reproduced on `origin/chore/p0-integration-seam-analysis` with the same result: 14 passed, 1 failed, with `expected 1` / `received 0`. The failing test and its `PiSessionService` implementation are unchanged from the P0-T01 baseline and are outside the Knowledge change set. It is classified as an inherited PI WEB / current Pi SDK baseline compatibility failure; do not modify unrelated session/auth behavior to make P0-T02 green.

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

If the UI displays:

```text
Failed to load PI WEB plugins: Unsupported plugin manifest lifecycle version
```

isolate the feature checkout from any separately installed PI WEB backend:

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

### Case 5 — Existing Workspace Tools regression

Verify the existing Workspace Tools still work for the selected Workspace:

1. Open **Files** and read a repository file such as `package.json`.
2. Open **Terminal** and run `pwd`.
3. Open **Git** and confirm the current branch/status renders.
4. Use **Chat** and confirm a normal session request succeeds.

Expected:

- Files renders the selected Workspace file tree and file contents;
- Terminal `pwd` matches the selected Workspace path;
- Git renders the selected Workspace branch/status;
- Chat remains usable without session/runtime errors;
- Knowledge does not break or replace the existing Workspace Tools.

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
- [ ] typecheck / lint / knip pass;
- [ ] `npm run build` passes;
- [ ] any unrelated inherited baseline test failure is explicitly classified and documented;
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

- typecheck, lint, knip, focused Knowledge tests, or build fail because of P0-T02 changes;
- Knowledge cannot load;
- plugin manifest lifecycle error remains with a matched frontend/backend checkout;
- Knowledge opens against a different Workspace;
- browser input controls authoritative filesystem scope;
- Workspace switching retains stale scope;
- existing workspace tools regress.

Do not classify a byte-identical pre-existing baseline failure as a Knowledge regression without evidence that P0-T02 changes caused it.

## Troubleshooting

### Browser tests fail with `localStorage` undefined

Pull the current branch first:

```bash
git pull --ff-only
```

`vitest.config.ts` now starts workers with:

```text
--no-experimental-webstorage
```

If the warning still appears, confirm you are running the current branch head and not an older checkout.

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

## Recorded local acceptance — 2026-09-09

Manual acceptance was performed on:

- branch: `feat/p0-knowledge-plugin-skeleton`
- commit: `1037003`

Results:

- Knowledge panel available: **PASS**
- `Check integration` returns `Status: ready`: **PASS**
- Project / Workspace / Path correct: **PASS**
- Workspace switching A → B → A without stale scope: **PASS**
- Git worktree path resolution: **PASS**
- Files regression: **PASS**
- Terminal regression: **PASS**
- Git regression: **PASS**
- Chat regression: **PASS**
- focused Knowledge tests: **8/8 PASS**
- typecheck: **PASS**
- ESLint: **PASS**
- knip: **PASS**
- production build: **PASS**
- spoofed browser Workspace scope rejection: **PASS**
- unsupported operation rejection: **PASS**

A temporary verification worktree was used:

- Workspace: `verify/p0-t02-worktree`
- Path: `/home/lambert/githubRepos/lambert/pi-knowledge-workspace-p0-t02-wt`

The worktree was removed after verification.

The full suite recorded **3738 passed, 1 failed, 2 skipped**. The sole failure was independently reproduced on `origin/chore/p0-integration-seam-analysis` with the same **14 passed, 1 failed** result and the same `expected 1` / `received 0` assertion. It is classified as an inherited baseline failure, not a P0-T02 regression.

The first browser load also observed a transient plugin manifest `503` while `sessiond` was still starting. After Terminal, Git and Knowledge server plugins activated and the session daemon socket became available, a hard refresh loaded all Workspace Tools normally. No persistent plugin lifecycle failure remained.

**Recorded result: PASS.**

## Verification limits

Passing P0-T02 proves only the PI WEB Knowledge integration skeleton. It does not prove standalone service behavior, persistence, retrieval quality, Stable Evidence, Restricted Ask, Notes, Course, or real remote Fleet E2E.

## Recording the result

After the final human run, update:

```text
docs/development/reports/P0-T02-knowledge-plugin-skeleton.md
```

Record the exact commands, results, manual cases, and final PASS / PARTIAL / BLOCKED status.
