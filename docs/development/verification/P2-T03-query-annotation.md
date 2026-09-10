# P2-T03 verification — Query annotation

Status: **OPEN / PARTIAL**

Branch: `data/p2-query-annotation`  
Direct base: `data/p2-representative-corpus`

## 1. Focused annotation integrity

From a clean checkout:

```bash
npm ci
npm test -- \
  src/knowledge/eval/goldenDataset.test.ts \
  src/knowledge/eval/representativeCorpus.test.ts \
  src/knowledge/eval/queryAnnotations.test.ts
```

PASS requires all three files to pass with no annotation/schema/corpus regression.

The P2-T03 test must prove:

- exactly 50 development queries;
- exactly 30 holdout queries;
- every category in `GOLDEN_QUERY_CATEGORIES` occurs;
- exactly 12 `no-answer` queries and zero labels for them;
- every other query has at least one required Evidence label;
- explicit cross-version/multi-source comparison queries have required labels from at least two SourceVersions;
- every label `[startByte,endByte)` addresses exact committed ParsedArtifact bytes;
- every `exactQuote` and `quoteHash` matches those bytes;
- no Chunk identity is persisted.

## 2. Static/build/package gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Do not fix unrelated inherited failures inside P2-T03 merely to obtain green.

## 3. Full-suite regression

```bash
npm test
```

Record exact test-file/test pass/fail/skip counts. Any new failure attributable to P2-T03 must be fixed before PASS. Previously classified inherited baseline failures must remain classified by unchanged signature rather than patched in this data task.

## 4. Annotation review

Review the committed development split without using holdout records for retrieval tuning.

Check representative examples for:

- Chinese and English paraphrases;
- exact API and code-symbol queries;
- version-specific questions;
- negative questions grounded by contradictory positive Evidence;
- genuine no-answer questions with no fabricated label;
- Node v16.7.0 ↔ v22.3.0 conflict/comparison questions requiring both historical versions.

For the holdout split, verify structure/integrity mechanically only. Do not inspect holdout answers while tuning P2-T04 through P2-T08.

## 5. Direct-base scope check

```bash
git diff --check origin/data/p2-representative-corpus...HEAD
git diff --name-status origin/data/p2-representative-corpus...HEAD
```

Expected scope:

- `eval/queries/*.jsonl`;
- `eval/labels/*.jsonl`;
- P2-T03 annotation integrity test;
- P2-T03 report/verification records;
- shared bookkeeping only if updated without destructive rewriting.

No P2-T04 benchmark implementation/report, lexical-normalization experiment, dense/vector code, RRF, model runtime or P3 files belong in this diff.

## PASS condition

P2-T03 remains PARTIAL until focused annotation integrity, static/build/package gates, full-suite regression and direct-base scope review are actually run and recorded. The fixed holdout split must remain tuning-blind after acceptance.
