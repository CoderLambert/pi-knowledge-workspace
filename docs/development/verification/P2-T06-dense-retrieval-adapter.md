# P2-T06 verification — Dense retrieval adapter spike

Status: **PARTIAL — REAL QUALITY EVIDENCE COMPLETE / LINT CLEANUP OPEN**

## Completed evidence

GitHub Actions `P2 Dense Evidence` run `34327619600` executed the fixed development experiment with no user secrets.

Artifact: `10094533492`

Digest: `sha256:97ad25918c4d94b6d8f790d7ff77fce928df6462424f3f252188bd890559240c`

Focused contract/ancestry suite: **6 files / 19 tests PASS**.

Two fixed profiles were evaluated against the same frozen 38-chunk corpus and Stable Evidence labels:

- `intfloat/multilingual-e5-small@fd1525a9fd15316a2d503bf26ab031a61d056e98`;
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2@e8f8c211226b894fcb81acc59f3b34ba3efd5f42`.

Both are 384-dimensional, L2-normalized, CPU-executed via Python 3.12.14 + `sentence-transformers==5.7.0`.

## Frozen selection gate

P2-T05 FTS development baseline:

```text
Recall@10 = 1.0
MRR = 0.9365079365079365
all-required coverage = 1.0
```

Dense eligibility required:

1. no Recall@10 regression;
2. no all-required coverage regression;
3. MRR improvement >= `0.011904761904761904`.

Observed:

| Profile | Recall@10 | MRR | Coverage | Eligible |
| --- | ---: | ---: | ---: | --- |
| multilingual-e5-small | 0.9523809523809523 | 0.8462301587301588 | 0.9523809523809523 | no |
| multilingual MiniLM | 0.9285714285714286 | 0.7633219954648526 | 0.9285714285714286 | no |

`selectedProfileId = null` and `denseWorthCarryingForward = false`.

Dense holdout was intentionally **not run** because no development profile cleared the gate.

## Resource interpretation

E5 p95 was ~25.49 ms with peak RSS ~1.64 GB. MiniLM p95 was ~24.90 ms with peak RSS ~1.84 GB. These are GitHub-runner-specific CPU measurements, not Omarchy target-machine claims.

Target-machine Dense performance no longer blocks the retrieval decision because Dense already failed the quality gate before resource cost is considered.

## Repository-gate classification

The evidence workflow ran diagnostics without aborting on inherited failures.

Inherited/base failures remain in typecheck/build/pack/knip and broad lint output. Do not patch them in P2-T06 merely for green CI.

Three lint findings are P2-T06-owned and must be cleaned on the owning branch:

```text
src/knowledge/eval/denseRetrievalAdapter.test.ts
  no-inferrable-types
src/knowledge/eval/denseRetrievalAdapter.ts
  no-unnecessary-condition
  prefer-optional-chain
```

After those semantics-preserving lint fixes, rerun the focused Dense contract test and targeted lint for the two P2-T06 files. A full Dense model rerun is not required solely for style-only cleanup unless production behavior changes.

## Downstream rule

Do **not** continue P2-T07 sqlite-vec or P2-T08 Hybrid/RRF adoption evidence merely to preserve historical stack order. With Dense rejected, proceed directly to P2-T09 benchmark/report generation for the accepted FTS candidate.

## PASS condition

P2-T06 may become PASS when:

- the three task-attributable lint findings are removed;
- focused contract tests remain green;
- the recorded real Dense evidence remains unchanged/reproducible.

The Dense quality decision itself is already frozen and does not require Omarchy performance evidence.
