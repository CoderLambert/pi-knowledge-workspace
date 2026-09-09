# P2-T04 FTS baseline

Status: **NOT EXECUTED — metrics intentionally unreported**

This report is the fixed publication target for the current P1 FTS5/SearchQuery baseline over the P2-T03 Golden Dataset.

## Metric contract

The baseline must publish, from one clean run:

- answerable-query Recall@10;
- MRR of the first required Stable Evidence overlap;
- all-required-Evidence coverage (diagnostic, also needed by later benchmark work);
- failure counts by query category;
- query latency median / p95 / max;
- peak process RSS;
- measured FTS/index bytes;
- no-answer query count and how many produced any lexical hit (diagnostic only; this is not no-answer accuracy because no-answer records intentionally have no positive relevance labels).

A search hit counts as relevant only when its SourceVersion + ParsedArtifact match a required label and its UTF-8 byte range overlaps that Stable Evidence range. Chunk identity is never ground truth.

## Current result

```text
query count:                    UNRUN
scored answerable queries:      UNRUN
no-answer queries:              UNRUN
Recall@10:                      UNRUN
MRR:                            UNRUN
all-required-Evidence coverage: UNRUN
category failure counts:        UNRUN
latency median/p95/max:         UNRUN
peak RSS bytes:                 UNRUN
FTS/index bytes:                UNRUN
```

No numeric value is inferred from source inspection or simulated output. This file must be updated only from a real repository run using the current `SearchQueryApi` / FTS5 implementation and the fixed P2-T03 data.

## Failure publication rule

When the run is executed, list every missed development query by id/category and the returned top hits. Do not publish only aggregate scores. Holdout failures may be aggregated for the final evaluation, but holdout content must not be used to tune P2-T05/P2-T08 parameters.
