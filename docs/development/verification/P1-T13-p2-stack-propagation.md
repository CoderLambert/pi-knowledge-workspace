# Verification — P1-T13 natural-language FTS query fix propagated into P2

Status: **OPEN / PARTIAL**

Run from `chore/p2-propagate-p1-t13-natural-query`:

```bash
npm ci
npm test -- \
  src/knowledge/storage/searchQuery.test.ts \
  src/knowledge/storage/fts5Index.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Required focused evidence:

- ordinary punctuation/code input does not reach FTS5 as raw MATCH syntax;
- `Node.js`, backticks, apostrophes, `.value`, `AND`, `OR`, `NOT`, and `?` are quoted as literal OR terms;
- simple `needle` becomes `"needle"`;
- query/run handles remain derived from the original normalized public query;
- SourceVersion scope/budget semantics remain unchanged;
- active IndexBuild lease acquisition/release behavior remains unchanged.

Direct-base scope:

```bash
git diff --check origin/data/p2-retrieval-challenge-expansion...HEAD
git diff --name-status origin/data/p2-retrieval-challenge-expansion...HEAD
```

Expected: `searchQuery.ts`, `searchQuery.test.ts`, and these two propagation records only.

Do not add P2 normalization/tuning rules in this layer. The purpose is solely to move the proven P1 query-boundary correction into the later ancestry safely.
