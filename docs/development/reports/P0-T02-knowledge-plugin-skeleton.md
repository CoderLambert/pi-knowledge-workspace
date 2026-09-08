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

## Local user verification attempt — 2026-09-08

A real local verification run exposed two issues before P0-T02 could be accepted.

### Issue A — TypeScript TS7006

Observed:

```text
pi-web-plugins/knowledge/pi-web-plugin.test.ts:47:29
error TS7006: Parameter 'id' implicitly has an 'any' type.
```

Root cause:

The test fixture passed a callback through an `as never` host-context cast, so contextual typing did not infer the callback parameter under strict TypeScript settings.

Fix:

```ts
selectWorkspaceTool: (id: string) => { selected = id; }
```

Commit containing the fix starts from:

```text
600585f fix: type Knowledge workspace tool test callback
```

This removes the known TS7006 source-level defect. A fresh local `npm run verify` is still required to record PASS evidence.

### Issue B — `Unsupported plugin manifest lifecycle version`

Observed in the Vite UI:

```text
Failed to load PI WEB plugins: Unsupported plugin manifest lifecycle version
```

The same UI showed existing PI WEB Projects/Workspaces/Sessions while the feature checkout was opened on the Vite development port, indicating a mixed development/runtime environment was possible.

Diagnosis:

The Vite client normally runs on `8505` while PI WEB API defaults to `8504`. If an installed/older PI WEB backend is already listening on `8504`, a feature-branch Vite client can proxy plugin-manifest requests to that older backend. The current client and older server then disagree on the manifest lifecycle protocol.

This is **not** fixed by adding a lifecycle field to `pi-web-plugins/knowledge/package.json`; lifecycle belongs to the PI WEB host manifest protocol, not the Knowledge package declaration.

Mitigation/fix for verification:

Run the feature checkout with an isolated API port and data directory:

```bash
mkdir -p .tmp/p0-t02-data

PI_WEB_PORT=8604 \
PI_WEB_DATA_DIR="$PWD/.tmp/p0-t02-data" \
npm run dev
```

The Vite config inherits the API-port environment and proxies the development client to the same-checkout backend rather than a separately installed service.

The verification guide now requires checking:

```bash
curl -fsS http://127.0.0.1:8604/pi-web-plugins/manifest.json
```

before manual UI acceptance.

## Verification evidence state

### Confirmed / performed

- public browser plugin API reviewed;
- public server plugin API reviewed;
- no PI WEB core navigation/server-route patch required;
- automated browser/server regression tests are present;
- real user verification attempt executed and produced actionable failure evidence;
- TS7006 source defect corrected;
- isolated-development procedure documented to prevent frontend/backend lifecycle mismatch.

### Still pending

After pulling the latest branch, the following must be executed successfully on the user's machine:

```bash
npm test -- \
  pi-web-plugins/knowledge/pi-web-plugin.test.ts \
  pi-web-plugins/knowledge/server-plugin.test.ts

npm run verify
npm run build
```

Then run the isolated dev stack and complete the manual Workspace checks in the verification guide.

Repository GitHub Actions also has not produced the expected PR workflow evidence for this branch, so this report does not claim CI PASS.

## Known limitations

- standalone `pi-knowledge` process is not implemented yet;
- service-down/restart/version behavior belongs to P0-T03/P0-T05;
- real remote Fleet E2E is not yet proven;
- no persistence, Source, Evidence, retrieval, Ask or Notes behavior exists in P0-T02.

## Result

**PARTIAL — defects found during real verification have been addressed, rerun required.**

P0-T02 must not be promoted to PASS until:

1. focused tests pass;
2. `npm run verify` passes;
3. `npm run build` passes;
4. same-checkout isolated dev manifest loads without lifecycle mismatch;
5. Knowledge panel/manual Workspace switching checks pass.

## Impact on the plan

The architectural integration path remains valid. The local verification attempt added an important operational rule:

> Feature-branch PI WEB frontend/backend must be started as a matched checkout and isolated from an already-installed PI WEB backend during acceptance testing.

No redesign of the Knowledge plugin boundary is required.

## Next action

Re-run the updated P0-T02 verification guide. If it passes, update this report and `CHANGELOG.md` from `PARTIAL` to `PASS`; otherwise record the next concrete failure before starting P0-T03.
