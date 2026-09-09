# P2-T05 — Chinese / code lexical normalization experiment

Status: **PARTIAL**

## Objective

Evaluate the smallest deterministic lexical changes that could improve the P1/P2 FTS baseline for Chinese, code symbols and version/error-code queries without introducing a tokenizer framework or changing Stable Evidence semantics.

## Direct base

P2-T04 / `experiment/p2-fts-baseline-report` / PR #36.

This task is stacked and is not independently merge-safe before its base.

## Implemented scope

### Closed experiment matrix

`src/knowledge/eval/lexicalNormalization.ts` defines exactly four profiles:

1. `baseline`;
2. `code-derived`;
3. `code-cjk-bigram`;
4. `code-cjk-bigram-trigram`.

The matrix is deliberately closed. There is no registry, plugin API, tokenizer lifecycle or external segmentation dependency.

### Code-derived fields

The experiment derives deterministic lowercase terms from:

- camelCase / PascalCase (`AbortController` → `abort`, `controller`, `abortcontroller`);
- dotted/member paths (`fsPromises.cp` → `fs`, `promises`, `cp`, joined alias);
- snake/kebab/slash/hash-style separators;
- uppercase error-code shapes through the same identifier splitting;
- dotted versions with stable aliases (`v22.3.0` → `22x3x0`, `v22x3x0`).

The original text is always retained. Derived terms are appended only for retrieval experiments; they never replace canonical ParsedArtifact bytes.

### Chinese candidates

The two CJK profiles add overlapping Han-character bigrams, then bigrams + trigrams. This intentionally tests a dependency-free lexical candidate before considering a dictionary/ML segmenter.

### Development-only comparison

`lexicalNormalizationEvaluation.ts` reuses the P2-T04 evaluator but selects only `development` queries/labels. A baseline run is mandatory, duplicate profile runs are rejected and holdout observations are rejected as unknown queries.

This prevents P2-T05 implementation from accidentally tuning against the fixed holdout set.

## Tests written

`lexicalNormalization.test.ts` covers:

- baseline identity;
- camelCase/dotted/snake/error-code derivation;
- version aliases;
- CJK bigrams;
- bigram + trigram deterministic dedupe;
- fixed profile order.

`lexicalNormalizationEvaluation.test.ts` covers:

- development-only metric comparison;
- deltas vs baseline;
- mandatory baseline;
- duplicate-run rejection;
- holdout observation rejection.

## Report integrity

`eval/reports/lexical-normalization.md` contains the fixed profile matrix and selection discipline but all retrieval metrics remain `UNRUN`.

No candidate is declared a winner before a real current FTS5/SearchQuery run over the committed Golden Dataset.

## Dependency assumptions / risk

P2-T05 depends on:

- P2-T03 fixed development/holdout annotations;
- P2-T04 metric definitions and Stable Evidence overlap relevance;
- the current P1 FTS/SearchQuery lexical baseline;
- the target's locally proven `better-sqlite3` + FTS5 capability from the P1-T02 verification work.

P1-T02 package-install/full-gate debt and P2-T04 real baseline execution remain OPEN. P2-T05 may proceed against those documented contracts but cannot cite them as PASS.

## Verification state

The GitHub automation environment cannot execute the repository dependency tree/native SQLite workload. Focused tests, typecheck/lint/knip/build/package/full-suite gates and real per-profile FTS measurements remain OPEN and are specified in the verification guide.

## Out of scope

- changing production FTS defaults;
- generic tokenizer/normalizer plugin framework;
- external Chinese segmentation library adoption;
- embeddings/vector search;
- sqlite-vec;
- hybrid/RRF;
- reranking;
- P2-T09 generic benchmark runner.
