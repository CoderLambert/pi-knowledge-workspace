# P1-T02 verification — Database bootstrap and migrations

Status: **OPEN / PARTIAL**

## 1. Install the ADR-selected driver safely

From this branch, use the repository's pinned npm toolchain:

```bash
npm install better-sqlite3@^13.0.3
```

PASS evidence:

- both `package.json` and `package-lock.json` change coherently;
- `npm ci` succeeds from a clean dependency tree;
- `npm ls better-sqlite3` resolves one 13.x version;
- no hand-edited/stale lockfile state exists.

## 2. Focused tests

```bash
npm test -- src/knowledge/storage/database.test.ts
```

Expected: all 6 tests pass.

## 3. Real SQLite acceptance

Add/run a temporary local probe or extend the focused test with the installed driver and verify:

1. `openKnowledgeDatabase(":memory:")` returns successfully;
2. `PRAGMA user_version` is `1`;
3. `PRAGMA foreign_keys` is `1`;
4. all ten P1-T02 tables exist in `sqlite_schema`;
5. reopening a file DB is idempotent and retains `user_version = 1`;
6. setting `PRAGMA user_version = 2` causes a subsequent open to fail closed;
7. a transaction that throws leaves no inserted row;
8. a successful transaction commits its row.

For a file DB also confirm `PRAGMA journal_mode` returns `wal`.

## 4. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/experiment/p1-sqlite-driver-decision...HEAD
git diff --name-status origin/experiment/p1-sqlite-driver-decision...HEAD
```

Do not patch known inherited baseline failures merely to make the full suite green.

## 5. Scope review

The direct-base diff may contain only P1-T02 database bootstrap/migration implementation, tests, dependency metadata generated for the selected driver, report/verification, changelog/plan/debt bookkeeping, and an ADR only if a new architectural decision actually becomes necessary.

No P1-T03 installation/workspace identity behavior, blob storage, source domain, ingestion, parsing, indexing, retrieval, Fleet, or UI implementation belongs here.

## PASS condition

P1-T02 remains PARTIAL until the selected native driver is lockfile-integrated and the focused + real SQLite + static/build/package gates above produce passing evidence. Environmental/native packaging limitations must be recorded rather than silently waived.
