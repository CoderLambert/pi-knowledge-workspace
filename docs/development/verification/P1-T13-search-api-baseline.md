# P1-T13 — Search API baseline verification

Status: **OPEN / PARTIAL**

Branch: `feat/p1-search-api-baseline`  
Direct base: `feat/p1-fts5-baseline-index`

## Automated repository checks

Run from a checkout of this branch:

```bash
npm test -- src/knowledge/storage/searchQuery.test.ts src/knowledge/storage/fts5Index.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-fts5-baseline-index...HEAD
git diff --name-status origin/feat/p1-fts5-baseline-index...HEAD
```

### Expected PASS evidence

- P1-T13 focused tests pass (6 search-query scenarios) and P1-T12 focused regression tests remain green.
- TypeScript, ESLint, knip, build and package dry-run produce no P1-T13-attributable failures.
- Full suite adds no P1-T13-attributable failures; inherited baseline failures remain classified rather than patched here.
- Direct-base diff contains only P1-T13 search implementation/tests and task records.

## Real SQLite / FTS acceptance

Using the P1 schema with `better-sqlite3` and FTS5 available:

1. Create one Knowledge Workspace with two SourceVersions and ParsedArtifacts.
2. Create at least two completed IndexBuild rows with distinct completion timestamps; index distinguishable chunks into each.
3. Run `SearchQueryApi.query()` without supplying an IndexBuild id.
4. Confirm the newest completed build is selected and older-build-only text is not returned.
5. Restrict `allowedSourceVersionIds` to one version and confirm results outside that set cannot enter ranking/Top-K.
6. Pass `allowedSourceVersionIds: []` and confirm zero hits with no global fallback.
7. Use `limit: 10, budget: { maxResults: 3 }` and confirm no more than three candidates are requested/returned.
8. Confirm every result's Source metadata, ParsedArtifact id and `[startByte,endByte)` locator match durable `chunks/source_versions/sources` rows.
9. Delete or corrupt the metadata relationship for a mocked/stale hit and confirm search fails closed instead of exposing unproven metadata.

### Expected PASS evidence

- Workspace/build/source scope is retained before FTS ranking and Top-K.
- The caller has no IndexBuild selection authority.
- Historical SourceVersion/ParsedArtifact identity is preserved in returned locators.
- No completed build yields an explicit failure.
- Metadata inconsistency yields an explicit failure.

## Stable-handle acceptance

Repeat the same normalized request twice against the same selected build.

Expected:

```text
same normalized request + same build
→ same queryHandle
→ same runHandle
```

Then publish/select a different completed build without changing the semantic request.

Expected:

```text
same semantic request
→ same queryHandle
new selected build
→ different runHandle
```

Ordering/duplication differences in an allowed SourceVersion set must normalize to the same query handle.

## P1-T18 dependency check

P1-T13 intentionally uses `LatestCompletedIndexBuildResolver` only as a temporary policy. Before P1 phase acceptance, P1-T18 must replace newest-completed selection with atomic active-build publication/CAS semantics while retaining the public `SearchQueryInput` shape.

Do not mark P1-T13 PASS merely because later P1-T18 code exists; rerun this guide against the final active-build resolver.

## Deferred environment debt

The autonomous runtime has GitHub write/read access but cannot resolve `github.com` from its container, so it cannot clone/install the dependency tree or execute `better-sqlite3`/FTS5. GitHub Actions evidence must also be inspected after the PR exists.

Until the checks above are recorded, P1-T13 remains **PARTIAL**.
