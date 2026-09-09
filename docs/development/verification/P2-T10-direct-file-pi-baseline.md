# P2-T10 verification — Direct-file Pi baseline

Status: **PASS — DEVELOPMENT RUN AND INDEPENDENT SEMANTIC REVIEW COMPLETE**

## Runtime evidence

The frozen development execution completed all 50 tasks with:

```text
support SHA = db71e7c6d746709ce152269b68b020bd05bdb0dd
dataset hash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
Pi = 0.85.1
provider/model = openai-codex / gpt-6-astra
queries = 50
corpus files = 6
```

No Golden labels or retrieval ranks were model-facing.

## Deterministic result

```text
answerableQueries = 42
noAnswerQueries = 8
anyRequiredEvidenceCoverage = 1.0
allRequiredEvidenceCoverage = 1.0
citationPrecision = 0.7758620689655172
noAnswerCorrectAbstentionRate = 0.625
latency median = 10165.077273999981 ms
latency p95 = 14855.569325999997 ms
latency max = 18050.93610000005 ms
```

The preserved answer bundle contains 58 requested citations, all 58 mapped and zero unmapped. `45/58` is the count of mapped citations overlapping a Golden Evidence label, not a mapping-success count.

## Independent semantic review — PASS

The repository owner explicitly delegated final semantic adjudication to GPT-5.6 Sol. This reviewer is independent of the model under test (`gpt-6-astra`). This is recorded as an owner-authorized independent model review, not as a human review.

Integrity:

```text
rows = 50
query ids = dev-001..dev-050 exactly once
runtime identity drift = none
answers file SHA-256 = eed0f944d546220d96c82431e3dfd0037efb574d72e541ae1db09b9fa158ba2b
review digest = 0e450d064781a0390e192e4338e0b1cb45a43297ee2a5629428b3351f1dd9e84
```

Final classifications:

```text
correct = 48
partially correct = 0
incorrect = 2
no-answer hallucinations = 2
version/conflict mistakes = 0
material Evidence omissions = 0
```

Incorrect cases:

- `dev-015`: the evidence establishes `.value` but does not justify a definitive negative claim about `.current`.
- `dev-032`: the v16.7.0 snapshot lists **Selected options**; omission from that non-exhaustive list does not justify a definitive negative answer about `verbatimSymlinks`.

## Golden answerability defect

`dev-035` is categorized as `no-answer`, but the current six-file corpus directly contains enough evidence to compare `fsPromises.cp` and `fsPromises.copyFile`: the cp snapshot describes directory-tree copying and the challenge neighbor explicitly says `copyFile()` copies a single file and is not a directory-tree interface.

Therefore `dev-035` is semantically **correct** in the independent review. The historical deterministic `5/8` no-answer score is preserved unchanged for reproducibility; the dataset inconsistency is recorded rather than silently rewriting the dataset or rerunning the model.

## Holdout discipline

No P2-T10 holdout was executed for tuning or review.

## Scope

P2-T10 remains exactly five task files:

```text
src/knowledge/eval/directFilePiBaseline.ts
src/knowledge/eval/directFilePiBaseline.test.ts
eval/reports/direct-file-pi-baseline.md
docs/development/reports/P2-T10-direct-file-pi-baseline.md
docs/development/verification/P2-T10-direct-file-pi-baseline.md
```

## PASS condition

**PASS.** Development execution and final owner-authorized independent semantic adjudication are complete and recorded. ADR-029 now remains blocked only on P2-T11 fixed-version hands-on product evidence. P3 remains prohibited until ADR-029 is formally Accepted.
