# P2-T06 — Dense retrieval adapter spike

Status: **PASS — DENSE NOT JUSTIFIED**

## Decision

Two fixed multilingual embedding profiles were executed on the frozen P2 development corpus after P2-T05 froze the lexical baseline. Neither profile preserved the accepted FTS Recall@10 or all-required Evidence coverage, and both materially reduced MRR while adding substantial CPU/RSS cost.

**No Dense profile is selected. Dense retrieval is not carried forward.**

Consequences:

- Dense holdout is intentionally not executed because no development candidate cleared the predeclared gate;
- P2-T07 sqlite-vec and P2-T08 Hybrid/RRF are not justified as adoption evidence and must not be run merely to preserve historical task order;
- the evidence-backed retrieval candidate remains the P2-T05 FTS baseline.

## Frozen FTS comparison baseline

P2-T05 accepted development baseline, GitHub Actions run `34325709633`:

| Variant | Recall@10 | MRR | All-required coverage | Rank distribution |
| --- | ---: | ---: | ---: | --- |
| FTS baseline | 1.0 | 0.9365079365079365 | 1.0 | 37 R1 / 4 R2 / 1 R3 / 0 miss |

Dense materiality gate was frozen before model execution: preserve Recall@10=1 and all-required coverage=1, and improve development MRR by at least `1/(2*42) = 0.011904761904761904` (one Rank2→Rank1 equivalent across 42 answerable development queries).

## Fixed profiles

Runtime on the final verification run: GitHub Ubuntu 24.04, Python 3.12.14, `sentence-transformers==5.7.0`, Transformers 5.16.1, Torch 2.14.0+cu130, CPU. Embeddings were L2-normalized.

| Profile | Exact model revision | Dim | Preprocessing |
| --- | --- | ---: | --- |
| `multilingual-e5-small-fd1525a` | `intfloat/multilingual-e5-small@fd1525a9fd15316a2d503bf26ab031a61d056e98` | 384 | whitespace collapse; `query: ` / `passage: ` prefixes |
| `paraphrase-multilingual-minilm-l12-v2-e8f8c21` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2@e8f8c211226b894fcb81acc59f3b34ba3efd5f42` | 384 | whitespace collapse; no prefixes |

## Real development evidence

Canonical final verification: GitHub Actions `P2 Dense Evidence` run **34328138559**, task head `348b099bf65b1db71dfe1dd7af2137386a71f883`, artifact **10094742493**, artifact digest `sha256:74aa523dc5189e7a9054782f07eb4703e0924ae176a0b253aaccd827eab985bf`.

| Variant | Recall@10 | MRR | Coverage | Rank distribution | median / p95 / max query ms | Peak RSS | Document vector bytes |
| --- | ---: | ---: | ---: | --- | --- | ---: | ---: |
| FTS baseline | 1.0 | 0.9365079365079365 | 1.0 | 37 R1 / 4 R2 / 1 R3 / 0 miss | 0.774 / 1.318 / 2.833 | 83,435,520 B | n/a |
| E5 small | 0.9523809523809523 | 0.8462301587301588 | 0.9523809523809523 | 33 R1 / 3 R2 / 2 R3 / 2 R4-10 / 2 miss | 12.869 / 14.462 / 14.471 | 1,656,815,616 B | 58,368 B |
| Multilingual MiniLM | 0.9285714285714286 | 0.7633219954648526 | 0.9285714285714286 | 28 R1 / 5 R2 / 3 R3 / 3 R4-10 / 3 miss | 13.021 / 14.410 / 14.675 | 1,850,695,680 B | 58,368 B |

E5 deltas vs FTS:

```text
Recall@10: -0.04761904761904767
MRR:       -0.09027777777777768
coverage:  -0.04761904761904767
```

MiniLM deltas vs FTS:

```text
Recall@10: -0.0714285714285714
MRR:       -0.17318594104308394
coverage:  -0.0714285714285714
```

E5 load/build costs on the final run:

```text
model load: 8786.436 ms
warmup: 29.680 ms
document embedding/build: 561.974 ms
```

MiniLM:

```text
model load: 7374.032 ms
warmup: 16.570 ms
document embedding/build: 465.700 ms
```

These latency/RSS measurements are GitHub-runner-specific and are not Omarchy target-machine claims. Target-machine Dense performance does not block the decision because Dense already fails the quality gate.

## Development failure categories

E5 category failures:

```text
chinese-english-mixed: 2
version-error-code: 1
exact-api: 1
```

MiniLM category failures:

```text
exact-api: 3
chinese-english-mixed: 1
code-symbol: 2
english: 2
```

All 8 development no-answer queries produced Dense hits for both profiles; as with FTS, `retrieval hit != answerability`.

Development-only non-Rank-1 diagnostics were emitted by the evidence artifact. No holdout diagnostics were inspected or used.

## Selection result

```text
selectedProfileId = null
denseWorthCarryingForward = false
```

Neither candidate satisfies the first two non-regression requirements, and both regress MRR by far more than the materiality threshold. The result is therefore not a marginal complexity tradeoff: the Dense candidates are strictly worse on the frozen development quality criteria before resource cost is considered.

## Holdout discipline

**Dense holdout was not encoded or evaluated.** The evidence harness conditionally enters holdout only after a development winner is frozen. Since `selectedProfileId = null`, it printed `HOLDOUT SKIPPED` and `holdoutAcceptance = null`.

This is the required experiment outcome, not missing verification.

## Contract / repository verification

Final run:

```text
focused contract + ancestry tests: 6 files PASS / 19 tests PASS
P2-T06 task-owned lint errors: 0
```

The earlier run exposed three P2-T06-owned lint findings; they were repaired with semantics-preserving changes and the full model evidence was rerun. The final lint output contains 278 inherited errors and **no `denseRetrievalAdapter*` failures**.

Repository typecheck/build/pack remain blocked by inherited `viewerDispatch` / storage baseline errors; knip also reports inherited findings. They were not modified for green CI.

## Final P2-T06 conclusion

**PASS.** P2-T06 successfully answered its experimental question: the two fixed serious multilingual Dense candidates do not justify Dense complexity on this corpus.

Proceed directly to P2-T09 with the accepted FTS baseline as the retrieval strategy candidate. Keep P2-T07/P2-T08 historical experiment branches/PRs non-adopted until descendant restacking and branch cleanup are demonstrably safe.
