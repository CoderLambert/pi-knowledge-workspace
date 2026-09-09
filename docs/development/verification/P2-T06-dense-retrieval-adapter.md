# P2-T06 verification — Dense retrieval adapter spike

Status: **PASS**

## Acceptance evidence

Canonical final revalidation: GitHub Actions `P2 Dense Evidence` run `34328197349` on the PR #38 merge ref.

Artifact: `10094752313`

Digest: `sha256:d730bcc8ea55dc1647a5312ab38d2a10ba74e28d09daabffeb2322cd338ae0ff`

Focused contract/ancestry suite: **6 files / 19 tests PASS**.

The final run also repeated the complete fixed-model development experiment. Quality metrics and rank distributions reproduced exactly; only runner-specific timing/RSS varied.

Two profiles were fixed before execution and evaluated against the same frozen corpus and Stable Evidence labels:

- `intfloat/multilingual-e5-small@fd1525a9fd15316a2d503bf26ab031a61d056e98`;
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2@e8f8c211226b894fcb81acc59f3b34ba3efd5f42`.

Both are 384-dimensional and L2-normalized. The evidence runtime used Python 3.12.14 + `sentence-transformers==5.7.0` on CPU with no user secret.

## Frozen selection gate

P2-T05 FTS development baseline:

```text
Recall@10 = 1.0
MRR = 0.9365079365079365
all-required coverage = 1.0
37 R1 / 4 R2 / 1 R3 / 0 miss
```

Dense eligibility required:

1. no Recall@10 regression;
2. no all-required coverage regression;
3. MRR improvement >= `0.011904761904761904`.

Final reproduced quality:

| Profile | Recall@10 | MRR | Coverage | Rank distribution | Eligible |
| --- | ---: | ---: | ---: | --- | --- |
| multilingual-e5-small | 0.9523809523809523 | 0.8462301587301588 | 0.9523809523809523 | 33 R1 / 3 R2 / 2 R3 / 2 R4-10 / 2 miss | no |
| multilingual MiniLM | 0.9285714285714286 | 0.7633219954648526 | 0.9285714285714286 | 28 R1 / 5 R2 / 3 R3 / 3 R4-10 / 3 miss | no |

Result:

```text
selectedProfileId = null
denseWorthCarryingForward = false
```

Dense holdout was intentionally **not run** because no development profile cleared the frozen gate. This is the required tuning-blind outcome, not missing verification.

## Task-owned lint closure

The first real evidence run found exactly three P2-T06-owned lint findings:

```text
src/knowledge/eval/denseRetrievalAdapter.test.ts
  no-inferrable-types
src/knowledge/eval/denseRetrievalAdapter.ts
  no-unnecessary-condition
  prefer-optional-chain
```

They were fixed with semantics-preserving changes. Final run `34328197349` reported:

```text
278 lint errors total
0 denseRetrievalAdapter.ts errors
0 denseRetrievalAdapter.test.ts errors
```

The 278 remaining lint errors reproduce inherited ancestry debt. P2-T06 introduces no residual task-owned lint failure.

## Repository-gate attribution

The evidence workflow intentionally executes broad diagnostics with inherited failures allowed so attribution can be recorded instead of patching unrelated code.

Final revalidation reproduced the inherited signatures:

- typecheck/build/pack: existing `viewerDispatch` / storage baseline TypeScript errors;
- knip: existing `better-sqlite3`, `createKnowledgeViewerDispatch`, and configuration findings;
- broad lint: 278 inherited errors.

None are in P2-T06 task-owned files. They are not repaired in this experiment merely to obtain green repository-wide CI.

## Resource interpretation

Latest GitHub-runner measurements were approximately:

```text
E5 p95: 25.012 ms; peak RSS: 1,628,319,744 B
MiniLM p95: 24.345 ms; peak RSS: 1,838,788,608 B
```

These are GitHub-runner-specific CPU measurements, not Omarchy target-machine claims. Target-machine Dense performance does not block the decision because Dense already failed the quality gate before resource cost is considered.

## Downstream rule

Do **not** continue P2-T07 sqlite-vec or P2-T08 Hybrid/RRF adoption evidence merely to preserve historical stack order. Dense is rejected by development evidence.

Proceed to P2-T09 with the accepted P2-T05 FTS baseline as the retrieval candidate, after removing the non-adopted #39/#40 ancestry from the downstream stack.

## Acceptance

**PASS.** The experiment is reproducible, the task-owned code is lint-clean, focused tests remain green, and the Dense quality conclusion is unchanged under full revalidation.
