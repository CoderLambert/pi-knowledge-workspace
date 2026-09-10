# P2-T01 — Golden Dataset Schema Report

## Status

**PARTIAL**

Branch: `experiment/p2-golden-dataset-schema`  
Direct base: `test/p1-evidence-durability-e2e` (P1-T22 / PR #32)

## Objective

Create a retrieval-evaluation ground-truth contract that survives rechunking and retrieval implementation changes.

The central invariant is:

> Golden labels address immutable ParsedArtifact byte ranges, never retrieval Chunk ids.

## Implemented schema

`src/knowledge/eval/goldenDataset.ts` defines:

- `GoldenCorpusArtifact` — captured source/version metadata plus immutable ParsedArtifact lineage;
- `GoldenQuery` — stable query id, development/holdout split and planned P2 categories;
- `GoldenEvidenceLabel` — required/supporting stable Evidence range;
- `GoldenDataset` — corpus/query/label aggregate used for cross-record validation.

A label contains:

```text
queryId
importance
parsedArtifactId
sourceVersionId
startByte
endByte
exactQuote
quoteHash
```

No Chunk identity is part of the contract.

## Cross-record invariants

`validateGoldenDataset` checks:

- schema version consistency;
- unique corpus/query/label ids;
- unique ParsedArtifact ids;
- safe corpus-relative paths;
- source capture/version metadata;
- canonical SHA-256 shape;
- development/holdout split;
- known query categories;
- label range/hash shape;
- query and ParsedArtifact references exist;
- label SourceVersion matches ParsedArtifact lineage;
- answerable queries have at least one `required` Evidence label;
- `no-answer` queries have zero labels;
- persisted `chunkId`/`chunk_id` is rejected.

## Directory layout

Created the planned repository-owned structure:

```text
eval/
├── corpus/
├── queries/
├── labels/
├── fixtures/
└── reports/
```

Each directory contains only its ownership rules. P2-T01 intentionally does not add representative corpus content or the ~80-query annotation set.

## Design notes

The query category vocabulary follows the already-approved P2 plan so later annotations do not need a schema migration merely to encode the planned classes.

`required` vs `supporting` Evidence is included now because P2-T09 explicitly needs all-required-evidence coverage. This avoids retrofitting benchmark semantics after annotations exist.

The schema does not encode retrieval scores, ranks, Chunk ids, embedding ids or IndexBuild ids. Those are experiment outputs/configuration, not ground truth.

## Tests

`src/knowledge/eval/goldenDataset.test.ts` covers:

- valid development + holdout labels;
- explicit Chunk identity rejection;
- SourceVersion/ParsedArtifact lineage mismatch;
- missing required Evidence;
- no-answer zero-label semantics;
- unsafe paths and invalid canonical hashes.

No test/static/build gate is claimed PASS in this execution environment because the repository dependency tree is not executable here and the branch has no CI evidence.

## Remaining verification debt

Before upgrading P2-T01 to PASS:

- run the focused validator tests;
- run typecheck/lint/knip/build/pack/full suite and classify only task-attributable failures;
- confirm direct-base diff is task-only;
- exercise the validator against the first P2-T02 corpus and P2-T03 annotations once those exist.

P2-T02 may proceed against this documented schema while T01 remains PARTIAL under the autonomous-execution policy.