# P2-T10 — Direct-file Pi baseline

Status: **PARTIAL — LOCAL REAL RUN + HUMAN REVIEW REQUIRED**

## Objective

Establish the real product-value baseline by running the same P2 user tasks with fixed files/paths supplied directly to Pi, without Knowledge retrieval ranking.

## Direct base

P2-T09 / `feat/p2-retrieval-benchmark-runner` / PR #41 (**PASS**).

This task is stacked and is not independently merge-safe before its base.

## Implemented scope

`src/knowledge/eval/directFilePiBaseline.ts` defines a fixed task/evaluation protocol:

- explicit development/holdout split;
- every task receives the original query plus the same sorted fixed corpus snapshots;
- SourceVersion/ParsedArtifact lineage accompanies file metadata for post-run accounting;
- Golden Evidence labels are never included in task/model input;
- no retrieval ranks/results are supplied;
- observations record latency, explicit insufficient-evidence state, post-run mapped Stable Evidence citations, and the count of citations that could not be mapped honestly;
- deterministic scoring covers any-required/all-required Evidence coverage, citation precision, no-answer correct abstention and latency.

The model-facing task structure contains only `queryId`, `query`, `split` and `files`. Evidence labels remain evaluator-only.

## Citation mapping and failure accounting

Direct-file Pi may cite a file/path plus an exact quote rather than native Stable Evidence byte offsets. After inference, the evidence harness maps each cited quote to the corresponding fixed SourceVersion/ParsedArtifact UTF-8 range.

Mapping is valid only when the cited path belongs to the frozen task and the exact quote occurs verbatim and uniquely in that file.

Wrong paths, missing quotes and ambiguous quotes are **not silently discarded**. The observation records `unmappedCitationCount`, which is included in citation-precision denominator. A no-answer response containing any mapped or unmapped citation cannot count as a correct abstention.

This closes a measurement-integrity gap where dropping invalid citations could otherwise inflate precision or abstention quality.

## Tests written

`directFilePiBaseline.test.ts` covers:

- identical sorted fixed corpus file set for every query;
- no label fields in task input;
- deterministic required-Evidence/citation/no-answer/latency scoring;
- distinction between any-required and all-required coverage for multi-source tasks;
- unmapped citations penalize citation precision and no-answer abstention;
- cross-split, duplicate and incomplete observation rejection.

Task-owned test non-null assertions were removed during the citation-accounting cleanup.

## Real-evidence support

Support PR #53 (`chore/p2-t10-direct-file-pi-evidence`) provides a one-command local evidence harness:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

The support harness freezes the same six P2 corpus files and 50 development queries, records actual Pi provider/model identity, maps citations post-inference, preserves raw JSON event streams, computes this evaluator's report, and generates a human-review worksheet.

GitHub Actions executes only a `--prepare-only` mode and does not call a model/provider or consume credentials.

## Answer-quality limitation

Deterministic citation overlap cannot prove semantic answer correctness. The verification protocol therefore requires a separate human correctness review for claims, version/conflict handling, unsupported statements, no-answer hallucinations and important evidence omissions.

The model under test must not be the sole judge of its own answers.

## Report integrity

`eval/reports/direct-file-pi-baseline.md` remains `UNRUN`. No Pi/model/provider performance result is fabricated in GitHub automation.

P2-T10 remains PARTIAL until:

1. the complete real 50-query development run is recorded;
2. deterministic citation/Evidence metrics are generated;
3. independent human semantic review is completed.

## Dependency assumptions / risk

P2-T10 depends only on the fixed P2 corpus/query/Stable Evidence dataset and an authenticated local Pi runtime. It does not depend on Dense/sqlite-vec/Hybrid adoption.

Provider credentials remain local and must not be copied into repository evidence or CI.

## Out of scope

- Knowledge retrieval/index calls;
- changing Pi runtime behavior;
- automated LLM-as-judge scoring;
- existing-product comparison;
- retrieval ADR decision;
- P3 answer runtime implementation.
