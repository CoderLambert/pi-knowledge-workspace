# P2-T06 — Dense retrieval adapter spike

Status: **PARTIAL**

## Objective

Introduce only the minimum dense-retrieval seam needed to evaluate one or two serious multilingual embedding profiles against the fixed P2 Golden Dataset.

## Direct base

P2-T05 / `experiment/p2-lexical-normalization` / PR #37.

This task is stacked and is not independently merge-safe before its base.

## Implemented scope

`src/knowledge/eval/denseRetrievalAdapter.ts` defines:

- explicit embedding profile metadata (`model`, `version`, `dimensions`, preprocessing id/prefixes/whitespace behavior);
- a maximum of two experiment profiles;
- deterministic query/document preprocessing;
- an adapter call wrapper that enforces vector count, dimensions, finite values, non-zero vectors and caller cancellation;
- a brute-force in-memory cosine index for evaluation only;
- SourceVersion allowlist filtering before ranking and Top-K;
- stable locator metadata on dense hits.

The in-memory index deliberately exists so embedding quality can be evaluated before P2-T07 decides whether sqlite-vec is deployable. It is not a production vector store.

## Tests written

`denseRetrievalAdapter.test.ts` covers:

- the two-profile maximum and duplicate profile rejection;
- deterministic preprocessing metadata behavior;
- adapter output count/dimension validation;
- cancellation before provider work;
- SourceVersion filtering before ranking/Top-K;
- explicit empty scope with no global fallback.

## Report integrity

`eval/reports/dense-retrieval.md` contains a two-slot profile table with model/version/dimension/preprocessing and retrieval metrics all marked `UNSET` / `UNRUN`.

No provider/model quality, latency or Recall/MRR result is fabricated. Exact profile records must be fixed before execution.

## Dependency assumptions / risk

P2-T06 depends on:

- P2 Golden Dataset Stable Evidence labels;
- P1 chunk SourceVersion/ParsedArtifact locator semantics;
- the P2-T04 metric definitions;
- development/holdout tuning discipline established in P2-T05.

P2-T04/P2-T05 real measurements remain OPEN. P2-T06 proceeds against their explicit contracts without treating them as PASS.

## Verification state

The GitHub automation environment cannot execute the repository dependency tree, embedding provider/model runtime or target resource measurements. Focused/static/build/package/full-suite gates and real profile runs remain OPEN; exact steps are documented in `docs/development/verification/P2-T06-dense-retrieval-adapter.md`.

## Out of scope

- sqlite-vec deployment/adoption;
- persistent vector schema/index;
- generic embedding provider registry;
- more than two model profiles;
- hybrid/RRF;
- reranking;
- P3 model runtime/answer generation.
