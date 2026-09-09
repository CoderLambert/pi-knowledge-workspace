# P2-T10 — Direct-file Pi baseline

Status: **PASS — REAL DEVELOPMENT RUN + OWNER-DELEGATED INDEPENDENT SEMANTIC REVIEW COMPLETE**

This is the product-value baseline: run the same fixed user queries by giving Pi the fixed source files directly, with no Knowledge retrieval/index ranking.

## Input discipline

For every development query, Pi receives:

- the original user query text;
- the same six fixed P2 corpus file/path snapshots;
- the same frozen system instructions;
- no Golden Evidence labels;
- no retrieval results/ranks;
- no answer key.

The corpus files are immutable SourceVersion snapshots. No latest web content is substituted. Holdout is not part of this development run.

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

## Deterministic development result

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

### Citation-precision interpretation

`citationPrecision = 45/58` means 45 of the 58 mapped citations overlap at least one Golden Evidence label for their query. It does **not** mean only 45 citations mapped successfully. The preserved answer bundle contains 58 requested citations, all 58 mapped, and zero unmapped citations.

The precision denominator also counts valid-but-non-Golden citations, so a citation can reduce this metric without being malformed or fabricated.

## Owner-delegated independent semantic review — COMPLETE

The repository owner explicitly delegated final answer-quality adjudication to an independent reviewer rather than continuing the 50-row manual worksheet. The reviewer was GPT-5.6 Sol, which is not the model under test (`gpt-6-astra`). This is recorded as an explicit owner-authorized review-mode exception; it must not be described as a human review.

Reviewed evidence:

```text
answers-development.jsonl rows = 50
query ids = dev-001..dev-050 exactly once
runtime identity drift = none
uploaded answers file SHA-256 = eed0f944d546220d96c82431e3dfd0037efb574d72e541ae1db09b9fa158ba2b
independent review digest = 0e450d064781a0390e192e4338e0b1cb45a43297ee2a5629428b3351f1dd9e84
```

Semantic classifications:

```text
correct = 48
partially correct = 0
incorrect = 2
no-answer hallucinations = 2
version/conflict mistakes = 0
material Evidence omissions = 0
```

The two incorrect answers are:

- `dev-015`: the supplied Vue snapshot establishes `.value`, but does not explicitly establish the negative claim that `.current` is not exposed; the frozen query is a no-answer case.
- `dev-032`: the v16.7.0 snapshot explicitly says it lists **Selected options**; omission of `verbatimSymlinks` from that non-exhaustive list is insufficient support for a definitive negative answer.

No answerable task showed a material version/conflict error or required-Evidence omission in the independent review.

## Golden answerability defect discovered

`dev-035` is categorized as `no-answer`, but the current six-file corpus directly contains enough evidence to answer it:

- the `fsPromises.cp` snapshot states that `cp` copies an entire directory structure;
- `challenge-node-fspromises-neighbors-a.md` explicitly states that `fsPromises.copyFile()` copies a single file and is not a directory-tree copy interface.

Therefore the model's `dev-035` comparison is semantically **correct**, while the frozen deterministic evaluator still counts it among the eight no-answer tasks. Do not reinterpret the historical `5/8` abstention metric as seven semantically valid no-answer cases without recording this dataset defect.

The frozen deterministic result remains preserved for reproducibility; the semantic review records the defect rather than silently rewriting the dataset or rerunning the provider.

## Interpretation

The direct-file path is a strong product baseline:

- deterministic required-Evidence coverage is complete on the frozen answerable set;
- independent semantic review judged 48/50 answers correct;
- two failures are conservative no-answer boundary failures rather than version/conflict mistakes;
- the corpus/Golden mismatch at `dev-035` means the raw `5/8` abstention metric is pessimistic for one task;
- full model-answer latency remains about 10.2 s median / 14.9 s p95 / 18.1 s max.

This does **not** prove that direct-file Pi is a replacement for Knowledge retrieval. P2-T05/P2-T09 still establish the retrieval-side FTS candidate, and P2-T11 must still provide the fixed-version product comparison needed by ADR-029.

## Canonical execution

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

No provider rerun or holdout rerun was used for the semantic review.

## Decision use

P2-T10 is **PASS**: the real development run and final owner-authorized independent semantic adjudication are complete and recorded. The remaining ADR-029 product-evidence blocker is P2-T11 fixed-version hands-on comparison. P3 remains prohibited until ADR-029 is formally Accepted.
