# P0-T02 — Knowledge Paired Plugin Skeleton Report

## Task metadata

- **Task:** P0-T02
- **Phase:** P0a — Thin Fork integration spike
- **Date:** 2026-09-08
- **Branch:** `feat/p0-knowledge-plugin-skeleton`
- **PR:** #3 — `feat: add P0 Knowledge paired-plugin skeleton`
- **Status:** **PARTIAL**
- **PI WEB core runtime files changed:** 0
- **Human verification guide:** `docs/development/verification/P0-T02-knowledge-plugin-skeleton.md`

## Objective

Implement the first runnable Knowledge product surface using only PI WEB public extension seams:

```text
Knowledge Workspace Panel
→ context.pairedBackend.request()
→ PI WEB selected-machine transport
→ host-authoritative PairedPluginRequestContext
→ Knowledge paired server plugin
```

Heavy Knowledge processing remains outside sessiond and is deferred to P0-T03.

## Delivered behavior

### Bundled Knowledge plugin

Added:

```text
pi-web-plugins/knowledge/
├── package.json
├── browser/pi-web-plugin.ts
├── server-plugin.ts
├── pi-web-plugin.test.ts
└── server-plugin.test.ts
```

The browser contribution provides:

- `Knowledge` Workspace panel;
- panel id `workspace.knowledge`;
- route alias `knowledge`;
- `view.knowledge` action;
- runtime-qualified plugin identity for selected-machine compatibility;
- integration check through `pairedBackend.request("knowledge.status", null)`;
- explicit paired-backend-unavailable diagnostics.

The paired server plugin:

- implements public Server Plugin API v1;
- handles bounded `knowledge.status` only;
- reads Project/Workspace scope from host `PairedPluginRequestContext`;
- rejects browser-authored scope input;
- rejects inconsistent host scope;
- rejects unsupported operations;
- performs no DB, parsing, retrieval, embedding or LLM work.

## Architecture decisions

1. **No AppShell/core navigation patch.** Knowledge uses `WorkspacePanelContribution`.
2. **Use paired backend.** Knowledge is not the Workspace owner/provider.
3. **Host scope is authoritative.** Browser JSON cannot choose the filesystem Workspace.
4. **Use runtime-qualified plugin identity.** Required for machine-scoped/federated plugin correctness.
5. **Keep the server plugin thin.** P0-T03 introduces the standalone `pi-knowledge` process.
6. **Keep failure states visible.** Capability failures are diagnosable rather than silently hiding the product surface.

## Security / correctness invariants

- Browser input cannot select authoritative Project/Workspace/path.
- `knowledge.status` accepts only `null`/empty input.
- returned scope comes from host-owned Project/Workspace context.
- Workspace `projectId` must match host Project id.
- unsupported operations fail explicitly.
- browser code does not construct a Knowledge service URL.
- heavy Knowledge processing is absent from sessiond.

## Automated coverage added

### Browser tests

`pi-web-plugins/knowledge/pi-web-plugin.test.ts` covers:

- Workspace panel metadata;
- runtime-qualified tool selection;
- `pairedBackend.request("knowledge.status", null)`;
- rendering host scope;
- paired-backend-unavailable diagnostics.

### Server tests

`pi-web-plugins/knowledge/server-plugin.test.ts` covers:

- host-resolved scope;
- spoofed browser scope rejection;
- inconsistent host scope rejection;
- unsupported operation rejection.

## Local verification history — 2026-09-08

### Attempt 1 — strict TypeScript defect

Observed:

```text
pi-web-plugins/knowledge/pi-web-plugin.test.ts:47:29
error TS7006: Parameter 'id' implicitly has an 'any' type.
```

The callback was initially passed through an `as never` fixture, preventing useful contextual typing. The callback and fixture were replaced with a fully typed `PluginRuntimeContext` test helper.

### Attempt 1 — plugin lifecycle UI failure

The browser also previously displayed:

```text
Failed to load PI WEB plugins: Unsupported plugin manifest lifecycle version
```

A mixed frontend/backend checkout was identified as a plausible cause because Vite uses a separate API backend. The verification guide includes an isolated-port/data-directory procedure for that failure mode. The Knowledge package manifest itself must not invent host lifecycle metadata as a workaround.

### Attempt 2 — runtime starts and Knowledge activates

A later same-branch local run showed the normal startup sequence:

```text
Vite client starts
→ early proxy requests may receive ECONNREFUSED while the API is still booting
→ PI WEB API listens on 127.0.0.1:8504
→ Terminal server plugin activates
→ Git server plugin activates
→ Knowledge server plugin activates
→ sessiond socket listens
```

The early `ECONNREFUSED` messages were startup-order transients in that run because the backend subsequently started and served requests successfully.

### Attempt 2 — focused tests/build PASS, lint defects fixed

Focused Knowledge tests passed 8/8 and `npm run build` completed successfully. `npm run verify` then exposed four P0-T02 ESLint violations. They were corrected without rule suppression:

1. removed a redundant paired-backend condition;
2. replaced an unsafe record assertion with a real type guard;
3. removed the `as never` test escape;
4. awaited the async action invocation.

### Attempt 3 — Node Web Storage test-environment incompatibility identified

A full verification run initially reported:

```text
Test Files  25 failed | 347 passed
Tests       297 failed | 3442 passed | 2 skipped
```

The failures clustered around unrelated browser tests and repeatedly failed at:

```text
localStorage.clear()
```

Node also emitted:

```text
ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
```

Running a representative failing test with Node experimental Web Storage disabled changed it from 4 failures to 4/4 PASS:

```bash
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--no-experimental-webstorage" \
npm test -- src/client/src/components/SettingsDialog.test.ts
```

To make this deterministic for every developer, `vitest.config.ts` now supplies:

```ts
execArgv: ["--no-experimental-webstorage"]
```

so normal `npm test` / `npm run verify` no longer require a manual environment override.

### Attempt 3 — full suite reduced to one inherited auth/session failure

With the Web Storage issue removed, the full suite became:

```text
Test Files  1 failed | 371 passed
Tests       1 failed | 3738 passed | 2 skipped
```

The only remaining failure is:

```text
src/server/sessions/piSessionService.promptQueue.test.ts
PiSessionService prompt, queue, and auth warnings
→ refreshes auth state and dedupes warnings when logout removes the current model's credentials
```

The same test also fails when run alone (14/15 pass, one failure), so this is not a full-suite ordering/flakiness artifact.

Important scope evidence:

- `src/server/sessions/piSessionService.promptQueue.test.ts` is byte-identical between P0-T02 and its P0-T01 base;
- `src/server/sessions/piSessionService.ts` is byte-identical between P0-T02 and its P0-T01 base;
- P0-T02 does not modify session/auth production code or its test support;
- P0-T02 does not change the root dependency lock.

The failing path currently returns early when the refreshed `ModelRuntime` can no longer resolve the active model before publishing an auth-loss warning. That behavior is an inherited PI WEB/Pi SDK baseline compatibility candidate and is not being silently patched inside the Knowledge feature task.

## Verification evidence state

### Confirmed / performed

- public browser plugin API reviewed;
- public server plugin API reviewed;
- no PI WEB core navigation/server-route patch required;
- Knowledge server plugin activates in a real local development run;
- focused Knowledge tests: **8/8 PASS**;
- TypeScript typecheck: **PASS** in the latest full verify path;
- ESLint: **PASS** in the latest full verify path;
- knip: **PASS** in the latest full verify path;
- production build: **PASS**;
- Node Web Storage / happy-dom incompatibility reproduced and fixed in Vitest worker configuration;
- full test suite: **3738 PASS, 1 inherited auth/session baseline candidate FAIL, 2 skipped**;
- the remaining failing test is outside the P0-T02 modified code path and its test/service files are identical to the P0-T01 base.

### Still pending

1. manual Knowledge panel acceptance on the current branch head;
2. final classification or separate maintenance fix for the inherited `piSessionService.promptQueue` auth-warning test;
3. GitHub Actions evidence (no PR workflow run has been produced for this branch).

## Known limitations

- standalone `pi-knowledge` process is not implemented yet;
- service-down/restart/version behavior belongs to P0-T03/P0-T05;
- real remote Fleet E2E is not yet proven;
- no persistence, Source, Evidence, retrieval, Ask or Notes behavior exists in P0-T02.

## Result

**PARTIAL — P0-T02-specific automated gates are green; one inherited baseline auth/session test and final manual UI acceptance remain.**

P0-T02 may move to PASS only after:

1. the manual Knowledge panel checks succeed on the current head;
2. the remaining auth/session test is either reproduced/classified as a baseline failure or fixed in a separate maintenance scope;
3. the final report records the decision explicitly.

## Impact on the plan

The architectural integration path remains valid. Real local verification now provides positive evidence that:

- the Knowledge server plugin activates in the normal PI WEB development stack;
- the focused Knowledge contract passes;
- the fork can keep its test environment deterministic on current supported Node versions.

No redesign of the Knowledge plugin boundary is required.

## Next action

Run the manual Knowledge Workspace verification on the current branch head. In parallel, classify the single inherited auth/session test as a separate baseline maintenance item rather than expanding P0-T02 into unrelated session/auth work.
