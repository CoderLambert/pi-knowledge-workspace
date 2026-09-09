# P2-T06 — Dense retrieval adapter spike

Status: **EXECUTED / DENSE NOT JUSTIFIED / PARTIAL**

## Decision

Two fixed multilingual profiles were executed against the frozen P2 development corpus. Neither preserved the accepted FTS Recall@10/all-required Evidence coverage, and both materially reduced MRR while adding substantial CPU/RSS cost.

**No Dense profile is selected. Dense retrieval is not carried forward.**

Consequences:

- do not run a Dense holdout profile because no development candidate cleared the predeclared gate;
- do not continue sqlite-vec or Hybrid/RRF merely to preserve the experiment stack;
- the current evidence-backed retrieval candidate remains the frozen P2-T05 FTS baseline.

## Frozen comparison baseline

P2-T05 accepted development baseline, GitHub Actions run `34325709633`:

| Variant | Recall@10 | MRR | All-required coverage | Rank distribution |
| --- | ---: | ---: | ---: | --- |
| FTS baseline | 1.0 | 0.9365079365079365 | 1.0 | 37 R1 / 4 R2 / 1 R3 / 0 miss |

Dense materiality gate was frozen before execution: preserve Recall@10=1 and all-required coverage=1, and improve development MRR by at least `1/(2*42) = 0.011904761904761904` (one Rank2→Rank1 equivalent across 42 answerable development queries).

## Fixed profiles

Runtime: GitHub Ubuntu 24.04, Python 3.12.14, `sentence-transformers==5.7.0`, Transformers 5.16.1, Torch 2.14.0+cu130 on CPU. Embeddings were L2-normalized.

| Profile | Exact model revision | Dim | Preprocessing |
| --- | --- | ---: | --- |
| `multilingual-e5-small-fd1525a` | `intfloat/multilingual-e5-small@fd1525a9fd15316a2d503bf26ab031a61d056e98` | 384 | whitespace collapse; `query: ` / `passage: ` prefixes |
| `paraphrase-multilingual-minilm-l12-v2-e8f8c21` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2@e8f8c211226b894fcb81acc59f3b34ba3efd5f42` | 384 | whitespace collapse; no prefix |

## Real development evidence

GitHub Actions `P2 Dense Evidence` run `34327619600`, artifact `10094533492`, digest `sha256:97ad25918c4d94b6d8f790d7ff77fce928df6462424f3f252188bd890559240c`.

| Variant | Recall@10 | MRR | Coverage | Rank distribution | p95 query | Peak RSS | Vector bytes |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| FTS baseline | 1.0 | 0.9365079365079365 | 1.0 | 37 R1 / 4 R2 / 1 R3 / 0 miss | ~1.318 ms | ~83 MB | n/a |
| E5 small | 0.9523809523809523 | 0.8462301587301588 | 0.9523809523809523 | 33 R1 / 3 R2 / 2 R3 / 2 R4-10 / 2 miss | 25.489 ms | 1,635,147,776 B | 58,368 document |
| Multilingual MiniLM | 0.9285714285714286 | 0.7633219954648526 | 0.9285714285714286 | 28 R1 / 5 R2 / 3 R3 / 3 R4-10 / 3 miss | 24.905 ms | 1,840,152,576 B | 58,368 document |

E5 deltas vs FTS: Recall `-0.047619`, MRR `-0.090278`, coverage `-0.047619`.

MiniLM deltas vs FTS: Recall `-0.071429`, MRR `-0.173186`, coverage `-0.071429`.

E5 model load was ~8.68 s and document embedding/build ~1.12 s. MiniLM load was ~6.79 s and document embedding/build ~0.91 s. These latency/RSS values are GitHub-runner-specific and are not Omarchy target-machine performance claims.

## Failure categories

E5 produced development failures in `chinese-english-mixed`, `version-error-code`, and `exact-api` categories. MiniLM produced failures in `exact-api`, `chinese-english-mixed`, `code-symbol`, and `english`.

The result is not a marginal complexity tradeoff: both Dense candidates regress quality before resource cost is considered.

## Holdout discipline

**Holdout was not executed.** No Dense profile cleared the frozen development gate, so executing holdout would provide no valid selection value and could only increase leakage risk.

## Contract verification

The focused Dense/Golden Dataset/challenge/FTS suites passed: 6 files / 19 tests.

Repository-wide typecheck/build/pack/knip remain blocked by inherited ancestry failures. Lint additionally identified three P2-T06-owned style errors in `denseRetrievalAdapter.ts` / `.test.ts`; those are task-attributable cleanup debt but do not change the measured Dense quality conclusion.

## Final P2-T06 retrieval conclusion

`selectedProfileId = null`

`denseWorthCarryingForward = false`

The evidence-backed next step is to bypass P2-T07/P2-T08 quality/deployment adoption work and generate the P2-T09 benchmark around the accepted FTS baseline, while retaining any already-written sqlite-vec/RRF PRs as non-adopted historical experiment branches until stack cleanup is safe.
