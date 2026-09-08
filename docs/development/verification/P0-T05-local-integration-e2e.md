# P0-T05 — Local Integration E2E Verification Guide

## Purpose

Verify the complete local Knowledge chain in a real development checkout and record the remaining acceptance evidence that repository-owned cross-layer tests cannot substitute for.

Target path:

```text
Select Workspace
→ open Knowledge
→ Check integration
→ browser pairedBackend
→ PI WEB web/API proxy
→ sessiond paired-plugin route
→ PluginBackendRegistry host authority
→ Knowledge server plugin
→ authenticated loopback HTTP
→ standalone pi-knowledge
→ authoritative scope returned
→ UI renders ready
```

P0-T05 is local-machine only. Selected remote Machine/Fleet routing is P0-T06.

## PASS criteria

P0-T05 becomes PASS only when:

- its focused cross-layer E2E test passes;
- TypeScript/ESLint/knip/build/package gates pass;
- full suite has no new P0-T05-attributable failure;
- a real local browser/web/API/sessiond/service run succeeds;
- Project/Workspace/Path match host state;
- Workspace switching cannot leave stale Knowledge scope;
- service unavailable, wrong protocol version, wrong token, request timeout and service restart are all observed to fail/recover as specified;
- browser never receives the service token or direct service connection authority.

---

## 1. Checkout and dependency order

P0-T05 is stacked on P0-T04.

```bash
git fetch origin
git switch test/p0-local-knowledge-integration-e2e
git pull --ff-only
```

If validating through PR merge order, ensure the stacked predecessors are applied in this order:

```text
P0-T03 PR #4
→ autonomous policy PR #5
→ P0-T04 PR #6
→ P0-T05 PR #7
```

Install dependencies only if needed:

```bash
npm ci
```

---

## 2. Focused cross-layer E2E

Run:

```bash
npm test -- \
  pi-web-plugins/knowledge/local-integration.e2e.test.ts
```

Expected current count:

```text
1 test file passed
4 tests passed
```

The four cases should cover:

1. Browser panel → real sessiond paired route → registry authority → real Knowledge adapter → real `pi-knowledge` → UI ready.
2. Service unavailable followed by restart recovery on the same port.
3. Wrong server/service token fail-closed without token disclosure.
4. Version-incompatible loopback service fail-closed before UI ready.

Also rerun the P0-T04 focused adapter suite because P0-T05 consumes that contract:

```bash
npm test -- \
  pi-web-plugins/knowledge/server-plugin.test.ts \
  pi-web-plugins/knowledge/service-client.test.ts
```

Expected current P0-T04 count: 15 tests.

---

## 3. Static/build/package gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Check task diff integrity:

```bash
git diff --check \
  origin/feat/p0-thin-knowledge-adapter...HEAD
```

Expected: no output.

Check the P0-T05 branch is E2E-only:

```bash
git diff --name-only \
  origin/feat/p0-thin-knowledge-adapter...HEAD
```

Expected files should be limited to the P0-T05 E2E test plus P0-T05 status/report/verification/debt documentation. No P0-T06 Machine/Fleet implementation should appear.

---

## 4. Full-suite regression

```bash
npm test
```

Record exact pass/fail/skip counts.

The previously classified inherited baseline failure is:

```text
src/server/sessions/piSessionService.promptQueue.test.ts
expected 1
received 0
```

If that remains the only failure with the same signature, record it as inherited. Do not patch session/auth behavior in P0-T05 to make the suite visually all green.

Any additional P0-T05-attributable failure must be resolved before PASS.

---

## 5. Start the real local processes

Use one server-side Knowledge token for both sessiond and `pi-knowledge`:

```bash
export PI_KNOWLEDGE_TOKEN='p0-t05-local-real-e2e-token-32'
```

Build:

```bash
npm run build
```

### Terminal A — standalone service

```bash
PI_KNOWLEDGE_TOKEN="$PI_KNOWLEDGE_TOKEN" \
node dist/knowledge/service/main.js
```

Confirm the listener is local:

```bash
ss -ltnp | grep ':8515'
```

Expected address:

```text
127.0.0.1:8515
```

### PI WEB processes

Start PI WEB using the repository's normal development or built startup flow, ensuring the **server/sessiond environment** contains the same `PI_KNOWLEDGE_TOKEN`.

Do not inject the token into browser JavaScript or browser-visible configuration.

The normal local PI WEB processes remain authoritative; do not bypass them with a direct browser `localhost:8515` request.

---

## 6. Real browser success case

In PI WEB:

1. Select a Project.
2. Select a Workspace.
3. Open the **Knowledge** Workspace tool.
4. Click **Check integration**.

Expected UI:

```text
Status: ready
Machine: local Machine
Project: selected host Project id
Workspace: selected host Workspace label/id
Path: selected host Workspace path
```

Cross-check Project/Workspace/Path using PI WEB's existing host UI/Workspace information, not browser-authored Knowledge input.

FAIL if:

- the panel reports ready while `pi-knowledge` is stopped;
- a path not belonging to the host-selected Workspace is returned;
- browser configuration contains the service token;
- the browser contacts port 8515 directly;
- the request bypasses existing paired-backend/sessiond routing.

---

## 7. Workspace switching

Use two real Workspaces A and B under the same Project when possible.

Run:

```text
Select A
→ Knowledge
→ Check integration
→ record A id/path

Select B
→ Knowledge
→ Check integration
→ record B id/path

Select A again
→ Knowledge
→ Check integration
→ record A id/path again
```

Expected:

- A reports A scope;
- B reports B scope;
- returning to A reports A again;
- no stale B scope remains after switching back;
- Knowledge does not maintain a second independent selected-Workspace store.

If a Git worktree Workspace is available, include it and confirm the returned path is the real worktree path.

---

## 8. Failure cases

### 8.1 Service not running

Stop `pi-knowledge` while PI WEB remains running, then click **Check integration**.

Expected:

- explicit Knowledge backend error;
- no false `ready`;
- PI WEB/sessiond remains usable;
- service token is not shown.

### 8.2 Wrong service token

Run `pi-knowledge` and PI WEB/sessiond with different tokens.

Expected:

- request fails closed;
- no `ready` state;
- authentication failure is attributable;
- neither token appears in UI.

Restore matching tokens before continuing.

### 8.3 Incompatible protocol version

Use the repository test fixture or a controlled local fixture that responds as `pi-knowledge` protocol version `2` while the adapter expects version `1`.

Expected:

- protocol mismatch error;
- no result accepted;
- no automatic downgrade.

### 8.4 Request timeout

Use a controlled local service fixture that accepts the request but does not complete before the adapter deadline.

Expected:

- bounded failure rather than an indefinitely pending panel;
- cancellation/timeout propagates through the server-plugin request boundary;
- no later stale `ready` result appears after the request has timed out.

The P0-T04 focused suite already checks adapter timeout mechanics; this P0-T05 row verifies real integrated behavior.

### 8.5 Service restart

With PI WEB/sessiond/browser still running:

1. stop `pi-knowledge`;
2. confirm integration request fails;
3. restart `pi-knowledge` with the same token/port;
4. click **Check integration** again.

Expected:

- the next request succeeds;
- no browser refresh/reconfiguration of the service endpoint is required;
- adapter does not persist a permanent failed state.

---

## 9. Browser secret/authority check

Search Knowledge browser source:

```bash
grep -R -n -E \
  'PI_KNOWLEDGE_TOKEN|PI_KNOWLEDGE_HOST|PI_KNOWLEDGE_PORT|127\.0\.0\.1:8515' \
  pi-web-plugins/knowledge/browser \
  || echo 'P0-T05 browser service authority check: PASS'
```

Expected:

```text
P0-T05 browser service authority check: PASS
```

Optionally use browser devtools Network inspection during **Check integration**.

Expected browser-visible request target is PI WEB's paired backend API for the selected Machine/Workspace, not port `8515`.

---

## 10. Regression smoke

With the local integration running, check existing Workspace tools still function at a basic level:

```text
Files
Terminal
Git
Chat
Knowledge
```

P0-T05 must not require replacing PI WEB's existing Machine/Workspace/session infrastructure.

---

## 11. Evidence record

Record:

```text
P0-T05 focused E2E: PASS / FAIL — expected 4
P0-T04 focused dependency suite: PASS / FAIL — expected 15
TypeScript: PASS / FAIL
ESLint: PASS / FAIL
Knip: PASS / FAIL
Build: PASS / FAIL
pack:dry: PASS / FAIL
git diff --check: PASS / FAIL
Full suite: PASS / inherited-only FAIL / new FAIL — exact counts
Real browser local success: PASS / FAIL
Authoritative Project/Workspace/Path: PASS / FAIL
Workspace A → B → A: PASS / FAIL
Worktree real path if tested: PASS / FAIL
Service unavailable: PASS / FAIL
Wrong token: PASS / FAIL
Protocol mismatch: PASS / FAIL
Request timeout: PASS / FAIL
Service restart recovery: PASS / FAIL
Browser has no service token/direct port authority: PASS / FAIL
Files/Terminal/Git/Chat smoke: PASS / FAIL
```

Evidence from this real E2E may also close compatible P0-T04 real-adapter verification debt rows. Keep the P0-T04 focused/static/build evidence separate.

Until these required rows are observed, P0-T05 remains PARTIAL and the debt ledger remains OPEN.
