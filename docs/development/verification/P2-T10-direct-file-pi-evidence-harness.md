# P2-T10 support verification — Direct-file Pi evidence harness

Status: **PASS — SUPPORT HARNESS AND INDEPENDENT SEMANTIC REVIEW COMPLETE**

## Model evidence — PASS

The real 50-query development run remains frozen at:

```text
repoSha = db71e7c6d746709ce152269b68b020bd05bdb0dd
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
Pi = 0.85.1
provider/model = openai-codex / gpt-6-astra
```

Deterministic result:

```text
queryCount = 50
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

`answers-development.jsonl` contains 58 requested citations; all 58 mapped and zero were unmapped. `45/58` counts citations relevant to a Golden Evidence label.

## Owner-delegated independent semantic review — PASS

The repository owner delegated final semantic adjudication to GPT-5.6 Sol, independent of tested `gpt-6-astra`. This is an independent model review, not a human review.

```text
answers file SHA-256 = eed0f944d546220d96c82431e3dfd0037efb574d72e541ae1db09b9fa158ba2b
review digest = 0e450d064781a0390e192e4338e0b1cb45a43297ee2a5629428b3351f1dd9e84
correct = 48
partially correct = 0
incorrect = 2
no-answer hallucinations = 2
version/conflict mistakes = 0
material Evidence omissions = 0
```

Incorrect: `dev-015`, `dev-032`.

## Golden answerability defect — RECORDED

`dev-035` remains categorized as `no-answer`, but the current challenge corpus directly provides the comparison evidence between directory-tree `cp` and single-file `copyFile`. The model answer is semantically correct; deterministic historical metrics remain unchanged for reproducibility.

## Helper regression — CLOSED

The original review helper displayed `QUERY undefined` because it read `query.query` rather than `query.text`. Its first 50-row summary is provisional only. Repair CI run `34340358494` passed:

- focused evaluator tests;
- focused lint;
- corrected helper syntax;
- 50-query query-display contract;
- prepare-only harness.

Artifact `10099478555`, digest `sha256:efd6c3cbc19cd7a9566a4df29f4f7f067b70c22457ec647b64bc0446156ece1f`.

## Holdout discipline — PASS

No holdout or provider rerun was used for semantic review.

## Scope — PASS

Direct-base scope remains exactly five support files. No P3 code and no automatic merge.

## PASS condition

**PASS.** The support harness, real run, citation accounting, regression protection, and final owner-authorized independent semantic review are complete. P2-T10 is accepted; ADR-029 now remains blocked only on P2-T11 fixed-version hands-on product evidence.
