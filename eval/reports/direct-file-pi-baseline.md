# P2-T10 — Direct-file Pi baseline

Status: **DEVELOPMENT RUN COMPLETE / PARTIAL — HUMAN SEMANTIC REVIEW REQUIRED**

This is the product-value baseline: run the same fixed user queries by giving Pi the fixed source files directly, with no Knowledge retrieval/index ranking.

## Input discipline

For every development query, Pi receives:

- the original user query text;
- the same six fixed P2 corpus file/path snapshots;
- the same frozen system instructions;
- no Golden Evidence labels;
- no retrieval results/ranks;
- no answer key.

The corpus files are immutable SourceVersion snapshots. No latest web content is substituted. Holdout is not part of the current development harness.

## Frozen development identity

```text
repository/support SHA = db71e7c6d746709ce152269b68b020bd05bdb0dd
dataset hash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
system prompt SHA-256 = 8db92ab71e29b1f7228a5176e5f3de46f8eab02ad493896bc5a85e5463eddc16
queries = 50
corpus files = 6
Pi version = 0.85.1
provider = openai-codex
model = gpt-6-astra
api = openai-codex-responses
responseModel = null
thinkingLevel = null
```

The run was executed on the user's Omarchy/Linux checkout through support PR #53 using the existing authenticated Pi runtime. Provider credentials were not copied into repository evidence.

## Real development result

```text
queryCount: 50
answerableQueries: 42
noAnswerQueries: 8
anyRequiredEvidenceCoverage: 1.0
allRequiredEvidenceCoverage: 1.0
citationPrecision: 0.7758620689655172
noAnswerCorrectAbstentionRate: 0.625
latency median: 10165.077273999981 ms
latency p95: 14855.569325999997 ms
latency max: 18050.93610000005 ms
```

Readable latency summary:

```text
median ≈ 10.165 s
p95 ≈ 14.856 s
max ≈ 18.051 s
```

The citation precision corresponds to 45 valid mapped citations out of 58 total mapped+unmapped citations. The no-answer abstention rate corresponds to 5 correct abstentions out of 8 no-answer tasks.

## Interpretation

The direct-file path did retrieve/cite all required Evidence across the answerable development set according to deterministic Stable Evidence coverage, but it did not produce perfectly disciplined citations or abstentions:

- required-Evidence coverage is complete (`1.0`);
- citation precision is only about `77.6%`, so extra/wrong/missing/ambiguous citations are materially present;
- no-answer correct abstention is only `62.5%`, so three of eight no-answer cases failed the strict abstention contract;
- end-to-end model latency is orders of magnitude above the sub-millisecond FTS retrieval-only runner, though these measurements cover different work and must not be compared as equivalent operations.

This means direct-file Pi is a meaningful product baseline, but current development evidence does **not** establish it as a strictly simpler equivalent replacement for Knowledge retrieval.

## Citation scoring

After each model response, `{path, exactQuote}` citations are mapped **post hoc** to immutable Stable Evidence locators:

```text
sourceVersionId
parsedArtifactId
startByte
endByte
```

A citation maps only if its path belongs to the frozen task and its exact quote occurs verbatim and uniquely in that file.

Wrong paths, missing quotes and ambiguous quotes are preserved as unmapped citations. They are not silently removed: `unmappedCitationCount` contributes to the citation-precision denominator. A no-answer response is a correct abstention only when it explicitly reports insufficient evidence and emits neither mapped nor unmapped citations.

## Manual answer-quality review

Citation overlap alone does not prove semantic correctness. The generated local worksheet is:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-development.md
```

A human reviewer must still record, per query:

- correct / partially correct / incorrect;
- whether version/conflict distinctions are preserved;
- whether unsupported claims appear;
- whether important available evidence was omitted;
- whether no-answer cases abstain rather than hallucinate.

Do not use the model under test as the sole answer-quality judge.

## Canonical execution

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

The real 50-query development execution completed successfully. Do not rerun or tune against holdout before the development runtime/review criteria are frozen.

## Decision use

The final retrieval ADR must compare the selected Knowledge retrieval path against this baseline. P2-T05/P2-T09 already established the frozen FTS development retrieval candidate at Recall@10 `1.0`, MRR `0.9365079365079365`, and all-required Evidence coverage `1.0`; P2-T06 rejected Dense as lower quality.

P2-T10 remains **PARTIAL** only because independent human semantic review is still required before its product-value evidence can be accepted. ADR-029 remains blocked until this review and the applicable P2-T11 comparison evidence are resolved.
