# P1-T12 — FTS5 baseline index verification

Status: **OPEN / required for PASS**

Branch: `feat/p1-fts5-baseline-index`  
Direct base: `feat/p1-structure-aware-chunker`  
PR: #22

## Automated verification

```bash
npm test -- src/knowledge/storage/fts5Index.test.ts src/knowledge/storage/database.test.ts src/knowledge/storage/chunker.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Do not patch unrelated inherited baseline failures to make this task appear green.

## Real SQLite / FTS5 acceptance

Run against the selected `better-sqlite3` target runtime:

1. Open a fresh Knowledge DB and confirm `PRAGMA user_version = 4`.
2. Confirm FTS5 support by successfully creating/querying the migration-owned `chunk_fts`; optionally record `SELECT sqlite_compileoption_used('ENABLE_FTS5')` as supporting evidence.
3. Inspect `sqlite_master` and confirm `chunk_fts` uses `fts5` with `unicode61` and the non-text scope columns are `UNINDEXED`.
4. Confirm fresh `chunks` contains IndexBuild/ParsedArtifact/SourceVersion ids, canonical `start_byte/end_byte`, exact text and `node_kinds_json`.
5. Starting from schema v3 with an empty provisional `chunks` table, upgrade to v4 and confirm success.
6. Starting from schema v3 with at least one provisional chunk row, upgrade and confirm migration 4 fails and rolls back to schema version 3 with the legacy row/table intact. No silent drop or guessed IndexBuild ownership is acceptable.

## Scoped Top-K acceptance

Create at least two Workspaces, two IndexBuilds and several SourceVersions with deliberately overlapping query terms.

Construct the fixture so the globally strongest lexical match is **outside** the requested Workspace/IndexBuild/SourceVersion scope while a weaker in-scope match exists. Then verify:

1. Querying Workspace A / Build A returns only A-owned chunks.
2. A result from Workspace B never occupies Top-K and is not post-filtered after limiting.
3. Querying Build A never returns an otherwise strong chunk from Build B.
4. An allowed SourceVersion set is enforced inside the SQL query; a stronger disallowed source never suppresses a weaker allowed hit.
5. An explicitly empty allowed SourceVersion set returns `[]` without issuing a global FTS query.
6. A bounded `limit` is honored after the scope predicates and ranking.
7. Raw `bm25` values are treated as internal ranking values only; do not compare them as normalized relevance scores across future retrieval strategies.

## Tokenizer behavior

Use a small corpus containing English, Chinese and mixed punctuation. Record actual `unicode61` behavior and returned lexical matches. This acceptance only proves the chosen lexical baseline functions; Chinese retrieval quality is evaluated in P2 and must not be overstated from this smoke check.

## Direct-base scope check

```bash
git diff --check origin/feat/p1-structure-aware-chunker...HEAD
git diff --name-status origin/feat/p1-structure-aware-chunker...HEAD
git diff --stat origin/feat/p1-structure-aware-chunker...HEAD
```

Expected scope: `fts5Index` implementation/tests, schema-v4 migration/database-version tests, report/verification, and required bookkeeping only. P1-T13 public search API and later vector/hybrid retrieval work must be absent.

## PASS evidence

P1-T12 moves to PASS only when focused/static/build/package/full-suite checks show no new task-attributable failure, real target SQLite creates and queries the `unicode61` FTS5 table, schema migration positive/negative cases pass, adversarial scoped-Top-K fixtures prove no post-limit filtering, and evidence is written back to report/plan/changelog/debt/PR.
