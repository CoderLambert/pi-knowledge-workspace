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

The callback was initially passed through an `as never` fixture, preventing useful contextual typing. The immediate callback typing defect was corrected.

### Attempt 1 — plugin lifecycle UI failure

The browser also previously displayed:

```text
Failed to load PI WEB plugins: Unsupported plugin manifest lifecycle version
```

A mixed frontend/backend checkout was identified as a plausible cause because Vite uses a separate API backend. The verification guide therefore includes an isolated-port/data-directory procedure. The Knowledge package manifest itself must not invent host lifecycle metadata as a workaround.

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

The early `ECONNREFUSED` messages are startup-order transients in this run, not persistent Knowledge failures, because the backend subsequently starts and serves requests successfully.

The earlier lifecycle-version failure was not reproduced in this later run.

### Attempt 2 — focused tests PASS

Executed locally:

```bash
npm test -- \
  pi-web-plugins/knowledge/pi-web-plugin.test.ts \
  pi-web-plugins/knowledge/server-plugin.test.ts
```

Observed:

```text
Test Files  2 passed (2)
Tests       8 passed (8)
```

### Attempt 2 — production build PASS

Executed locally:

```bash
npm run build
```

The TypeScript/plugin/Vite production build completed successfully. The large-chunk message was a Vite warning, not a build failure.

### Attempt 2 — repository verify stopped at ESLint

`npm run verify` passed TypeScript typecheck and then failed lint with four Knowledge-specific violations:

```text
browser/pi-web-plugin.ts
- no-unnecessary-condition
- consistent-type-assertions

pi-web-plugin.test.ts
- no-floating-promises
- consistent-type-assertions
```

These were corrected without disabling lint rules:

1. removed the redundant `backend.request === undefined` check once `requestVersion === 1` narrows the paired-backend capability;
2. replaced `as Record<string, unknown>` with a real `isRecord` type guard;
3. removed the test's `as never` runtime-context escape and replaced it with a complete typed `PluginRuntimeContext` fixture;
4. made the action test async and awaited `action.run(...)`.

## Verification evidence state

### Confirmed / performed

- public browser plugin API reviewed;
- public server plugin API reviewed;
- no PI WEB core navigation/server-route patch required;
- Knowledge server plugin activates in a real local development run;
- focused Knowledge tests passed 8/8 before the latest lint-only cleanup;
- production build passed before the latest lint-only cleanup;
- the four reported ESLint violations have been corrected in source without rule suppression.

### Still pending

Because the lint cleanup changed source/test files after the successful focused-test/build run, the final gate must be rerun from the current branch head:

```bash
npm test -- \
  pi-web-plugins/knowledge/pi-web-plugin.test.ts \
  pi-web-plugins/knowledge/server-plugin.test.ts

npm run verify
npm run build
```

Then complete the Knowledge panel manual Workspace checks from the verification guide.

Repository GitHub Actions has not produced PR workflow evidence for the current branch head, so this report does not claim CI PASS.

## Known limitations

- standalone `pi-knowledge` process is not implemented yet;
- service-down/restart/version behavior belongs to P0-T03/P0-T05;
- real remote Fleet E2E is not yet proven;
- no persistence, Source, Evidence, retrieval, Ask or Notes behavior exists in P0-T02.

## Result

**PARTIAL — focused tests/build have succeeded once; final verify/build/manual rerun is required after lint cleanup.**

P0-T02 must not be promoted to PASS until:

1. focused tests pass on the current head;
2. `npm run verify` passes on the current head;
3. `npm run build` passes on the current head;
4. Knowledge panel opens without plugin lifecycle failure;
5. Knowledge integration check returns the selected Workspace scope correctly;
6. Workspace switching does not retain stale scope.

## Impact on the plan

The architectural integration path remains valid. The latest local run is positive evidence that the bundled Knowledge server plugin can activate in the normal PI WEB development stack.

No redesign of the Knowledge plugin boundary is required.

## Next action

Pull the current branch head and rerun the final P0-T02 gates. If they pass, record the manual UI result and promote P0-T02 from `PARTIAL` to `PASS`; otherwise record the next concrete failure before starting P0-T03.
