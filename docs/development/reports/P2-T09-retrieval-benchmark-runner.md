# P2-T09 — Retrieval benchmark runner

Status: **PARTIAL**

## Objective

Turn the fixed P2 Golden Dataset and recorded ranked retrieval observations into reproducible backend-independent reports instead of hand-calculated benchmark summaries.

## Implemented

`src/knowledge/eval/retrievalBenchmarkRunner.ts` adds one narrow orchestration layer over the already-defined P2-T04 Stable Evidence metrics.

Inputs are:

- the immutable Golden Dataset;
- exactly one split (`development` or `holdout`);
- one or more named retrieval variants;
- each variant's immutable configuration revision;
- one observation per query;
- measured latency/resource values.

Outputs include:

- Recall@10;
- MRR;
- all-required-Evidence coverage;
- category failure counts;
- median/p95/max latency;
- peak RSS and index/vector bytes;
- missed answerable query ids;
- no-answer query ids that still produced hits;
- deterministic Markdown suitable for `eval/reports/`.

## Ground-truth invariant

The runner delegates relevance to the existing P2-T04 evaluator, which matches ranked results against Stable Evidence by:

```text
SourceVersion
+ ParsedArtifact
+ overlapping UTF-8 [startByte,endByte)
```

Chunk ids, backend ids and score scales are never ground truth.

## Split discipline

The caller selects one split before evaluation. Observations referencing the other split are rejected. This makes accidental holdout leakage visible instead of silently mixing development and holdout measurements.

P2-T05/P2-T06/P2-T08 selection must still use development data only; holdout is run once after configuration freeze.

## Validation

The runner rejects:

- zero variants;
- duplicate variant ids;
- empty labels/config revisions;
- observations outside the selected split;
- incomplete/duplicate/unknown query observations through the underlying metric validator;
- invalid latency/resource measurements through the same validated metric contract.

Focused tests also verify deterministic Markdown contains aggregate metrics and explicit failure/no-answer diagnostics.

## Scope

This task does not:

- execute FTS, embeddings or sqlite-vec itself;
- choose the V1 retrieval stack;
- add a provider registry;
- add reranking;
- call Pi;
- modify production search behavior.

P2-T12 remains responsible for the retrieval decision after real measurements exist.

## Verification state

The GitHub automation environment cannot execute the repository dependency tree. Focused tests, typecheck/lint/knip/build/package/full-suite execution and a real generated report remain OPEN verification debt.

P2-T10 may proceed using the same fixed user-task/query ids and Stable Evidence ground truth without treating P2-T09 as accepted.
