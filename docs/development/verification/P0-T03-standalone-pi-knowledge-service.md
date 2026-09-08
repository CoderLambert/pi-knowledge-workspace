# P0-T03 — Standalone pi-knowledge Service Verification Guide

## Purpose

Verify only the P0-T03 standalone `pi-knowledge` process and HTTP/JSON contract.

This guide does **not** verify the Browser → PI WEB sessiond → `pi-knowledge` adapter path. Do not start P0-T04/P0-T05 validation here.

## PASS criteria

P0-T03 passes only if all of the following are observed:

- focused Knowledge service tests pass;
- TypeScript passes;
- ESLint passes;
- knip passes;
- production build passes and emits the `pi-knowledge` entry;
- full-suite result has no new P0-T03 regression beyond the already classified inherited session/auth baseline failure;
- service starts without PI WEB sessiond;
- default listener is loopback-only;
- authenticated health succeeds;
- `capabilities.get` succeeds;
- `workspace.echo` succeeds;
- missing/wrong token is rejected;
- malformed JSON/schema is rejected;
- unsupported operation is rejected;
- incompatible protocol is rejected;
- request and response byte limits are enforced;
- service stops cleanly.

Any required check not actually run means the task remains **PARTIAL**.

---

## 1. Prerequisite

Use the P0-T03 branch:

```bash
git fetch origin
git switch feat/p0-standalone-pi-knowledge-service
git pull --ff-only
```

Confirm:

```bash
git status --short --branch
```

Expected branch:

```text
feat/p0-standalone-pi-knowledge-service
```

Install the repository dependencies if needed:

```bash
npm ci
```

No PI WEB web server, sessiond, browser, SQLite service, model provider, or external Knowledge service is required for the focused service tests.

---

## 2. Automated/static/build verification

Run the focused P0-T03 tests first:

```bash
npm test -- \
  src/knowledge/service/app.test.ts \
  src/knowledge/service/config.test.ts
```

Expected focused result:

```text
14 tests passed
```

Then run the repository gates separately so the inherited baseline test does not hide which gate failed:

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Expected:

```text
typecheck   PASS
ESLint      PASS
knip        PASS
build       PASS
pack:dry    PASS
```

Confirm the build emitted the independent process entry:

```bash
test -f dist/knowledge/service/main.js && echo "pi-knowledge dist entry: PASS"
```

Expected:

```text
pi-knowledge dist entry: PASS
```

Run the full suite:

```bash
npm test
```

P0-T02 acceptance already classified this pre-existing failure as inherited from the P0-T01 baseline:

```text
src/server/sessions/piSessionService.promptQueue.test.ts
expected 1
received 0
```

Do **not** modify session/auth behavior to make this unrelated test green.

For P0-T03 acceptance, the full suite must show no new failures attributable to `src/knowledge/**` or the P0-T03 build/package changes. If the only failure is still the same inherited promptQueue test, record its exact counts and continue.

Also run:

```bash
git diff --check origin/feat/p0-knowledge-plugin-skeleton...HEAD
```

Expected: no output.

---

## 3. Start the standalone process

Choose a local verification token of at least 16 characters:

```bash
export PI_KNOWLEDGE_TOKEN='p0-t03-local-verification-token-32'
```

Start only `pi-knowledge`:

```bash
npm run start:knowledge
```

Expected startup behavior:

- process remains running;
- Fastify reports a listener on `127.0.0.1:8515` by default;
- no PI WEB sessiond startup is required;
- no SQLite/database/model startup occurs.

Keep this terminal open.

---

## 4. Confirm loopback-only listener

In a second terminal:

```bash
ss -ltnp | grep ':8515'
```

Expected listener address contains:

```text
127.0.0.1:8515
```

FAIL if the listener is exposed as:

```text
0.0.0.0:8515
```

or another non-loopback address.

Configuration must also fail closed for a non-loopback bind. In a separate terminal, without stopping the main verification process, run on another port/address attempt:

```bash
PI_KNOWLEDGE_TOKEN="$PI_KNOWLEDGE_TOKEN" \
PI_KNOWLEDGE_HOST='0.0.0.0' \
PI_KNOWLEDGE_PORT=8516 \
npm run start:knowledge
```

Expected: process exits with a configuration error stating that the host must be `127.0.0.1` or `::1`.

---

## 5. Health check

```bash
curl -sS -i \
  -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
  http://127.0.0.1:8515/v1/health
```

Expected:

```text
HTTP/1.1 200
```

Body contains at least:

```json
{
  "ok": true,
  "service": "pi-knowledge",
  "serviceVersion": "0.1.0",
  "protocolVersion": 1,
  "status": "healthy"
}
```

The body must contain `requestId`, and the response must contain the matching `x-request-id` header.

---

## 6. capabilities.get

```bash
curl -sS -i \
  -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "protocolVersion": 1,
    "requestId": "verify-capabilities-1",
    "operation": "capabilities.get",
    "input": null
  }' \
  http://127.0.0.1:8515/v1/dispatch
```

Expected HTTP 200 and result containing:

```json
{
  "operations": ["capabilities.get", "workspace.echo"],
  "protocolVersion": 1
}
```

The response `requestId` and `x-request-id` header must both equal:

```text
verify-capabilities-1
```

---

## 7. workspace.echo

```bash
curl -sS -i \
  -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "protocolVersion": 1,
    "requestId": "verify-echo-1",
    "operation": "workspace.echo",
    "input": {
      "projectId": "project-verification",
      "workspaceId": "workspace-verification",
      "workspacePath": "/tmp/pi-knowledge-verification",
      "workspaceLabel": "verification"
    }
  }' \
  http://127.0.0.1:8515/v1/dispatch
```

Expected HTTP 200 and exact echo of the four input scope fields.

Important: this proves only the standalone contract. These values are test input, not PI WEB authoritative scope. Authority injection is P0-T04 scope.

---

## 8. Authentication negative checks

### No token

```bash
curl -sS -i \
  http://127.0.0.1:8515/v1/health
```

Expected:

```text
HTTP/1.1 401
AUTH_REQUIRED
```

### Wrong token

```bash
curl -sS -i \
  -H 'Authorization: Bearer definitely-wrong-token' \
  http://127.0.0.1:8515/v1/health
```

Expected:

```text
HTTP/1.1 401
AUTH_INVALID
```

Both responses must use the structured error envelope:

```json
{
  "ok": false,
  "protocolVersion": 1,
  "requestId": "...",
  "error": {
    "code": "...",
    "message": "..."
  }
}
```

---

## 9. Malformed JSON

```bash
printf '{"protocolVersion":' | \
  curl -sS -i \
    -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @- \
    http://127.0.0.1:8515/v1/dispatch
```

Expected:

```text
HTTP/1.1 400
MALFORMED_JSON
```

---

## 10. Malformed schema

Missing `input`:

```bash
curl -sS -i \
  -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "protocolVersion": 1,
    "requestId": "verify-schema-1",
    "operation": "workspace.echo"
  }' \
  http://127.0.0.1:8515/v1/dispatch
```

Expected:

```text
HTTP/1.1 400
INVALID_REQUEST
```

Arbitrary proxy target field:

```bash
curl -sS -i \
  -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "protocolVersion": 1,
    "requestId": "verify-no-proxy-1",
    "operation": "workspace.echo",
    "input": {
      "projectId": "project-verification",
      "workspaceId": "workspace-verification",
      "workspacePath": "/tmp/pi-knowledge-verification",
      "targetUrl": "http://127.0.0.1:9999"
    }
  }' \
  http://127.0.0.1:8515/v1/dispatch
```

Expected:

```text
HTTP/1.1 400
INVALID_REQUEST
```

---

## 11. Unsupported operation

```bash
curl -sS -i \
  -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "protocolVersion": 1,
    "requestId": "verify-unsupported-1",
    "operation": "proxy.fetch",
    "input": null
  }' \
  http://127.0.0.1:8515/v1/dispatch
```

Expected:

```text
HTTP/1.1 400
UNSUPPORTED_OPERATION
```

---

## 12. Incompatible protocol version

```bash
curl -sS -i \
  -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "protocolVersion": 2,
    "requestId": "verify-version-1",
    "operation": "capabilities.get",
    "input": null
  }' \
  http://127.0.0.1:8515/v1/dispatch
```

Expected:

```text
HTTP/1.1 409
INCOMPATIBLE_PROTOCOL_VERSION
```

Error details should report:

```json
{
  "expectedProtocolVersion": 1
}
```

---

## 13. Request size limit

The default request body limit is 64 KiB. Generate an authenticated JSON request larger than that limit:

```bash
python3 - <<'PY' | \
  curl -sS -i \
    -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @- \
    http://127.0.0.1:8515/v1/dispatch
import json
print(json.dumps({
    "protocolVersion": 1,
    "requestId": "verify-large-request",
    "operation": "capabilities.get",
    "input": None,
    "padding": "x" * 70000,
}))
PY
```

Expected:

```text
HTTP/1.1 413
REQUEST_TOO_LARGE
```

The body-size rejection must happen before schema handling; do not accept the oversized request and then return only `INVALID_REQUEST`.

---

## 14. Response size limit

The default operations produce small responses, so launch a second standalone process with a deliberately small response bound while keeping a normal request bound:

```bash
PI_KNOWLEDGE_TOKEN="$PI_KNOWLEDGE_TOKEN" \
PI_KNOWLEDGE_PORT=8516 \
PI_KNOWLEDGE_MAX_REQUEST_BYTES=4096 \
PI_KNOWLEDGE_MAX_RESPONSE_BYTES=512 \
npm run start:knowledge
```

Keep that process running, then in another terminal:

```bash
python3 - <<'PY' | \
  curl -sS -i \
    -H "Authorization: Bearer $PI_KNOWLEDGE_TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @- \
    http://127.0.0.1:8516/v1/dispatch
import json
print(json.dumps({
    "protocolVersion": 1,
    "requestId": "verify-large-response",
    "operation": "workspace.echo",
    "input": {
        "projectId": "project-verification",
        "workspaceId": "workspace-verification",
        "workspacePath": "/" + "x" * 768,
    },
}))
PY
```

Expected:

```text
HTTP/1.1 500
RESPONSE_TOO_LARGE
```

The returned error body must itself be no larger than 512 bytes.

Stop the secondary port-8516 process with `Ctrl-C` after this check.

---

## 15. Stop the primary standalone process

Return to the original `npm run start:knowledge` terminal and press:

```text
Ctrl-C
```

Expected:

- process exits;
- shutdown log indicates SIGINT;
- port 8515 is no longer listening.

Confirm:

```bash
ss -ltnp | grep ':8515' || echo 'pi-knowledge stopped: PASS'
```

Expected:

```text
pi-knowledge stopped: PASS
```

This verifies independent process stop behavior without shutting down PI WEB because PI WEB was never required for this task.

---

## 16. PASS / FAIL record

Record the actual results, not only the commands:

```text
Focused P0-T03 tests: PASS / FAIL — exact count
TypeScript: PASS / FAIL
ESLint: PASS / FAIL
Knip: PASS / FAIL
Build: PASS / FAIL
pack:dry: PASS / FAIL
Full suite: PASS / FAIL — exact pass/fail/skip counts and inherited promptQueue status
Independent start: PASS / FAIL
Loopback-only bind: PASS / FAIL
Non-loopback config rejection: PASS / FAIL
Health: PASS / FAIL
capabilities.get: PASS / FAIL
workspace.echo: PASS / FAIL
No-token rejection: PASS / FAIL
Wrong-token rejection: PASS / FAIL
Malformed JSON rejection: PASS / FAIL
Malformed schema rejection: PASS / FAIL
No arbitrary proxy target: PASS / FAIL
Unsupported operation rejection: PASS / FAIL
Protocol-version rejection: PASS / FAIL
Request limit: PASS / FAIL
Response limit: PASS / FAIL
Clean stop: PASS / FAIL
```

P0-T03 can be changed from **PARTIAL** to **PASS** only when every required P0-T03 row above passes and any full-suite failure is confirmed to be only the already inherited baseline failure.

---

## Troubleshooting

### `PI_KNOWLEDGE_TOKEN is required`

Set a token of at least 16 characters:

```bash
export PI_KNOWLEDGE_TOKEN='p0-t03-local-verification-token-32'
```

### Port 8515 already in use

Identify the process:

```bash
ss -ltnp | grep ':8515'
```

Stop the stale P0-T03 service, or use a temporary explicit loopback port:

```bash
PI_KNOWLEDGE_PORT=18515 npm run start:knowledge
```

If a temporary port is used, substitute that port in every curl command and record it in the report.

### Non-loopback host fails to start

That is expected. P0-T03 intentionally permits only:

```text
127.0.0.1
::1
```

Do not weaken this validation to make `0.0.0.0` work.

### Full suite still has the promptQueue failure

Compare the failing test name and assertion with the P0-T02 report. If it is the same inherited:

```text
src/server/sessions/piSessionService.promptQueue.test.ts
expected 1
received 0
```

record it as inherited. Do not patch session/auth logic inside P0-T03.

### `workspace.echo` values are not a real PI WEB workspace

Expected for P0-T03. This operation proves only the service contract. P0-T04 will supply host-authoritative scope from the Knowledge server plugin.

---

## Cleanup

Ensure both verification processes are stopped:

```bash
ss -ltnp | grep -E ':8515|:8516' || true
```

Unset temporary service configuration if desired:

```bash
unset PI_KNOWLEDGE_TOKEN
unset PI_KNOWLEDGE_HOST
unset PI_KNOWLEDGE_PORT
unset PI_KNOWLEDGE_MAX_REQUEST_BYTES
unset PI_KNOWLEDGE_MAX_RESPONSE_BYTES
```

No database, index, cache, model artifact, PI WEB Workspace state, or Knowledge persistent data is created by P0-T03.
