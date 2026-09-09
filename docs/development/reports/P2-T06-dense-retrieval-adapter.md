# P2-T06 — Dense retrieval adapter spike

Status: **PARTIAL — QUALITY DECISION FROZEN: DENSE NOT JUSTIFIED**

## Objective

Evaluate at most two serious fixed multilingual embedding profiles against the frozen P2 development corpus before adopting any vector database or Hybrid path.

## Stack

Canonical implementation remains PR #38 / `experiment/p2-dense-retrieval-adapter`, stacked over support PR #51 / `chore/p2-t06-dense-evidence-harness`, which itself is based on accepted P2-T05 / PR #37.

No duplicate task branch was created.

## Implemented contract

The task owns only the minimum evaluation seam:

- explicit model/version/dimension/preprocessing identity;
- at most two profiles;
- deterministic query/document preprocessing;
- vector count/dimension/finite/non-zero validation;
- cancellation propagation;
- brute-force in-memory cosine evaluation index;
- SourceVersion filtering before ranking/Top-K;
- Stable Evidence-compatible SourceVersion/ParsedArtifact UTF-8 locators.

No production vector store/provider registry is introduced.

## Fixed profiles

Support PR #51 froze both candidates before execution:

1. `intfloat/multilingual-e5-small@fd1525a9fd15316a2d503bf26ab031a61d056e98`, 384 dimensions, `query:` / `passage:` prefixes;
2. `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2@e8f8c211226b894fcb81acc59f3b34ba3efd5f42`, 384 dimensions, identity prefixing.

Both use whitespace collapse and L2-normalized SentenceTransformer embeddings. Runtime was Python 3.12.14 + `sentence-transformers==5.7.0`, CPU, no user secret.

## Real GitHub Actions evidence

Run: `34327619600`

Artifact: `10094533492`

Artifact digest: `sha256:97ad25918c4d94b6d8f790d7ff77fce928df6462424f3f252188bd890559240c`

Focused contract/ancestry suite: **6 files / 19 tests PASS**.

Frozen FTS development baseline from P2-T05:

```text
Recall@10: 1.0
MRR: 0.9365079365079365
all-required coverage: 1.0
37 R1 / 4 R2 / 1 R3 / 0 miss
```

### multilingual-e5-small

```text
Recall@10: 0.9523809523809523
MRR: 0.8462301587301588
all-required coverage: 0.9523809523809523
33 R1 / 3 R2 / 2 R3 / 2 R4-10 / 2 miss
p95: 25.489 ms
peak RSS: 1,635,147,776 bytes
model load: ~8.68 s
document build: ~1.12 s
document vectors: 58,368 bytes
```

### paraphrase-multilingual-MiniLM-L12-v2

```text
Recall@10: 0.9285714285714286
MRR: 0.7633219954648526
all-required coverage: 0.9285714285714286
28 R1 / 5 R2 / 3 R3 / 3 R4-10 / 3 miss
p95: 24.905 ms
peak RSS: 1,840,152,576 bytes
model load: ~6.79 s
document build: ~0.91 s
document vectors: 58,368 bytes
```

GitHub latency/RSS are runner-specific and are not claims about the user's Omarchy machine.

## Selection rule and result

The predeclared development gate required a Dense profile to:

1. preserve Recall@10 = 1;
2. preserve all-required Evidence coverage = 1;
3. improve MRR over FTS by at least `0.011904761904761904` (one Rank2→Rank1 equivalent across 42 answerable development queries).

Neither candidate passed even the first two conditions; both also materially regressed MRR.

Therefore:

```text
selectedProfileId: null
denseWorthCarryingForward: false
```

**Dense retrieval is not justified by P2 development evidence.**

## Holdout discipline

Dense holdout was correctly skipped because no profile cleared the development gate. No holdout diagnostic was used for selection.

## Downstream decision

P2-T07 sqlite-vec deployment and P2-T08 Hybrid/RRF are no longer required evidence for ADR-029 unless a future explicit architecture decision reopens Dense. They must not be run merely because their historical experiment PRs exist.

Proceed to P2-T09 with the accepted FTS baseline as the retrieval candidate.

## Gate classification

The dedicated evidence workflow succeeded. Repository-wide typecheck/build/pack and knip failures are inherited from base ancestry and are not repaired here.

Lint identified exactly three P2-T06-owned style errors in `denseRetrievalAdapter.ts` / `.test.ts`; those remain task-attributable cleanup debt. This keeps the task formally PARTIAL until the owning branch is lint-clean, but does not reopen the already frozen retrieval-quality conclusion.

## Out of scope

- sqlite-vec adoption;
- persistent vector schema/index;
- Hybrid/RRF adoption;
- reranking;
- P3 model runtime/answer generation.
