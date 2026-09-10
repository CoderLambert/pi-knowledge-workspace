# P2-T01 — Golden Dataset Schema Verification

## Status

**PARTIAL** until the executable gates below are run and recorded.

Branch: `experiment/p2-golden-dataset-schema`  
Direct base: `test/p1-evidence-durability-e2e` (P1-T22 / PR #32)

## Focused tests

```bash
npm test -- src/knowledge/eval/goldenDataset.test.ts --reporter=verbose
```

Expected: all schema-contract tests pass.

Required behaviors:

- stable labels use ParsedArtifact id + SourceVersion id + UTF-8 byte range + exact quote/hash;
- development and holdout splits validate;
- answerable queries require `required` Evidence;
- no-answer queries have no Evidence labels;
- lineage mismatch fails closed;
- unsafe corpus paths/hash metadata fail closed;
- injected `chunkId`/`chunk_id` is rejected.

## Static/build/package gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Fix only P2-T01-attributable failures on this branch. Do not repair unrelated inherited PI WEB/P0/P1 baselines merely to obtain a green aggregate gate.

## Full regression suite

```bash
npm test
```

Record exact pass/fail/skip counts and classify any failure against the known verification ledger.

## Direct-base scope

```bash
git diff --check origin/test/p1-evidence-durability-e2e...HEAD
git diff --name-status origin/test/p1-evidence-durability-e2e...HEAD
```

Expected scope only:

- Golden Dataset schema + focused tests;
- `eval/` layout ownership documentation;
- P2-T01 report/verification and safe bookkeeping updates.

No representative corpus, ~80-query annotation set, benchmark runner, tokenizer experiment, dense adapter or vector deployment code belongs in T01.

## First-data contract check

When P2-T02/T03 data exists, load it into `GoldenDataset` and run `validateGoldenDataset` before any retrieval benchmark.

Expected:

- every label resolves to a corpus ParsedArtifact lineage;
- no-answer queries have no labels;
- all other queries have at least one required label;
- no committed ground truth contains retrieval Chunk identity.

## PASS criteria

P2-T01 may become PASS when focused tests, task-attributable static/build/package/full-suite gates and direct-base scope checks succeed. The future T02/T03 data validation is a dependent acceptance row and does not require weakening the schema if later data is malformed.