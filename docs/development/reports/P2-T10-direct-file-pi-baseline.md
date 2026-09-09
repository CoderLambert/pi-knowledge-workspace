# P2-T10 — Direct-file Pi baseline

Status: **PASS — REAL DEVELOPMENT RUN + OWNER-DELEGATED INDEPENDENT SEMANTIC REVIEW COMPLETE**

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
- observations record latency, explicit insufficient-evidence state, post-run mapped Stable Evidence citations, and unmapped-citation count;
- deterministic scoring covers any-required/all-required Evidence coverage, citation precision, no-answer correct abstention and latency.

The model-facing task structure contains only `queryId`, `query`, `split` and `files`.

## Real local development evidence — 2026-09-09

The user executed:

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

Deterministic metrics:

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

The answer bundle contains 58 requested citations, all 58 mapped successfully and zero unmapped citations. The `45/58` citation-precision numerator is the number of mapped citations overlapping a Golden Evidence label; it is not a mapping-success count.

## Independent semantic adjudication — COMPLETE

The repository owner explicitly delegated the final 50-answer adjudication to GPT-5.6 Sol rather than completing the manual worksheet. GPT-5.6 Sol is independent of the model under test (`gpt-6-astra`). This is an owner-authorized process exception and is recorded as an independent model review, not as a human review.

Integrity checks on the supplied answer bundle:

```text
rows: 50
query ids: dev-001..dev-050 exactly once
runtime identity: one frozen openai-codex/gpt-6-astra identity
answers file SHA-256: eed0f944d546220d96c82431e3dfd0037efb574d72e541ae1db09b9fa158ba2b
review digest: 0e450d064781a0390e192e4338e0b1cb45a43297ee2a5629428b3351f1dd9e84
```

Final semantic classifications:

```text
correct: 48
partially correct: 0
incorrect: 2
no-answer hallucinations: 2
version/conflict mistakes: 0
material Evidence omissions: 0
```

Incorrect cases:

1. `dev-015` — the corpus supports `.value`, but not the stronger negative claim that `.current` is definitively not exposed; frozen query category is no-answer.
2. `dev-032` — the v16.7.0 snapshot says `Selected options`; absence of `verbatimSymlinks` from a non-exhaustive list is not enough to support a definitive negative answer.

## Golden Dataset defect — dev-035

`dev-035` is categorized as `no-answer`, but the current challenge-expanded corpus directly answers it. The supplied `fsPromises.cp` snapshot describes directory-tree copying, and `challenge-node-fspromises-neighbors-a.md` explicitly says `fsPromises.copyFile()` copies a single file and is not a directory-tree interface.

Therefore `dev-035` is semantically **correct** in the independent review even though the frozen deterministic evaluator counts it as a no-answer task. The historical deterministic metrics are preserved unchanged for reproducibility; the dataset inconsistency is recorded instead of silently mutating labels or rerunning the provider.

## Interpretation

- Direct-file Pi achieved complete deterministic required-Evidence coverage on the frozen answerable set.
- Independent semantic review judged 48/50 answers correct.
- The two true failures are no-answer boundary failures; no material version/conflict mistakes were found.
- One of the three deterministic no-answer failures (`dev-035`) is attributable to stale/inconsistent Golden answerability after challenge-corpus expansion.
- Full model-answer latency was about 10.2 s median / 14.9 s p95 / 18.1 s max.

P2-T05/P2-T09 remain the retrieval-side comparison point: frozen plain SQLite FTS5 reached development Recall@10 `1.0`, MRR `0.9365079365079365`, and all-required Evidence coverage `1.0`. P2-T06 rejected both Dense candidates as regressions.

Retrieval-only latency and full model-answer latency are different operations and must not be compared as equivalent work.

## Tests / deterministic preparation

Support CI established focused evaluator tests/lint, frozen prepare-only execution, and later query-display regression protection. No provider credentials were used in CI.

## Acceptance

P2-T10 is **PASS**. Real development execution and final owner-authorized independent semantic adjudication are complete and recorded. No provider or holdout rerun was used for review.

Remaining ADR-029 decision-critical product evidence is P2-T11 fixed-version hands-on comparison. P3 remains prohibited until ADR-029 is formally Accepted.

## Out of scope

- changing Pi runtime behavior;
- modifying the frozen Golden Dataset in this task;
- existing-product comparison;
- retrieval ADR final acceptance;
- P3 answer-runtime implementation.
