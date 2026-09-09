# Retrieval Evaluation Dataset

`eval/` is the repository-owned evidence base for P2 retrieval decisions.

```text
eval/
├── corpus/
├── queries/
├── labels/
├── fixtures/
└── reports/
```

The executable schema and cross-record validator live in `src/knowledge/eval/goldenDataset.ts`.

## Stability rule

Ground-truth labels address immutable historical content by:

```text
parsedArtifactId
sourceVersionId
startByte
endByte
exactQuote
quoteHash
```

A Golden Dataset label must never persist a Chunk id. Chunk identity belongs to a particular index/chunking experiment and is allowed to change between retrieval runs.

## Split rule

Queries declare either `development` or `holdout`.

- Development queries may be used to inspect failures and tune retrieval experiments.
- Holdout queries must not be used to choose tokenizer, weighting, embedding, fusion or other retrieval parameters.

## No-answer rule

A `no-answer` query has zero Evidence labels. Do not fabricate a weak range merely so every query has a target.

## Required evidence

Answerable queries need at least one `required` Evidence label. Additional `supporting` labels may be present. This supports later all-required-evidence coverage metrics without coupling labels to a retrieval implementation.

## Task ownership

P2-T01 defines the format only. P2-T02 adds the first representative corpus; P2-T03 adds the initial annotated query/label set; later tasks add generated reports without rewriting the ground truth to make a retrieval approach look better.