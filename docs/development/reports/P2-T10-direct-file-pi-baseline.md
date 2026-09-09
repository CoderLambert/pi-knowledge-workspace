# P2-T10 — Direct-file Pi baseline

Status: **PARTIAL — REAL DEVELOPMENT RUN COMPLETE / HUMAN SEMANTIC REVIEW REQUIRED**

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

Wrong paths, missing quotes and ambiguous quotes are **not silently discarded**. The observation records `unmappedCitationCount`, which is included in the citation-precision denominator. A no-answer response containing any mapped or unmapped citation cannot count as a correct abstention.

## Real local development evidence — 2026-09-09

The user executed the canonical support command on Omarchy/Linux:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

All 50 fixed development queries completed.

Frozen identity:

```text
support repo SHA: db71e7c6d746709ce152269b68b020bd05bdb0dd
dataset hash: 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
system prompt SHA-256: 8db92ab71e29b1f7228a5176e5f3de46f8eab02ad493896bc5a85e5463eddc16
Pi version: 0.85.1
provider: openai-codex
model: gpt-6-astra
API: openai-codex-responses
responseModel: null
thinkingLevel: null
```

Deterministic development metrics:

```text
queries: 50
answerable: 42
no-answer: 8
any-required Evidence coverage: 1.0
all-required Evidence coverage: 1.0
citation precision: 0.7758620689655172
no-answer correct abstention: 0.625
latency median: 10165.077273999981 ms
latency p95: 14855.569325999997 ms
latency max: 18050.93610000005 ms
```

Equivalent citation/abstention counts:

```text
valid mapped citations: 45 / 58 total mapped+unmapped citations
correct no-answer abstentions: 5 / 8
```

The run produced its evidence bundle at:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10
```

including `human-review-development.md`.

## Interpretation

The direct-file baseline has a mixed result:

- it achieved complete deterministic required-Evidence coverage on answerable development tasks;
- citation discipline is materially imperfect at about 77.6% precision;
- three of eight no-answer tasks failed the strict abstention contract;
- model end-to-end latency was about 10.2 s median / 14.9 s p95 / 18.1 s max.

These observations are product-value evidence, not a reason to retune the fixed P2 retrieval dataset. The direct-file path is not proven equivalent to the Knowledge retrieval design merely because all required Evidence was eventually covered.

P2-T05/P2-T09 remain the retrieval-side comparison point: frozen plain SQLite FTS5 reached development Recall@10 `1.0`, MRR `0.9365079365079365`, and all-required Evidence coverage `1.0`. P2-T06 rejected both Dense candidates as regressions.

Retrieval-only latency and full model-answer latency are different operations and must not be compared as if they measure the same work.

## Tests / deterministic preparation

Support PR #53's final CI preparation run `34332760481` established:

- focused evaluator suite: 1 file / 5 tests PASS;
- focused P2-T10 lint: PASS;
- `--prepare-only`: PASS;
- exactly 50 development tasks / six fixed files;
- dataset and prompt hashes frozen;
- no provider/model call or credential use in CI.

Preparation artifact: `10096440773`, digest `sha256:e65d56a823499760e80cbc832d06a1d6b3f789a8228aaaec17771174866dc88f`.

## Remaining acceptance blocker

Deterministic evidence is now complete for the development run, but citation overlap does not prove semantic answer correctness.

The generated `human-review-development.md` must be reviewed independently for every query, recording:

- correct / partially correct / incorrect;
- unsupported claims;
- version/conflict mistakes;
- important evidence omissions;
- no-answer hallucination/abstention behavior.

The model under test cannot be its own sole judge.

Therefore **P2-T10 remains PARTIAL** until human semantic review is complete. No holdout run is authorized for tuning.

## Out of scope

- Knowledge retrieval/index calls;
- changing Pi runtime behavior;
- automated same-model LLM-as-judge scoring;
- existing-product comparison;
- retrieval ADR decision;
- P3 answer runtime implementation.
