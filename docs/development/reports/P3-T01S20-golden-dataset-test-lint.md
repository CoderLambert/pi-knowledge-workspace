# P3-T01S20 — Golden Dataset Test-Harness Lint

Status: **PARTIAL**

## Purpose

Continue P3-T01 inherited baseline closure from the verified 77-error checkpoint with the smallest safe evaluation test-harness slice.

## Scope

Changed test file:

- `src/knowledge/eval/goldenDataset.test.ts`

Support documentation:

- this report;
- `docs/development/verification/P3-T01S20-golden-dataset-test-lint.md`.

The parent lint output reports 9 inherited findings in this file: eight `no-confusing-void-expression` findings around validator assertions and one `consistent-type-assertions` finding for the deliberately invalid Chunk-identity fixture.

`goldenDataset.ts`, committed evaluation data, benchmark thresholds and retrieval configuration are explicitly out of scope.

## Changes

- replace shorthand validator callbacks with block-bodied callbacks while preserving every expected success/failure assertion;
- represent the deliberately invalid label as `GoldenEvidenceLabel & { chunkId: string }` rather than forcing it through a type assertion;
- preserve the test that verifies persisted Chunk identity is rejected.

## Contract preservation

The same Golden Dataset invariants remain asserted:

- development/holdout stable Evidence ranges are accepted;
- persisted Chunk identity is rejected;
- SourceVersion/ParsedArtifact lineage mismatch is rejected;
- answerable queries require required Evidence;
- no-answer queries carry no fabricated Evidence;
- unsafe corpus paths and invalid canonical hashes are rejected.

No production validator or frozen P2 evidence changes are made.

## Verification state

Status remains **PARTIAL** until GitHub CI confirms:

```text
npm run typecheck → PASS
ESLint 77 → 68
```

The task-owned test file must disappear from the authoritative lint output. Frozen P2 FTS and P2 Lexical Evidence workflows must remain green.

## Git discipline

Base: `docs/p3-t01-77-checkpoint` (#93)

Head: `chore/p3-t01-golden-dataset-test-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, benchmark retuning, P2 evidence mutation or unrelated cleanup.
