# P0-T03 — Standalone pi-knowledge Service Report

## Task metadata

- **Task:** P0-T03
- **Phase:** P0 — Integration / security / process boundary
- **Date:** 2026-09-09
- **Branch:** `feat/p0-standalone-pi-knowledge-service`
- **Stacked base:** `feat/p0-knowledge-plugin-skeleton` at `4a3536977aa379fd9dbd97d175c39b94536d74f8`
- **Implementation verification head:** `f98926530abe7dc2fd06edd3e684ca31a430beda`
- **PR:** #4 — `feat: add standalone pi-knowledge service skeleton`
- **Status:** **PASS**
- **P0-T04 started:** no
- **Human verification guide:** `docs/development/verification/P0-T03-standalone-pi-knowledge-service.md`

## Objective

Introduce a real standalone `pi-knowledge` process boundary with a small authenticated loopback HTTP/JSON contract, without implementing persistent Knowledge behavior or changing PI WEB's existing Machine / Project / Workspace / Session ownership.

P0-T03 proves only:

```text
local caller
→ authenticated loopback HTTP/JSON
→ standalone pi-knowledge process
→ bounded allowlisted dispatch
```

It does **not** implement or claim the Browser → sessiond → `pi-knowledge` chain. That remains P0-T04/P0-T05 scope.

## Delivered scope

Implemented:

- independent `pi-knowledge` process entry;
- explicit loopback-only bind configuration;
- bearer-token authentication;
- protocol version `1`;
- `GET /v1/health`;
- `POST /v1/dispatch`;
- operation allowlist:
  - `capabilities.get`;
  - `workspace.echo`;
- caller request id plus server request ids for pre-dispatch failures/health;
- stable structured success/error envelopes;
- bounded request body and serialized response;
- malformed JSON/schema rejection;
- unsupported-operation rejection;
- incompatible-protocol rejection;
- arbitrary target/proxy-field rejection;
- build/bin/package entry for `pi-knowledge`;
- focused contract/config tests;
- real standalone listen/HTTP/shutdown verification.

Explicitly not implemented:

- P0-T04 server-plugin adapter;
- Browser access to the service port/token;
- SQLite or persistence;
- ingestion/parsing;
- retrieval/RAG;
- embeddings;
- Notes;
- model/LLM/Pi SDK runtime;
- Redis/RabbitMQ/Kafka;
- generic RPC/proxy framework.

## Contract and process boundary

Source boundary:

```text
src/knowledge/contracts/
  protocol.ts
  operations.ts
  schemas.ts
  errors.ts

src/knowledge/service/
  main.ts
  app.ts
  config.ts
  health.ts
  dispatch.ts
```

Default transport configuration:

```text
host: 127.0.0.1
port: 8515
max request: 64 KiB
max response: 64 KiB
```

`PI_KNOWLEDGE_HOST` accepts only explicit `127.0.0.1` or `::1`; a non-loopback bind such as `0.0.0.0` fails configuration. `PI_KNOWLEDGE_TOKEN` is required by process configuration and must be at least 16 characters.

The initial dispatch envelope is intentionally narrow:

```json
{
  "protocolVersion": 1,
  "requestId": "caller-generated-id",
  "operation": "capabilities.get | workspace.echo",
  "input": null
}
```

Top-level unknown fields are rejected. `input` remains `unknown` at the envelope boundary and is validated only by the selected allowlisted operation. `workspace.echo` accepts only:

```text
projectId
workspaceId
workspacePath
workspaceLabel?
```

There is no URL, host, port, socket path, command, filesystem-read target, or arbitrary proxy destination in the contract.

`workspace.echo` is deliberately non-authoritative in P0-T03: it validates and echoes supplied test scope only. Host-authoritative scope injection is P0-T04 responsibility.

## Build/package integration

Updated:

- `tsconfig.build.json` to emit `src/knowledge/**`;
- `package.json` with `start:knowledge` and `pi-knowledge` bin entry;
- `knip.json` with the standalone process entry.

No PI WEB sessiond/server route is modified by P0-T03.

## Security / correctness invariants

- loopback-only configuration;
- token authentication required for health and dispatch;
- Browser receives no service port/token knowledge;
- exact initial operation allowlist;
- no arbitrary target/proxy input;
- malformed JSON/schema fail closed;
- incompatible protocol versions fail closed;
- request body bounded by Fastify body limit;
- serialized JSON response byte-bounded before send;
- stable error envelope and request-id correlation;
- no SQLite, arbitrary file reads, network proxying, models, or sessiond dependency in service code.

## Implementation corrections found during verification

Local verification exposed ordinary strict-type/lint issues before acceptance. They were fixed without lowering repository rules:

- Fastify error-handler `unknown` values are explicitly narrowed before reading `code` / `statusCode`;
- strict `restrict-template-expressions` findings were fixed with explicit numeric string conversion;
- no `eslint-disable`, unsafe assertion escape, or lint configuration weakening was introduced;
- recursive generic JSON validation was removed in favor of shallow operation-specific validation, avoiding unnecessary deep recursion while preserving the narrow allowlisted contract;
- response minimum bound remains 512 bytes so the structured fallback error itself can remain bounded;
- the focused app test includes a real loopback `listen` / authenticated `fetch` / `close` lifecycle without sessiond.

## Verification evidence

### Focused tests

Command:

```bash
npm test -- \
  src/knowledge/service/app.test.ts \
  src/knowledge/service/config.test.ts
```

Result:

```text
Test Files  2 passed (2)
Tests       14 passed (14)
```

**PASS.**

### Static/build/package gates

Locally executed after the strictness fixes:

```text
TypeScript: PASS
ESLint: PASS
Knip: PASS
Build: PASS
pack:dry: PASS
dist/knowledge/service/main.js: PASS
git diff --check against P0-T02 base: PASS
```

The earlier pre-fix TypeScript/build/lint failures are not acceptance evidence; they were diagnosed, corrected, and the final gates were rerun successfully.

### Full-suite regression

Final observed suite result:

```text
Test Files  1 failed | 373 passed (374)
Tests       1 failed | 3752 passed | 2 skipped (3755)
```

The sole failure is:

```text
src/server/sessions/piSessionService.promptQueue.test.ts
PiSessionService prompt, queue, and auth warnings
refreshes auth state and dedupes warnings when logout removes the current model's credentials
expected 1
received 0
```

This exact failure was independently reproduced on the P0-T01 baseline during P0-T02 acceptance and is therefore classified as **inherited**, not a P0-T03 regression. P0-T03 did not modify session/auth behavior to make the inherited test green.

P0-T03-attributable full-suite failures: **0**.

### Real standalone process acceptance

The repository verification script was executed locally against the built `dist/knowledge/service/main.js` entry and reported:

```text
P0-T03 REAL PROCESS ACCEPTANCE: PASS
```

The passing process acceptance covered:

- independent service start without PI WEB/sessiond;
- listener bound to `127.0.0.1:8515`;
- explicit rejection of `0.0.0.0` configuration;
- authenticated `/v1/health` and request-id correlation;
- `capabilities.get`;
- `workspace.echo`;
- missing-token rejection;
- wrong-token rejection;
- malformed-JSON rejection;
- malformed-schema rejection;
- arbitrary proxy-target rejection;
- unsupported-operation rejection;
- incompatible-protocol rejection with expected-version details;
- real request-byte-limit rejection;
- real response-byte-limit rejection on a secondary process configured to 512 bytes;
- SIGTERM/SIGINT clean shutdown;
- release of verification listener ports after stop.

**PASS.**

## Known limitations / next boundary

- GitHub Actions produced no workflow run/status record for this stacked PR; acceptance evidence is the executed local verification above, not source review.
- `workspace.echo` does not read PI WEB state and is not authoritative.
- No server-plugin → service adapter exists in P0-T03.
- No Browser → sessiond → service E2E exists in P0-T03.
- No persistence, ingestion, retrieval, model, or Notes behavior exists.
- Service lifecycle supervision/installation policy is outside this contract-skeleton task.
- The inherited `piSessionService.promptQueue` failure remains separate maintenance scope.

## Result

**PASS — the standalone authenticated loopback `pi-knowledge` contract/process boundary is implemented and accepted with focused tests, strict static/build/package gates, full-suite regression classification, and real-process start/listen/HTTP/limit/stop verification.**

P0-T04 was not started or mixed into this branch.

## Next task

P0-T04 — Thin server-plugin → `pi-knowledge` adapter.

P0-T04 may begin only as a separate task/branch after this P0-T03 acceptance record; its scope is the thin host-authoritative adapter, not persistence or heavy Knowledge processing.
