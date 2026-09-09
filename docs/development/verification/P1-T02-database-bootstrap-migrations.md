# P1-T02 verification — Database bootstrap and migrations

Status: **OPEN / PARTIAL**

## Verified locally on 2026-09-09

On the user's Omarchy/Linux checkout with Node 26.7.0:

- `npm install better-sqlite3@13.0.3` updated `package.json` + `package-lock.json` coherently;
- clean `rm -rf node_modules && npm ci` succeeded;
- `npm ls better-sqlite3` resolved `better-sqlite3@13.0.3`;
- native load succeeded with SQLite `3.53.4`;
- real FTS5 create/insert/MATCH query succeeded;
- `npm test -- src/knowledge/storage/database.test.ts` passed **7/7**, including real `openKnowledgeDatabase(":memory:")`, schema version, foreign keys and FTS5;
- `npm run typecheck` passed;
- `npm run knip` passed with `Excellent, Knip found no issues` (one non-failing redundant-entry configuration hint remains);
- `npm run build` passed;
- `npm run pack:dry` passed and included Knowledge database/migration/service outputs;
- staged pre-commit typecheck/Knip/ESLint/Vitest passed;
- `git diff --check` passed.

Commit `926e1ae1` is the dependency/test integration commit. The previous unlisted `better-sqlite3` defect is resolved at the owning P1-T02 branch.

## Remaining 1 — packaged native-runtime acceptance

Create a real tarball and install it into a clean isolated directory:

```bash
npm pack
TMP_DIR="$(mktemp -d)"
cd "$TMP_DIR"
npm init -y
npm install /absolute/path/to/jmfederico-pi-web-1.202609.0.tgz
```

Then resolve the installed package and import its built Knowledge database module. Open `:memory:`, verify `user_version`, `foreign_keys`, create/query an FTS5 virtual table, and confirm the installed dependency resolves `better-sqlite3@13.0.3`.

PASS evidence must prove the chain:

```text
npm pack
→ clean directory
→ npm install tarball
→ installed package dependency resolution
→ native better-sqlite3 load
→ packaged dist/knowledge/storage/database.js
→ migration
→ FTS5
```

`pack:dry` alone is not sufficient.

## Remaining 2 — repository gates / failure classification

Run:

```bash
npm run lint
npm test
git diff --check origin/experiment/p1-sqlite-driver-decision...HEAD
git diff --name-status origin/experiment/p1-sqlite-driver-decision...HEAD
```

Do not patch known inherited baseline failures merely to make the suite green. Classify failures as inherited vs P1-T02-attributable using direct-base evidence.

## Remaining 3 — scope review

The direct-base diff may contain only P1-T02 database bootstrap/migration implementation, tests, npm-generated dependency metadata, report/verification and required bookkeeping.

No P1-T03 installation/workspace identity behavior, blob storage, source domain, ingestion, parsing, indexing, retrieval, Fleet or UI implementation belongs here.

## PASS condition

P1-T02 remains PARTIAL until packaged native-runtime acceptance and the remaining repository-wide gate classification are recorded. The native driver, lockfile integration, real SQLite open and FTS5 behavior are already locally proven and should not be repeated merely to satisfy bookkeeping.
