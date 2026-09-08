# P0-T03 — Standalone pi-knowledge Service Report

## Task metadata

- **Task:** P0-T03
- **Phase:** P0 — Integration / security / process boundary
- **Date:** 2026-09-09
- **Branch:** `feat/p0-standalone-pi-knowledge-service`
- **Stacked base:** `feat/p0-knowledge-plugin-skeleton` at `4a3536977aa379fd9dbd97d175c39b94536d74f8`
- **PR:** #4 — `feat: add standalone pi-knowledge service skeleton` (draft)
- **Status:** **PARTIAL**
- **P0-T04 started:** no
- **Human verification guide:** `docs/development/verification/P0-T03-standalone-pi-knowledge-service.md`

## Objective

Introduce a real standalone `pi-knowledge` process boundary with a small authenticated loopback HTTP/JSON contract, without implementing persistent Knowledge behavior or changing PI WEB's existing Machine / Project / Workspace / Session ownership.

The task proves only the service process and protocol boundary:

```text
local caller
→ authenticated loopback HTTP/JSON
→ standalone pi-knowledge process
→ bounded allowlisted dispatch
```

It does **not** prove the Browser → sessiond → `pi-knowledge` chain. That remains P0-T04/P0-T05 scope.

## Scope

Implemented in P0-T03:

- independent `pi-knowledge` process entry;
- explicit loopback-only bind configuration;
- bearer-token authentication;
- protocol version `1`;
- `GET /v1/health`;
- `POST /v1/dispatch`;
- operation allowlist:
  - `capabilities.get`;
  - `workspace.echo`;
- caller request id on dispatch plus server request ids for pre-dispatch failures/health;
- stable structured success/error envelopes;
- bounded request body;
- bounded serialized response;
- malformed JSON rejection;
- malformed schema rejection;
- unsupported operation rejection;
- incompatible protocol rejection;
- rejection of extra target/proxy fields;
- build/bin/package entry for `pi-knowledge`;
- focused contract/config tests.

Explicitly not implemented:

- P0-T04 server-plugin adapter;
- Browser access to `pi-knowledge`;
- SQLite or any persistence;
- ingestion/parsing;
- retrieval/RAG;
- embeddings;
- Notes;
- model/LLM calls;
- Pi SDK restricted runtime;
- Redis/RabbitMQ/Kafka;
- general RPC/framework abstraction.

## Changes

### Contract boundary

Added `src/knowledge/contracts/` containing:

- protocol/service constants and transport limits;
- exact initial operation allowlist;
- dispatch-envelope and operation-specific schema validation;
- stable error codes and `KnowledgeServiceError`.

The dispatch request shape is deliberately narrow:

```json
{
  "protocolVersion": 1,
  "requestId": "caller-generated-id",
  "operation": "capabilities.get | workspace.echo",
  "input": null
}
```

Top-level fields outside this envelope are rejected. The generic envelope leaves `input` as `unknown`; each allowlisted operation validates its own exact input contract. `workspace.echo` accepts only:

```text
projectId
workspaceId
workspacePath
workspaceLabel?
```

There is no URL, host, port, socket path, command, filesystem-read target, or arbitrary proxy destination in the contract.

### Standalone service

Added `src/knowledge/service/`:

- `main.ts` — process entry, config load, listen, SIGINT/SIGTERM close;
- `app.ts` — Fastify app, authentication, endpoints, error mapping, request/response bounds;
- `config.ts` — loopback/token/port/limit configuration;
- `health.ts` — health payload;
- `dispatch.ts` — allowlisted operation dispatch.

Default transport configuration:

```text
host: 127.0.0.1
port: 8515
max request: 64 KiB
max response: 64 KiB
```

`PI_KNOWLEDGE_HOST` is restricted to explicit `127.0.0.1` or `::1`; non-loopback binds such as `0.0.0.0` fail configuration.

`PI_KNOWLEDGE_TOKEN` is required by the process configuration and must contain at least 16 characters. The token is not logged.

### Build/package integration

Updated:

- `tsconfig.build.json` to emit `src/knowledge/**`;
- `package.json` with `start:knowledge` and `pi-knowledge` bin entry;
- `knip.json` with the standalone service entry point.

No PI WEB sessiond/server route is modified by this task.

## Files

Added:

```text
src/knowledge/contracts/protocol.ts
src/knowledge/contracts/operations.ts
src/knowledge/contracts/schemas.ts
src/knowledge/contracts/errors.ts
src/knowledge/service/main.ts
src/knowledge/service/app.ts
src/knowledge/service/config.ts
src/knowledge/service/health.ts
src/knowledge/service/dispatch.ts
src/knowledge/service/app.test.ts
src/knowledge/service/config.test.ts
docs/development/reports/P0-T03-standalone-pi-knowledge-service.md
docs/development/verification/P0-T03-standalone-pi-knowledge-service.md
```

Modified:

```text
package.json
tsconfig.build.json
knip.json
```

Task-status documentation is also updated separately as P0-T03 progresses.

## Architecture decisions

1. **Reuse Fastify already present in the repository.** No new transport dependency or RPC framework is introduced.
2. **Keep the process under `src/knowledge/`, not `src/server/`.** The service is part of the same Git repository but has a distinct process boundary.
3. **Make the build boundary explicit.** `tsconfig.build.json` now emits Knowledge service files so the process is not development-only.
4. **Require service authentication.** Both health and dispatch are behind the bearer-token boundary; loopback alone is not treated as authentication.
5. **Fail closed on bind address.** Configuration accepts only explicit IPv4/IPv6 loopback addresses.
6. **Reject unknown protocol fields.** The initial contract is deliberately not an extensible generic proxy envelope.
7. **Keep dispatch input operation-scoped.** The envelope carries `input: unknown`; only the selected allowlisted operation interprets and validates it. No recursive generic JSON/RPC schema layer is introduced.
8. **Keep Workspace authority outside P0-T03.** `workspace.echo` validates and echoes supplied scope data but does not claim that data is authoritative. P0-T04 will be responsible for constructing it from `PairedPluginRequestContext`.
9. **Bound serialized responses before sending.** Response limiting is enforced on UTF-8 JSON bytes rather than relying on operation-specific assumptions.
10. **Preserve stable structured failures.** Authentication, parse, schema, operation, version, size and not-found errors use the same envelope and request-id correlation behavior.
11. **Do not touch inherited session/auth behavior.** The P0-T02 baseline `piSessionService.promptQueue` failure remains unrelated maintenance scope.

## Security / correctness invariants

- Default bind is `127.0.0.1`.
- Configured bind cannot be `0.0.0.0` or another non-loopback address.
- Service startup requires a non-trivial token.
- Missing/wrong bearer tokens are rejected before dispatch.
- Browser code is not changed and receives no service port/token knowledge.
- Only `capabilities.get` and `workspace.echo` are accepted.
- Unknown request fields are rejected.
- Operation input is validated only by the selected allowlisted operation.
- `workspace.echo` cannot carry an arbitrary proxy target.
- Malformed JSON and malformed schema fail closed.
- Protocol versions other than `1` fail closed.
- Request bodies are bounded by Fastify `bodyLimit`.
- Serialized JSON responses are byte-bounded before send.
- Response-limit fallback remains a structured error envelope.
- Dispatch request ids are returned for valid dispatch envelopes; failures before a valid envelope use the server request id.
- Service code does not open SQLite, read arbitrary files, perform network proxying, invoke models, or depend on sessiond.

## Automated verification

### Coverage added

`src/knowledge/service/app.test.ts` covers:

1. authenticated health response;
2. `capabilities.get`;
3. `workspace.echo`;
4. missing/wrong token rejection;
5. malformed JSON rejection and stable error envelope;
6. malformed schema rejection;
7. arbitrary proxy-target field rejection;
8. unsupported operation rejection;
9. incompatible protocol rejection;
10. request byte-limit enforcement;
11. response byte-limit enforcement.

`src/knowledge/service/config.test.ts` covers:

- default loopback bind;
- explicit IPv6 loopback;
- non-loopback bind rejection;
- required/minimum token;
- configured port and byte-limit validation, including minimum request/response bounds.

### Execution state

**Not yet counted as PASS.**

The ChatGPT execution container available for this task cannot resolve `github.com`, so it cannot clone the branch or install the repository dependency tree. A draft stacked PR (#4) was created specifically to trigger repository CI, but as of this report GitHub exposes **no workflow run/status record** for the P0-T03 head, matching the no-run behavior previously observed on PR #3.

Therefore the following are **written but not yet evidenced as passing**:

```text
focused P0-T03 tests
typecheck
ESLint
knip
production build
package dry-run/full-suite regression
```

This report intentionally does not convert source review into test evidence.

### Source-level review corrections already made

A strict-rule review against `eslint.config.js` found and corrected ordinary type assertions that would violate:

```text
@typescript-eslint/consistent-type-assertions: assertionStyle never
```

The same strict-lint review removed unnecessary `async` Fastify handlers/hooks while keeping `buildKnowledgeApp()` genuinely asynchronous through `app.ready()`.

A response-boundary review found that a 256-byte minimum response configuration could be smaller than the structured fallback error when a maximum-length request id is present. The service/config minimum response limit was raised to 512 bytes, the fallback status normalized to HTTP 500, and the configured lower bounds were added to focused tests.

A follow-up `stylisticTypeChecked` review found that a recursive index-signature JSON type would either violate the repository's preferred `Record` style or become a TypeScript circular type alias when mechanically converted. The generic recursive JSON abstraction was removed instead. Dispatch keeps `input` as `unknown` and validates it only inside each allowlisted operation, which is both simpler and closer to the intended narrow contract.

These are implementation corrections, not substitutes for executing ESLint/tests.

## Manual verification

**Pending.**

Real-process verification must still demonstrate on a developer machine:

- standalone start without PI WEB sessiond;
- default loopback listener;
- authenticated health;
- both operations;
- auth/schema/version/unsupported negative cases;
- real request and response limit behavior;
- clean SIGINT/SIGTERM stop.

Exact commands are in the Human Verification Guide.

## Known limitations

- P0-T03 has not yet received actual local automated/static/build evidence.
- GitHub Actions has not produced a workflow run for PR #4 at the time of this report.
- Real process start/stop/listener behavior is not yet manually accepted.
- `workspace.echo` is intentionally non-authoritative; it does not read PI WEB state.
- No server-plugin → service adapter exists yet; P0-T04 is not started.
- No Browser → sessiond → service E2E exists yet; P0-T05 is not started.
- No persistence, ingestion, retrieval, model or Notes behavior exists.
- Service lifecycle supervision/installation policy is outside this contract skeleton task.
- The inherited P0-T02/P0-T01 `src/server/sessions/piSessionService.promptQueue.test.ts` compatibility failure remains unrelated and must not be patched inside P0-T03.

## Result

**PARTIAL — implementation and repository contract/test skeleton are present, but required automated/static/build and real-process verification evidence is still outstanding.**

P0-T03 must not be declared PASS until the verification guide has been run and the actual results are recorded here.

## Next task

Finish P0-T03 verification and documentation closure only.

**Do not begin P0-T04 until P0-T03 is formally accepted as PASS.**
