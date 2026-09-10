# P1-T01 — SQLite Driver Decision Verification Guide

## Current status

**PARTIAL.** The decision is recorded, but target-runtime acceptance is still required before ADR-028 is upgraded from proposed to accepted.

## Selected candidate

`better-sqlite3` 13.x.

Do not add a dual-driver abstraction while verifying this decision.

## 1. Environment

Record:

```bash
node --version
npm --version
uname -a
```

Expected:

- Node satisfies repository engine `>=22.19.0`;
- target is the intended Omarchy/Linux x64 environment or another explicitly supported packaging target.

## 2. Dependency integration

After P1-T02 adds the selected production dependency:

```bash
npm install
node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); console.log(db.prepare('select sqlite_version() as v').get()); db.close();"
```

Expected: native binding resolves without build/install failure and SQLite opens successfully.

## 3. FTS5 requirement

Run a minimal FTS5 probe:

```bash
node <<'NODE'
const Database = require('better-sqlite3');
const db = new Database(':memory:');
db.exec(`
  CREATE VIRTUAL TABLE docs USING fts5(body);
  INSERT INTO docs(body) VALUES ('alpha beta'), ('中文 检索');
`);
console.log(db.prepare("SELECT rowid, body FROM docs WHERE docs MATCH 'alpha'").all());
db.close();
NODE
```

Expected: table creation succeeds and query returns the `alpha beta` row. `no such module: fts5` is a FAIL and reopens ADR-028.

## 4. Transaction semantics

Verify explicit commit and rollback behavior using the selected driver.

Expected:

- committed rows survive;
- rolled-back rows do not;
- nested transaction behavior used by P1-T02 is documented rather than assumed.

## 5. Backup

Create a file-backed database, write sample data, call the driver's online backup API, then open the backup as a separate database and verify the data.

Expected:

- backup completes without corrupting the source;
- backup opens independently;
- row count/content matches the source snapshot used for the test.

## 6. Extension loading feasibility

Use only a safe local test extension if one is available. Do not download/execute an untrusted binary merely to satisfy this gate.

Expected:

- the driver exposes the extension-loading path needed for a later approved extension;
- extension loading remains disabled/uninvoked in ordinary P1 database bootstrap unless a later task explicitly authorizes it.

Failure here does not automatically require rejecting better-sqlite3 if FTS5/transactions/backup are sound; it blocks only future extension-dependent decisions such as sqlite-vec until separately resolved.

## 7. Repository gates after P1-T02 dependency integration

Run:

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Expected: no selected-driver-attributable failures. Do not patch the known inherited promptQueue baseline inside P1-T01/P1-T02 merely to make the full suite green.

## 8. Packaging check

Verify the built/packed PI WEB distribution can resolve `better-sqlite3` when launching `pi-knowledge` on the target machine.

Expected: no missing native binding, ABI mismatch, unsupported architecture, or package-pruning failure.

## Decision closure

### PASS

If FTS5, transactions, backup, dependency resolution and packaging pass, update:

- ADR-028 status → `Accepted`;
- P1-T01 report/status → `PASS`;
- `VERIFICATION-DEBT.md` entry → resolved;
- `DEVELOPMENT-PLAN.md` and `CHANGELOG.md`;
- PR description with dated evidence.

### Reopen decision

If native packaging or required FTS5 support fails materially, reopen ADR-028. Re-evaluate a controlled Node runtime plus `node:sqlite`/FTS5 distribution strategy before adding any dual-driver abstraction.
