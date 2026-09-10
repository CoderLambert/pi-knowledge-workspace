# P2-T03 — Query annotation report

Status: **PARTIAL**

Branch: `data/p2-query-annotation`  
Direct base: `data/p2-representative-corpus` (P2-T02 / PR #34)

## Objective

Create the first fixed retrieval-query annotation set for P2 without coupling ground truth to Chunk identity or a retrieval implementation.

Target from `DEVELOPMENT-PLAN.md`:

- 80 queries total;
- 50 development;
- 30 holdout;
- coverage across exact API, version/error-code, semantic, Chinese, English, Chinese-English mixed, code symbol, multi-source, conflict and no-answer cases.

## Implementation

Committed query files:

- `eval/queries/development.jsonl` — 50 records;
- `eval/queries/holdout.jsonl` — 30 records.

Committed Stable Evidence labels:

- `eval/labels/development.jsonl` — 45 labels covering 42 answerable development queries;
- `eval/labels/holdout.jsonl` — 29 labels covering 26 answerable holdout queries.

Twelve queries are intentionally `no-answer` and have no Evidence labels. Six explicit cross-version/multi-source comparison queries require Evidence from both captured Node SourceVersions.

Each Evidence label persists only historical authority:

```text
queryId
importance
parsedArtifactId
sourceVersionId
[startByte,endByte)
exactQuote
quoteHash
```

No Chunk id, retrieval score, rank, IndexBuild id or implementation-specific locator is stored.

## Annotation policy

- Positive labels are exact UTF-8 byte slices of the immutable P2-T02 corpus snapshots.
- `quoteHash` is SHA-256 over exactly the labeled bytes.
- A generic answer may use one authoritative snapshot when one is sufficient.
- Queries that explicitly compare both captured Node versions require two `required` labels from distinct SourceVersions.
- Negative factual questions with contradictory positive evidence remain answerable (for example, asking whether `force` defaults to false is grounded by the captured `default true` line).
- Questions whose requested fact is genuinely absent from the captured corpus are `no-answer`; absence is not fabricated into a pseudo-Evidence span.
- Holdout queries and labels are committed as fixed evaluation data and must not be inspected to tune P2 retrieval parameters.

## Integrity test

`src/knowledge/eval/queryAnnotations.test.ts` loads the real committed corpus metadata, queries and labels and checks:

- Golden Dataset schema validity;
- exact 50/30 split;
- all planned query categories represented;
- exactly 12 no-answer queries with zero labels;
- every answerable query has required Evidence through the schema validator;
- each explicit multi-source comparison has required labels from at least two SourceVersions;
- every label range is inside its ParsedArtifact bytes;
- byte slice equals `exactQuote` exactly;
- SHA-256 of the exact slice equals `quoteHash`;
- SourceVersion lineage matches the referenced ParsedArtifact.

## Dependency assumptions

P2-T03 consumes the still-PARTIAL P2-T01 Golden Dataset schema and P2-T02 corpus as fixed contracts. It does not assume P1 retrieval quality, Chunk identity, tokenizer behavior, embedding availability or final retrieval architecture.

The committed corpus is intentionally small; repeated questions are acceptable at this stage because P2-T04/T05 need controlled paraphrase/category failures. The holdout split must remain tuning-blind after this task.

## Verification state

The GitHub automation environment cannot execute the repository dependency tree or local checkout, and no GitHub Actions status is available for this task HEAD. Focused/static/build/package/full-suite execution therefore remains OPEN verification debt.

No executable gate is represented as PASS without evidence.

## Scope boundary

P2-T03 contains only query/label annotations, annotation integrity coverage and task documentation. It does not implement FTS benchmarking, tokenizer normalization, dense retrieval, vectors, RRF, benchmark execution, model calls or P3 behavior.
