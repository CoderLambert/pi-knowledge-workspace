# P2-T08 — Hybrid + RRF experiment

Status: **UNRUN / PARTIAL**

## Comparison

The only planned retrieval comparison in this task is:

```text
FTS
Dense
FTS + Dense + RRF
```

No reranker is included.

| Variant | Recall@10 | MRR | all-required coverage | p95 latency | peak RSS | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| FTS | UNRUN | UNRUN | UNRUN | UNRUN | UNRUN | use current selected lexical profile/baseline |
| Dense | UNRUN | UNRUN | UNRUN | UNRUN | UNRUN | requires one frozen P2-T06 profile |
| Hybrid RRF | UNRUN | UNRUN | UNRUN | UNRUN | UNRUN | exact Stable-locator fusion |

## Fusion identity

A cross-retriever result is identified by:

```text
sourceVersionId
parsedArtifactId
startByte
endByte
```

Chunk ids are not used for fusion identity because FTS and Dense may use different indexing implementations while Stable Evidence remains ParsedArtifact-range based.

## RRF rule

Default experiment parameter:

```text
rrfK = 60
score = sum(1 / (rrfK + rank))
```

`rrfK` is an experiment parameter and must be recorded with results. This task does not tune a broad parameter grid. Any value change must be explicit and development-set only.

## Scope discipline

Workspace/SourceVersion constraints must be applied by each retriever before ranking. `reciprocalRankFusion` additionally accepts an allowed SourceVersion set and removes out-of-scope hits before fusion and final Top-K. There is no global Top-K followed by scope filtering.

## Evaluation discipline

1. Use the same fixed development queries and Stable Evidence labels for all three variants.
2. Use the selected/frozen lexical profile from P2-T05, or baseline if no lexical variant was adopted.
3. Use one frozen Dense profile from P2-T06 only if Dense has real reproducible evidence; otherwise leave Dense/Hybrid `UNRUN` and do not claim P2-T08 success.
4. Compare category failures and representative misses, not only aggregate metrics.
5. Record latency/resource overhead of running both retrievers and fusion.
6. Freeze the hybrid configuration before one-shot holdout confirmation.

## Decision state

No hybrid adoption decision is made yet. If Dense does not prove useful or the fused variant does not materially beat the simpler alternative, keep the simpler retrieval path.
