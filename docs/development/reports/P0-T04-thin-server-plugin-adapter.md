# P0-T04 — Thin server-plugin → pi-knowledge Adapter Report

## Task metadata

- **Task:** P0-T04
- **Phase:** P0 — Integration / security / process boundary
- **Date:** 2026-09-09
- **Branch:** `feat/p0-thin-knowledge-adapter`
- **Stacked base:** `chore/autonomous-development-policy` (PR #5)
- **Implementation dependency:** accepted P0-T03 standalone service contract (PR #4)
- **PR:** #6 — `feat: add thin server-plugin pi-knowledge adapter` (draft)
- **Status:** **PARTIAL**
- **P0-T05 implementation mixed into this branch:** no
- **Verification guide:** `docs/development/verification/P0-T04-thin-server-plugin-adapter.md`
- **Verification debt ledger:** `docs/development/VERIFICATION-DEBT.md`

## Objective

Replace the P0-T02 in-sessiond `knowledge.status` stub with a thin server-plugin adapter that forwards one bounded, authenticated, host-scoped request to the standalone P0-T03 `pi-knowledge` process.

The intended boundary is:

```text
Browser Knowledge Panel
→ existing pairedBackend request
→ host-owned PairedPluginRequestContext
→ Knowledge server plugin
→ authenticated loopback HTTP/JSON
→ standalone pi-knowledge
```

P0-T04 does not attempt the complete real Browser → sessiond → service E2E acceptance. That remains P0-T05.

## Delivered implementation

### Thin adapter client

Added:

```text
pi-web-plugins/knowledge/service-client.ts
```

The client:

- accepts only explicit loopback service hosts (`127.0.0.1` or `::1`);
- uses fixed `/v1/health` and `/v1/dispatch` endpoints;
- reads service host/port/token only in server-plugin code from `PI_KNOWLEDGE_*` environment variables;
- requires a non-trivial service token;
- generates a server-side request id;
- sends only the allowlisted P0-T03 operations known by this adapter;
- bounds serialized request bytes before network I/O;
- bounds response bytes while streaming, with an early `content-length` check when available;
- validates protocol version and request-id correlation;
- validates success/error envelope shape before returning a result;
- maps service-unavailable, timeout, remote rejection, protocol and size failures into adapter-local errors;
- never includes the configured service token in mapped errors;
- propagates the host request cancellation signal;
- applies a separate adapter deadline to the complete HTTP operation, including response-body streaming and parsing.

The adapter is not a generic proxy: the browser cannot provide a target URL, host, port, service operation, bearer token, or authoritative scope.

### Host-authoritative scope bridge

Updated:

```text
pi-web-plugins/knowledge/server-plugin.ts
```

`knowledge.status` now:

1. rejects unsupported browser operations;
2. requires browser input to remain null/empty;
3. derives Project / Workspace / Path only from host-owned `PairedPluginRequestContext`;
4. validates that `workspace.projectId` matches the host Project id;
5. sends that host-authoritative scope to `pi-knowledge` as the fixed `workspace.echo` operation;
6. forwards the host request `AbortSignal` to the service client;
7. accepts the service result only if every scope field exactly matches the host-authoritative scope and no extra result field is present;
8. returns the existing browser-facing status shape only after that check succeeds.

The service response therefore cannot become a new source of Workspace authority.

Plugin health is also connected to authenticated `pi-knowledge` health. Service failure produces a bounded server-plugin health message and adapter error code without exposing credentials.

## Architectural decisions

1. **Keep the browser contract unchanged.** P0-T04 does not add service connection data or authoritative Workspace fields to browser input.
2. **Keep the adapter operation-specific.** `knowledge.status` always maps to `workspace.echo`; the browser cannot select an arbitrary `pi-knowledge` operation.
3. **Keep service configuration server-only.** `PI_KNOWLEDGE_HOST`, `PI_KNOWLEDGE_PORT`, and `PI_KNOWLEDGE_TOKEN` are read only by the server-plugin adapter.
4. **Fail closed on service address.** Only IPv4/IPv6 loopback literals are accepted; there is no arbitrary URL configuration.
5. **Preserve host authority after the round trip.** An echo mismatch is an adapter failure rather than accepted scope.
6. **Bound both directions independently.** The adapter enforces its own request/response limits in addition to the service limits.
7. **Cover the full HTTP operation with cancellation/deadline.** The timeout is not cleared after headers; it remains active through response reading and JSON parsing.
8. **Do not create a shared RPC framework.** The client is intentionally small and Knowledge-specific.
9. **Do not import service source files into emitted plugin runtime code.** Bundled plugins are transpiled into `dist/pi-web-plugins/**`; runtime relative imports outside that tree would be incorrect. The small wire constants are mirrored in the plugin client and guarded by a focused parity test against the canonical P0-T03 constants.

## Security / correctness invariants

- Browser input cannot override Project/Workspace identity.
- Browser never learns the service token.
- Browser never chooses service host/port or HTTP path.
- Browser never chooses the service operation used by `knowledge.status`.
- Service host is loopback-only.
- Service token is required and never included in mapped error text.
- Host Project/Workspace mismatch is rejected before contacting the service.
- Unsupported browser operations are rejected before contacting the service.
- Oversized adapter requests are rejected before fetch.
- Oversized responses are cancelled/rejected before unbounded buffering.
- Protocol/version/request-id mismatch fails closed.
- Service scope mismatch or extra fields fail closed.
- Caller cancellation is propagated.
- Adapter timeout covers response streaming as well as connection/header latency.
- No document parsing, persistence, retrieval, embedding, model invocation, or heavy Knowledge work runs in sessiond.

## Focused tests written

### `server-plugin.test.ts`

Six focused tests cover:

- host-authoritative scope dispatch to `workspace.echo`;
- exact preservation of the host request signal;
- browser-authored scope rejection before service contact;
- host project/workspace mismatch rejection before service contact;
- unsupported browser operation rejection before service contact;
- mismatched service scope rejection;
- pre-aborted host cancellation rejection before service contact.

(The first test covers both dispatch and signal preservation.)

### `service-client.test.ts`

Nine focused tests cover:

- adapter/service wire-default parity;
- authenticated client calls against a real P0-T03 Fastify app listening on a random loopback port;
- real `health` and `workspace.echo` response handling;
- wrong-token structured rejection and no token disclosure;
- non-loopback configuration rejection;
- required server-side token;
- adapter request-size rejection before fetch;
- adapter response-size rejection before buffering;
- host cancellation propagation;
- adapter deadline mapping.

The expected focused count for these two files is **15 tests**.

## Static/build review performed in the autonomous environment

Source-level review checked the new code against the repository's strict TypeScript/ESLint configuration, including:

```text
strict
noUncheckedIndexedAccess
exactOptionalPropertyTypes
noImplicitReturns
@typescript-eslint/strict-boolean-expressions
@typescript-eslint/no-unnecessary-condition
@typescript-eslint/no-unsafe-*
@typescript-eslint/consistent-type-assertions: never
@typescript-eslint/restrict-template-expressions
@typescript-eslint/no-floating-promises
```

The plugin build path was also reviewed: `tsconfig.plugins.json` includes `pi-web-plugins/**/*.ts`, and `scripts/build-plugins.mjs` transpiles non-test plugin TypeScript files while preserving their relative plugin-local graph, so `service-client.ts` is emitted beside `server-plugin.js`.

This review is not substituted for actual execution evidence.

## Verification state

**PARTIAL.** Required executable evidence is deferred under the autonomous-development policy.

The current ChatGPT execution environment does not have a runnable checkout/dependency tree for this repository, and GitHub has not supplied CI evidence for the task branch. Therefore the following must not be described as passing yet:

```text
focused 15 tests
typecheck
ESLint
knip
production build
package dry-run
full-suite regression
real local server-plugin → standalone-service acceptance
```

The exact deferred checks are recorded in the verification guide and `VERIFICATION-DEBT.md`.

## Assumptions used for continued P0-T05 development

Later P0 work may proceed against these documented contracts while P0-T04 remains PARTIAL:

- P0-T03 protocol v1 and `workspace.echo` contract remain stable;
- PI WEB continues to provide cloned/frozen host-owned Project/Workspace context and request-scoped `AbortSignal` to the paired server plugin;
- the local PI WEB/sessiond process and `pi-knowledge` process can be launched with the same `PI_KNOWLEDGE_TOKEN` environment value;
- Browser `knowledge.status` input remains null/empty;
- selected-Machine routing remains owned by existing PI WEB paired-backend/federation infrastructure.

P0-T05 must test the real integrated path and may expose integration defects that require a P0-T04 follow-up commit. Such defects do not justify widening the adapter into a generic proxy.

## Out of scope / not delivered

- Browser → sessiond → service E2E acceptance (P0-T05);
- selected-Machine/Fleet semantics acceptance (P0-T06);
- service lifecycle supervision/install policy;
- SQLite/persistence;
- ingestion/parsing;
- retrieval/RAG/embeddings;
- Notes;
- model/Pi SDK runtime.

## Result

**PARTIAL — the P0-T04 thin adapter implementation, focused tests, security boundaries, and verification procedure are present, but actual repository static/test/build execution and real local adapter acceptance remain deferred verification debt.**

Under the autonomous-development policy, P0-T05 implementation may proceed on a separate stacked branch without converting P0-T04 to PASS.
