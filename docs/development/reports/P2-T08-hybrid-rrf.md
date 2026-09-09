# P2-T08 — Hybrid + RRF experiment

Status: **PARTIAL**

## Objective

Compare the smallest hybrid candidate only after Dense is shown usable:

```text
FTS
Dense
FTS + Dense + RRF
```

No reranker belongs to this task.

## Direct base

P2-T07 / `experiment/p2-sqlite-vec-deployment` / PR #39.

This task is stacked and is not independently merge-safe before its base.

## Implemented scope

`src/knowledge/eval/hybridRrf.ts` implements evaluation-only reciprocal-rank fusion with:

- stable result identity from `sourceVersionId + parsedArtifactId + [startByte,endByte)`;
- no Chunk identity requirement across retrievers;
- SourceVersion allowlist filtering before fusion/final Top-K;
- explicit empty scope with no global fallback;
- default experiment `rrfK=60`, bounded/overridable and required to be recorded with results;
- duplicate locator rejection within each ranked list;
- deterministic tie-breaking by fused score, best original rank and stable locator;
- bounded result limit.

The function accepts already-ranked lexical/dense hit lists and performs no retrieval itself. This keeps FTS and Dense independently testable and avoids coupling fusion to sqlite-vec or any provider.

## Tests written

`hybridRrf.test.ts` covers:

- same Stable locator boosted when retrieved by both systems;
- lexical-only and dense-only preservation;
- scope-before-fusion/Top-K;
- explicit empty scope;
- stable-locator rather than Chunk identity;
- duplicate locator rejection;
- deterministic tie ordering.

## Report integrity

`eval/reports/hybrid-rrf.md` contains FTS / Dense / Hybrid comparison rows with all metrics `UNRUN`. No hybrid adoption or quality claim is made before P2-T06 Dense evidence exists.

## Dependency assumptions / risk

P2-T08 depends on:

- a frozen P2-T05 lexical profile or explicit baseline decision;
- a reproducibly useful frozen P2-T06 Dense profile;
- P2-T04 Stable Evidence metric semantics.

P2-T07 sqlite-vec adoption is **not** required for fusion evaluation because the P2-T06 in-memory index can supply Dense rankings. All these quality/deployment decisions remain PARTIAL until real execution.

Under the autonomous execution policy, implementing the narrow fusion contract is allowed while these invariants remain unverified, but this task cannot become PASS or select Hybrid until real comparative evidence exists.

## Out of scope

- reranking;
- production search routing/default changes;
- provider/vector-store selection;
- parameter-grid tuning;
- P2-T09 generic report runner;
- P3 answer generation.
