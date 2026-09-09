# P2-T04 verification — FTS baseline report

Status: **OPEN / PARTIAL**

Branch: `experiment/p2-fts-baseline-report`  
Direct base: `chore/p2-propagate-p1-t13-natural-query` (PR #47)  
Upstream corrective corpus: `data/p2-retrieval-challenge-expansion` (PR #46)

## 1. Corrected ancestry prerequisites

P2-T04 acceptance now depends on both corrective layers being present in ancestry:

```text
P2-T03 / #35
  -> P2-T03A challenge expansion / #46
  -> P1-T13 natural-language FTS propagation / #47
  -> P2-T04 / #36
```

Do not benchmark from the old #35-based branch state. The original 3-chunk run is preserved only as regression evidence.

## 2. Focused tests

Run from a current checkout of `experiment/p2-fts-baseline-report`:

```bash
npm ci
npm test -- \
  src/knowledge/eval/goldenDataset.test.ts \
  src/knowledge/eval/representativeCorpus.test.ts \
  src/knowledge/eval/queryAnnotations.test.ts \
  src/knowledge/eval/retrievalChallengeCorpus.test.ts \
  src/knowledge/storage/searchQuery.test.ts \
  src/knowledge/storage/fts5Index.test.ts \
  src/knowledge/eval/ftsBaselineEvaluation.test.ts
```

PASS evidence must establish:

- original Golden Dataset integrity remains unchanged;
- challenge artifacts have valid immutable metadata and unique lineage;
- no development Evidence exact quote is copied into the challenge corpus;
- challenge material omits target `ref()` / `fsPromises.cp` passages while retaining hard-negative lexical overlap;
- production `canonicalizeParsedArtifact -> chunkParsedArtifact` yields at least 30 challenge chunks total and at least 10 per challenge artifact;
- public natural-language punctuation/code terms are compiled into safe quoted FTS5 literals joined by `OR`;
- SourceVersion scope, result budget, active-build lease and release semantics remain intact;
- P2-T04 metric semantics remain correct.

## 3. Real expanded-corpus FTS execution

Use the supported real `better-sqlite3` runtime and current production Knowledge storage/search path.

Required corpus:

- the original three immutable P2-T02 artifacts;
- all P2-T03A challenge artifacts from PR #46.

Required query/ground-truth set:

- the unchanged 50 development queries;
- the unchanged 30 holdout queries;
- the existing Stable Evidence labels only.

Execution protocol:

1. create/open a fresh file-backed Knowledge SQLite database;
2. materialize all original + challenge artifacts as immutable SourceVersion/ParsedArtifact rows;
3. canonicalize and chunk every artifact through production code;
4. build, validate and publish one FTS5 IndexBuild;
5. execute all 80 fixed queries through `SearchQueryApi` with `limit=10`;
6. use the PR #47 natural-language query compiler; do not add P2 lexical normalization here;
7. preserve the current active IndexBuild lease behavior;
8. record every ordered hit locator and wall-clock query latency;
9. measure peak RSS;
10. measure FTS allocation using SQLite `dbstat`, not database file-size deltas;
11. pass complete observations/resources to `evaluateFtsBaseline`;
12. publish numeric results plus development failure/rank diagnostics.

Do not substitute fixtures, hand-written hits, or the old 3-chunk result for this run.

## 4. Development / holdout discipline

During later P2 tuning:

- development observations may be inspected;
- holdout observations must not be used to select lexical profiles, embedding profiles, or RRF settings;
- the previously observed holdout rank-2 cases remain acceptance-only evidence.

The expanded FTS baseline itself may record holdout aggregate acceptance metrics, but no parameter change may be derived from them.

## 5. Resource measurement

Record at minimum:

```text
SQLite version
better-sqlite3 version
Node version
repository HEAD SHA
original artifact count
challenge artifact count
total chunk count
query error count
Recall@10
MRR
all-required Evidence coverage
category failure counts
no-answer queries with any hit
latency median / p95 / max
peak RSS bytes
FTS dbstat bytes
```

The earlier original-corpus `20,480` FTS-byte figure is valid for that fixture only. Measure again for the expanded index.

## 6. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Fix only P2-T04 / corrected-ancestry attributable failures. Classify unchanged inherited PI WEB failures rather than editing unrelated production code.

## 7. Direct-base scope

```bash
git diff --check origin/chore/p2-propagate-p1-t13-natural-query...HEAD
git diff --name-status origin/chore/p2-propagate-p1-t13-natural-query...HEAD
```

Expected P2-T04-only scope:

- `src/knowledge/eval/ftsBaselineEvaluation.ts`;
- `src/knowledge/eval/ftsBaselineEvaluation.test.ts`;
- `eval/reports/fts-baseline.md`;
- P2-T04 implementation report;
- this verification guide.

No P2-T05 lexical normalization, Dense/vector/sqlite-vec/RRF implementation, P2-T09 generic runner, model runtime, or P3 scope belongs here.

## PASS condition

P2-T04 remains PARTIAL until the expanded-corpus real FTS run, numeric report/provenance, focused/static/build/package/full-suite classification, and direct-base scope proof are all recorded. The original 3-chunk run alone cannot satisfy this gate.
