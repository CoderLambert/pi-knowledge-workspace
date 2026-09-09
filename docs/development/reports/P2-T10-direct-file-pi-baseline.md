# P2-T10 — Direct-file Pi baseline

Status: **PARTIAL**

## Objective

Establish the real product-value baseline by running the same P2 user tasks with fixed files/paths supplied directly to Pi, without Knowledge retrieval ranking.

## Direct base

P2-T09 / `feat/p2-retrieval-benchmark-runner` / PR #41.

This task is stacked and is not independently merge-safe before its base.

## Implemented scope

`src/knowledge/eval/directFilePiBaseline.ts` adds a fixed task/evaluation protocol:

- explicit development/holdout split;
- every task receives the original query plus the same sorted fixed corpus snapshots;
- SourceVersion/ParsedArtifact lineage accompanies file metadata for post-run accounting;
- Golden Evidence labels are never included in task/model input;
- no retrieval ranks/results are supplied;
- observations record latency, explicit insufficient-evidence state and post-run mapped Stable Evidence citations;
- deterministic scoring covers any-required/all-required Evidence coverage, citation precision, no-answer correct abstention and latency.

The model-facing task structure contains only `queryId`, `query`, `split` and `files`. Evidence labels remain evaluator-only.

## Citation mapping

Direct-file Pi may cite a file/path plus an exact quote rather than native Stable Evidence byte offsets. After the model run, the operator/evaluation harness must map that cited quote to the corresponding fixed SourceVersion/ParsedArtifact UTF-8 range. This mapping happens after inference and must not leak Golden labels into the model input.

## Tests written

`directFilePiBaseline.test.ts` covers:

- identical sorted fixed corpus file set for every query;
- no label fields in task input;
- deterministic required-Evidence/citation/no-answer/latency scoring;
- distinction between any-required and all-required coverage for multi-source tasks;
- cross-split, duplicate and incomplete observation rejection.

## Answer-quality limitation

Deterministic citation overlap cannot prove semantic answer correctness. The verification protocol therefore requires a separate human correctness review for claims, version/conflict handling, unsupported statements and no-answer hallucination. The model under test must not be the sole judge of its own answers.

## Report integrity

`eval/reports/direct-file-pi-baseline.md` remains `UNRUN`. No Pi/model/provider performance result is fabricated in the GitHub automation environment.

## Dependency assumptions / risk

P2-T10 depends only on the fixed P2 corpus/query/Stable Evidence dataset and the ability to run Pi with direct fixed files. It does not depend on Dense/sqlite-vec/Hybrid adoption.

Actual Pi/provider/model execution is unavailable here and remains OPEN verification debt.

## Out of scope

- Knowledge retrieval/index calls;
- changing Pi runtime behavior;
- automated LLM-as-judge scoring;
- existing-product comparison;
- retrieval ADR decision;
- P3 answer runtime implementation.
