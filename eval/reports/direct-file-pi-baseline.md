# P2-T10 — Direct-file Pi baseline

Status: **UNRUN / PARTIAL**

This is the product-value baseline: run the same fixed user queries by giving Pi the fixed source files directly, with no Knowledge retrieval/index ranking.

## Input discipline

For every query in a selected split, Pi receives:

- the original user query text;
- the same fixed P2 corpus file/path set;
- no Golden Evidence labels;
- no retrieval results/ranks;
- no answer key.

The corpus files are fixed SourceVersion snapshots. Do not substitute latest web content during the run.

## Runtime record

| Field | Result |
| --- | --- |
| Pi/runtime revision | UNRUN |
| model/provider revision | UNRUN |
| prompt/instruction revision | UNRUN |
| development query count | UNRUN |
| any-required Evidence coverage | UNRUN |
| all-required Evidence coverage | UNRUN |
| citation precision | UNRUN |
| no-answer correct abstention | UNRUN |
| latency median / p95 / max | UNRUN |
| manual answer correctness | UNRUN |
| operational notes | UNRUN |

## Citation scoring

After each run, citations/quotes are mapped **post hoc** to immutable Stable Evidence locators:

```text
sourceVersionId
parsedArtifactId
startByte
endByte
```

Those locators are not shown to the model as labels. Deterministic scoring measures required-Evidence coverage, citation precision and no-answer abstention.

## Manual answer-quality review

Citation overlap alone does not prove semantic correctness. A human review must additionally record, per query:

- correct / partially correct / incorrect;
- whether version/conflict distinctions are preserved;
- whether unsupported claims appear;
- whether no-answer cases abstain rather than hallucinate.

Do not use the same model under test as the sole answer-quality judge.

## Decision use

The final retrieval ADR must compare the selected Knowledge retrieval path against this baseline. If direct-file Pi is equally good, simpler, and operationally acceptable for the intended corpus size, the Knowledge retrieval stack must justify its complexity with concrete benefits such as scale, historical evidence stability, bounded scope or reuse.
