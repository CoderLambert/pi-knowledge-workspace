# Deferred Verification Debt

This ledger tracks acceptance checks that autonomous development cannot execute because they require the user's local environment or another unavailable capability.

The authoritative execution policy is `docs/development/AUTONOMOUS-EXECUTION.md`.

## Rules

- Missing local/manual evidence keeps the originating task `PARTIAL` when that evidence is required for PASS.
- Verification debt does not by itself stop later implementation.
- Later tasks must document assumptions when they consume an unverified contract.
- Each task remains isolated in its own branch/PR.
- A phase/release gate cannot be declared PASS while required debt for that gate remains unresolved.
- When evidence is later supplied, update this ledger, the task report, plan/changelog status, and PR description.

## Open debt

### P0-T04 — Thin server-plugin adapter acceptance

- **Task status:** PARTIAL
- **Branch:** `feat/p0-thin-knowledge-adapter`
- **PR:** #6
- **Debt status:** OPEN
- **Why deferred:** the autonomous execution environment can edit/review GitHub but does not have a runnable repository checkout/dependency tree, GitHub has not supplied task CI evidence, and the real PI WEB/sessiond → standalone-service acceptance requires the user's local runtime environment.
- **Required verification:**
  1. Run the focused P0-T04 adapter suite: `npm test -- pi-web-plugins/knowledge/server-plugin.test.ts pi-web-plugins/knowledge/service-client.test.ts` and record the exact count (expected 15).
  2. Run `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run build`, and `npm run pack:dry`.
  3. Confirm `dist/pi-web-plugins/knowledge/server-plugin.js` and `dist/pi-web-plugins/knowledge/service-client.js` are emitted.
  4. Run `git diff --check origin/chore/autonomous-development-policy...HEAD`.
  5. Run the full test suite and confirm any failure is only the already classified inherited `src/server/sessions/piSessionService.promptQueue.test.ts` assertion unless a new P0-T04 defect is found.
  6. Start standalone `pi-knowledge` and PI WEB/sessiond with the same server-side `PI_KNOWLEDGE_TOKEN`; confirm `knowledge.status` traverses the real server-plugin adapter and returns host-authoritative Project/Workspace/Path.
  7. Confirm service unavailable, wrong token and protocol mismatch fail closed without a false `ready` result or credential disclosure.
  8. Confirm cancellation/deadline behavior and that browser code contains no `pi-knowledge` token/host/port authority.
- **Expected PASS evidence:** focused/static/build/package gates pass; real server-plugin → service call authenticates and returns exact host scope; negative cases fail explicitly; no new task-attributable full-suite failures; no service credential or connection authority reaches browser code.
- **Assumptions used for continued development:** P0-T03 protocol v1 and `workspace.echo` remain stable; `PairedPluginRequestContext` Project/Workspace/signal remain host-owned; sessiond and `pi-knowledge` can share `PI_KNOWLEDGE_TOKEN` through server-side environment configuration; the browser continues to call `knowledge.status` with null/empty input; existing PI WEB paired-backend/federation routing remains authoritative.
- **Dependent tasks:** P0-T05, P0-T06
- **Resolution:** pending user verification; P0-T05/P0-T06 may proceed against the documented contract under the autonomous-development policy.

P0-T03 is already fully accepted and remains PASS.

## Entry template

```markdown
### <TASK-ID> — <short verification name>

- **Task status:** PARTIAL
- **Branch:** `<branch>`
- **PR:** #<number>
- **Debt status:** OPEN
- **Why deferred:** <capability unavailable to automation>
- **Required verification:**
  1. <exact step>
  2. <exact step>
- **Expected PASS evidence:** <observable result/log/UI state>
- **Assumptions used for continued development:** <documented contract or assumption>
- **Dependent tasks:** <task ids or none>
- **Resolution:** pending user verification
```

## Resolved debt

Move completed entries here with the date, supplied evidence, and resulting task-status change.