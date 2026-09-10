# P0-T07 — Restricted Pi Runtime Probe Verification

Status: **PARTIAL**

## Automated verification

Run from the repository root:

```bash
npm test -- src/knowledge/runtime/restrictedPiRuntime.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/test/p0-selected-machine-federation-routing...HEAD
git diff --name-status origin/test/p0-selected-machine-federation-routing...HEAD
```

Expected focused evidence:

- both restricted-runtime tests pass;
- active tool names equal exactly `knowledge_sources`, `knowledge_search`, `knowledge_read`, `submit_answer`;
- `bash`, `read`, `write`, `edit`, `grep`, `find`, and `ls` are absent;
- seeded AGENTS/extension/skill/prompt resources report zero discovery;
- no new task-attributable full-suite failures appear.

The known inherited `src/server/sessions/piSessionService.promptQueue.test.ts` baseline failure must not be patched in this task merely to make the full suite green.

## Static inspection

Confirm the runtime factory explicitly uses:

- in-memory settings;
- in-memory session;
- in-memory credential store;
- `modelsPath: null`;
- model network refresh disabled;
- resource discovery disabled;
- explicit four-tool allowlist.

## Scope verification

Direct-base diff must contain only P0-T07 runtime probe/test and its task records. It must contain no P0-T08 gate implementation, retrieval/database work, Machine/Fleet routing change, browser route change, or production provider credential plumbing.

## PASS evidence

P0-T07 may become PASS when focused/static/build/package checks are green and the executable probe proves the four-tool surface plus zero project/global resource discovery. If a Pi SDK version change alters this contract, update the implementation intentionally rather than weakening the assertions.
