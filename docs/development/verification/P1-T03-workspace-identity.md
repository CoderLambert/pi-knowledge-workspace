# P1-T03 verification — Knowledge installation / Workspace identity

Status: **OPEN / PARTIAL**

## Automated gates

```bash
npm test -- src/knowledge/storage/workspaceIdentity.test.ts
npm test -- src/knowledge/storage/database.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Expected focused result: 3 P1-T03 tests pass; P1-T02 dependency tests also pass. Classify inherited baseline failures without patching them in this task.

## Real persistence acceptance

After completing P1-T02 driver/lockfile setup:

1. open one file-backed Knowledge DB;
2. resolve the same Workspace path twice and confirm installation/workspace IDs are identical;
3. restart the process, reopen the DB and confirm both IDs remain identical;
4. resolve two actual Git worktree directories and confirm one installation ID but distinct Knowledge Workspace IDs;
5. change only the external PI WEB/Machine binding and confirm the Knowledge Workspace ID does not change;
6. resolve a symlink/lexical alias to the same directory and confirm canonical realpath prevents duplicate identity.

## Scope check

```bash
git diff --check origin/feat/p1-database-bootstrap-migrations...HEAD
git diff --name-status origin/feat/p1-database-bootstrap-migrations...HEAD
```

Only P1-T03 identity implementation/tests/docs/bookkeeping belong in this diff. No migration changes, blob store, source domain, ingestion, retrieval, UI or Fleet changes.

## PASS evidence

Focused/static/build/package checks pass and a real file DB proves identity survives process restart, realpath aliases collapse to one identity, worktrees remain isolated, and external routing metadata can rebind without identity churn.
