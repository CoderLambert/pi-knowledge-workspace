# P2-T10 — Direct-file Pi baseline

Status: **UNRUN / PARTIAL — REAL LOCAL DEVELOPMENT RUN REQUIRED**

This is the product-value baseline: run the same fixed user queries by giving Pi the fixed source files directly, with no Knowledge retrieval/index ranking.

## Input discipline

For every development query, Pi receives:

- the original user query text;
- the same six fixed P2 corpus file/path snapshots;
- the same frozen system instructions;
- no Golden Evidence labels;
- no retrieval results/ranks;
- no answer key.

The corpus files are immutable SourceVersion snapshots. Do not substitute latest web content during the run. Holdout is not part of the current development harness.

## Frozen development identity

```text
queries = 50
dataset hash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
```

Support PR #53 prepares and validates this exact task set in CI without calling a provider, then runs it locally through the user's authenticated Pi runtime.

## Runtime record

| Field | Result |
| --- | --- |
| Pi/runtime revision | UNRUN |
| actual provider/model identity | UNRUN |
| prompt/instruction SHA-256 | UNRUN |
| development query count | 50 (frozen; real observations UNRUN) |
| any-required Evidence coverage | UNRUN |
| all-required Evidence coverage | UNRUN |
| citation precision | UNRUN |
| no-answer correct abstention | UNRUN |
| latency median / p95 / max | UNRUN |
| manual answer correctness | UNRUN |
| unsupported-claim count | UNRUN |
| version/conflict mistakes | UNRUN |
| operational notes | UNRUN |

## Citation scoring

After each model response, `{path, exactQuote}` citations are mapped **post hoc** to immutable Stable Evidence locators:

```text
sourceVersionId
parsedArtifactId
startByte
endByte
```

A citation maps only if its path belongs to the frozen task and its exact quote occurs verbatim and uniquely in that file.

Wrong paths, missing quotes and ambiguous quotes are preserved as unmapped citations. They are not silently removed: `unmappedCitationCount` contributes to citation-precision denominator. A no-answer response is a correct abstention only when it explicitly reports insufficient evidence and emits neither mapped nor unmapped citations.

This prevents malformed model citations from inflating the direct-file baseline.

## Manual answer-quality review

Citation overlap alone does not prove semantic correctness. A human review must additionally record, per query:

- correct / partially correct / incorrect;
- whether version/conflict distinctions are preserved;
- whether unsupported claims appear;
- whether important available evidence was omitted;
- whether no-answer cases abstain rather than hallucinate.

Do not use the same model under test as the sole answer-quality judge.

## Canonical execution

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

The command exists on support PR #53 and consumes the user's existing local Pi authentication. No provider credentials belong in repository evidence.

## Decision use

The final retrieval ADR must compare the selected Knowledge retrieval path against this baseline. If direct-file Pi is equally good, simpler, and operationally acceptable for the intended corpus size, the Knowledge retrieval stack must justify its complexity with concrete benefits such as scale, historical evidence stability, bounded scope or reuse.
