# P0-T04 — Thin server-plugin → pi-knowledge Adapter Verification Guide

## Purpose

Verify only the P0-T04 thin server-plugin adapter between PI WEB's host-authoritative paired-plugin context and the standalone P0-T03 `pi-knowledge` service.

This guide deliberately separates P0-T04 from P0-T05:

- P0-T04 proves the adapter contract, bounds, cancellation/deadline behavior, and a real adapter-client → standalone-service call.
- P0-T05 proves the complete Browser → pairedBackend → selected Machine sessiond → server plugin → standalone service → UI path.

## Current local evidence (2026-09-09)

Local Omarchy/Linux execution established the following before the latest corrective commits:

- `service-client.test.ts`: 8/9 PASS; the generated oversized-request case exposed a synchronous throw from a Promise-returning API;
- P0-T05 happy-dom E2E: 0/4 before transport correction, with browser-style CORS preflight (`OPTIONS ... 401`) contaminating the server-only loopback adapter;
- after binding the adapter to `undici.fetch` and making `dispatch()` / `health()` true async APIs, the combined Knowledge focused run improved to 24/25 PASS;
- the sole remaining failure was dispatch wrong-token: the authenticated service rejected the request before body parsing and therefore used Fastify's server request id, while the adapter incorrectly compared that id to the unparsed client body request id before mapping `AUTH_INVALID`.

Corrective commits on this task branch:

- `18439fd` — use explicit server-side `undici.fetch`; make `dispatch()` / `health()` true async APIs;
- `04d7ef9` — for structured pre-dispatch errors, validate header request id against the error envelope's bounded request id, while keeping successful dispatch correlation bound to the client-generated request id;
- `8580194` — add a direct dispatch wrong-token regression test.

These fixes deliberately preserve authentication in Fastify `onRequest`; unauthenticated request bodies are not parsed merely to recover the client request id.

The corrected HEAD still requires rerun. This section records observed evidence and fixes, not a PASS declaration.

## PASS criteria

P0-T04 can be changed from PARTIAL to PASS only when all required evidence below is actually observed:

- focused adapter tests pass;
- TypeScript passes;
- ESLint passes for task-attributable code (repository-wide inherited failures must be classified, not silently patched);
- knip passes for task-attributable dependencies, with inherited/package-stack debt classified separately;
- production build passes;
- package dry-run passes;
- branch diff check passes;
- full suite has no new P0-T04-attributable failure beyond classified inherited baseline failures;
- real local server-plugin adapter can authenticate to standalone `pi-knowledge` and return host-authoritative Workspace scope;
- wrong token/service unavailable/protocol mismatch/cancellation behavior fails closed without leaking the token.

A later P0-T05 E2E success can provide compatible evidence for the real local adapter row, but it does not replace P0-T04's focused/static/build checks.

---

## 1. Checkout

```bash
git fetch origin
git switch feat/p0-thin-knowledge-adapter
git pull --ff-only
```

Confirm:

```bash
git status --short --branch
```

Expected branch:

```text
feat/p0-thin-knowledge-adapter
```

Install dependencies only if the checkout does not already have the required dependency tree:

```bash
npm ci
```

---

## 2. Focused adapter tests

Run:

```bash
npm test -- \
  pi-web-plugins/knowledge/server-plugin.test.ts \
  pi-web-plugins/knowledge/service-client.test.ts
```

Expected on the corrected HEAD:

```text
2 test files passed
16 tests passed
```

The focused suite must demonstrate at least:

- host-authoritative Project/Workspace/Path is the only scope sent to `workspace.echo`;
- browser-authored scope is rejected before service contact;
- unsupported browser operations are rejected before service contact;
- host project/workspace mismatch is rejected before service contact;
- a service echo mismatch is rejected;
- host cancellation is propagated;
- wire defaults match the P0-T03 contract;
- authenticated health and `workspace.echo` work against a real loopback P0-T03 Fastify app;
- health wrong-token maps to structured rejection without exposing the token;
- dispatch wrong-token maps a pre-body-auth `AUTH_INVALID` response without weakening request-id correlation for successful dispatches;
- non-loopback service configuration is rejected;
- adapter request and response byte limits are enforced;
- adapter deadline is enforced.

FAIL P0-T04 if any focused failure is fixed by weakening scope validation, loopback validation, authentication ordering, byte limits, successful-dispatch request-id correlation, cancellation/deadline behavior, or token handling.

---

## 3. Static/build/package gates

Run:

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Then confirm emitted plugin graph:

```bash
test -f dist/pi-web-plugins/knowledge/server-plugin.js \
  && test -f dist/pi-web-plugins/knowledge/service-client.js \
  && echo 'P0-T04 plugin dist entries: PASS'
```

Expected:

```text
P0-T04 plugin dist entries: PASS
```

Check whitespace/patch integrity against the direct stacked base:

```bash
git diff --check \
  origin/chore/autonomous-development-policy...HEAD
```

Expected: no output.

---

## 4. Full-suite regression

Run:

```bash
npm test
```

Record exact file/test pass/fail/skip counts.

Current local full-suite evidence before the latest P0 corrections was:

```text
5 test files failed | 386 passed
8 tests failed | 3848 passed | 2 skipped
```

Two failures (`globalProviderPolicy.test.ts` and `piSessionService.promptQueue.test.ts`) were confirmed against the policy base with identical test and production-file SHAs and are inherited, not P0-T04 scope. Re-run after the corrective commits and classify any remaining failures by origin.

Any additional failure attributable to the P0-T04 adapter must be fixed before PASS.

---

## 5. Real local adapter acceptance

This check proves an actual emitted Knowledge server-plugin adapter can reach the standalone service. It does not require declaring the entire P0-T05 browser E2E accepted.

Choose a token:

```bash
export PI_KNOWLEDGE_TOKEN='p0-t04-local-adapter-verification-token'
```

Build first:

```bash
npm run build
```

Start standalone `pi-knowledge` in terminal A:

```bash
PI_KNOWLEDGE_TOKEN="$PI_KNOWLEDGE_TOKEN" \
node dist/knowledge/service/main.js
```

Expected listener:

```text
127.0.0.1:8515
```

In terminal B start PI WEB/sessiond using the same server-side environment token according to the repository's normal development startup path. The important invariant is that the token is present in the server/sessiond environment and is never sent to browser code.

For an integrated browser check, opening the Knowledge panel and triggering its existing integration/status action should ultimately return:

```text
status: ready
projectId: current host Project id
workspaceId: current host Workspace id
workspacePath: current host Workspace path
workspaceLabel: current host Workspace label
```

The displayed scope must change when the host Workspace changes; browser-authored request data must not be able to override it.

If this complete UI path is run, record it for both P0-T04's real-adapter row and the applicable P0-T05 E2E row.

---

## 6. Failure-mode acceptance

These checks may be performed during the P0-T05 batch if more convenient, but the evidence must be recorded before P0-T04 is marked PASS.

### Service unavailable

With PI WEB/sessiond running, stop `pi-knowledge` and invoke the Knowledge status operation.

Expected:

- request fails/degrades explicitly;
- no false `ready` response;
- no fallback to an in-sessiond stub;
- no service token appears in browser error text/log output supplied for acceptance.

### Wrong token

Restart PI WEB/sessiond and `pi-knowledge` with different `PI_KNOWLEDGE_TOKEN` values.

Expected:

- authentication fails closed;
- adapter maps the structured service error to `SERVICE_REJECTED` / remote `AUTH_INVALID`;
- no `ready` response;
- service credential value is not exposed to browser/UI;
- the service may use its own request id because authentication happens before dispatch-body parsing; header and error-envelope ids must still correlate.

### Protocol mismatch

Use a test/mocked service or focused test fixture that returns another protocol version.

Expected:

```text
PROTOCOL_INVALID
```

or the equivalent mapped adapter failure. Do not accept the payload.

### Cancellation/deadline

The focused tests must already exercise cancellation and adapter timeout. If a real local delayed/mock service is available, also confirm an abandoned/cancelled paired request does not continue as an accepted Knowledge result.

---

## 7. Scope/secret review

Search the browser plugin source for service configuration identifiers:

```bash
grep -R -n -E \
  'PI_KNOWLEDGE_TOKEN|PI_KNOWLEDGE_PORT|PI_KNOWLEDGE_HOST|8515' \
  pi-web-plugins/knowledge/browser \
  || echo 'browser has no pi-knowledge connection configuration: PASS'
```

Expected:

```text
browser has no pi-knowledge connection configuration: PASS
```

Inspect the task diff:

```bash
git diff --name-only \
  origin/chore/autonomous-development-policy...HEAD
```

P0-T04 should contain only adapter code/tests and P0-T04 progress/verification documentation. It must not contain P0-T05-specific E2E implementation, database, parser, retrieval, embeddings, Notes, or model runtime work.

---

## 8. Evidence record

Record:

```text
P0-T04 focused adapter tests: PASS / FAIL — exact count
TypeScript: PASS / FAIL
ESLint: PASS / FAIL
Knip: PASS / FAIL
Build: PASS / FAIL
pack:dry: PASS / FAIL
Plugin dist entries: PASS / FAIL
git diff --check: PASS / FAIL
Full suite: PASS / inherited-only FAIL / new FAIL — exact counts
Real standalone service start: PASS / FAIL
Real server-plugin → service authentication: PASS / FAIL
Host-authoritative scope round trip: PASS / FAIL
Service unavailable failure: PASS / FAIL
Wrong-token failure: PASS / FAIL
Protocol mismatch rejection: PASS / FAIL
Cancellation/deadline: PASS / FAIL
Browser has no service token/host/port knowledge: PASS / FAIL
```

P0-T04 becomes PASS only when the required rows are satisfied and any full-suite failure is confirmed to be only inherited baseline failures.

Until then the authoritative status remains PARTIAL and the missing rows remain OPEN in `docs/development/VERIFICATION-DEBT.md`.
