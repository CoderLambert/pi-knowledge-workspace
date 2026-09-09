# P2-T09 — Retrieval benchmark runner

Status: **PARTIAL**

## Objective

Automate reproducible report generation for the retrieval metrics already defined across P2 without coupling report generation to a specific retriever or tuning loop.

## Direct base

P2-T08 / `experiment/p2-hybrid-rrf` / PR #40.

This task is stacked and is not independently merge-safe before its base.

## Implemented scope

`src/knowledge/eval/retrievalBenchmarkRunner.ts` adds a pure observation-driven runner:

- caller explicitly selects `development` or `holdout`;
- the Golden Dataset is filtered to exactly that split;
- every named variant carries a canonicalized configuration record;
- duplicate variant ids fail closed;
- each variant's observations are evaluated through the established Stable Evidence overlap metrics;
- observations from another split are rejected by the evaluator as unknown queries;
- output records Recall@10, MRR, all-required-Evidence coverage, category failure counts, latency and resource usage;
- deterministic Markdown rendering includes configuration, failures and no-answer diagnostics.

The runner does not execute retrieval, choose parameters, fetch models or invent missing observations. That separation keeps benchmark evidence auditable and prevents the report layer from becoming a hidden tuning framework.

## Tests written

`retrievalBenchmarkRunner.test.ts` covers:

- multi-variant evaluation on one explicit split;
- canonical configuration ordering;
- cross-split observation rejection;
- duplicate variant ids and invalid timestamp rejection;
- deterministic Markdown metric/configuration/failure/diagnostic sections.

## Report integrity

`eval/reports/retrieval-benchmark.md` remains `UNRUN`. A real generated report may replace it only after complete observations exist for the chosen split and each variant.

## Dependency assumptions / risk

P2-T09 reuses:

- P2-T01/T03 Golden Dataset and split semantics;
- P2-T04 Stable Evidence overlap evaluation;
- variant-specific observations produced by FTS, lexical normalization, Dense or Hybrid experiments.

Those earlier real measurements are still PARTIAL/OPEN. The runner can be implemented/tested against fixtures without claiming any retrieval quality result.

## Verification state

The GitHub automation environment cannot execute the repository dependency tree or real benchmark workloads. Focused/static/build/package/full-suite checks and generation from real observations remain OPEN; exact steps are documented in the verification guide.

## Out of scope

- executing retrievers;
- parameter search/tuning;
- embedding provider calls;
- sqlite-vec deployment;
- reranking;
- direct-file Pi/product comparison tasks;
- P3 answer generation.
