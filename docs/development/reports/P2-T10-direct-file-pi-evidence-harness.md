# P2-T10 support — Direct-file Pi evidence harness

Status: **PASS — REAL DEVELOPMENT HARNESS + OWNER-DELEGATED INDEPENDENT SEMANTIC REVIEW COMPLETE**

## Frozen real run

```text
repoSha = db71e7c6d746709ce152269b68b020bd05bdb0dd
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
Pi = 0.85.1
provider/model = openai-codex / gpt-6-astra
queries = 50
answerable/no-answer = 42 / 8
required Evidence coverage = 1.0 / 1.0
citationPrecision = 0.7758620689655172
noAnswerCorrectAbstentionRate = 0.625
```

The preserved `answers-development.jsonl` contains 58 requested citations, all 58 mapped and zero unmapped. The evaluator's `45/58` citation precision is Golden-label relevance, not mapping success.

## Independent semantic review

The repository owner explicitly delegated final adjudication to GPT-5.6 Sol, independent of the tested `gpt-6-astra`. This is an owner-authorized independent model review, not a human review.

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

Incorrect cases: `dev-015`, `dev-032`.

## Golden answerability defect

`dev-035` is categorized as `no-answer`, but the challenge-expanded corpus directly contains enough evidence to compare `fsPromises.cp` with `fsPromises.copyFile`. The model answer is semantically correct. Historical deterministic metrics remain frozen; the dataset inconsistency is recorded rather than repaired inside P2-T10.

## Review-helper defect history

The first assisted helper displayed `query.query` instead of Golden `query.text`, so its 50-row result (`46/1/3`, digest `044f7a1b...fc08`) remains provisional only. A corrected reconfirmation helper and query-display CI check were added and passed, but the owner subsequently delegated final adjudication directly from the uploaded answer bundle, so no provider/model rerun was needed.

## Canonical support CI

Dedicated repair run `34340358494` passed focused evaluator tests, ESLint, helper syntax, 50-query `query.text` display contract, and prepare-only harness. Artifact `10099478555`; digest `sha256:efd6c3cbc19cd7a9566a4df29f4f7f067b70c22457ec647b64bc0446156ece1f`.

## Scope

Direct-base support scope remains exactly five files:

```text
.github/workflows/p2-direct-file-pi-evidence.yml
scripts/p2-run-direct-file-pi-baseline.mjs
scripts/p2-reconfirm-direct-file-pi-review.mjs
docs/development/reports/P2-T10-direct-file-pi-evidence-harness.md
docs/development/verification/P2-T10-direct-file-pi-evidence-harness.md
```

No holdout rerun, no P3 implementation, and no automatic merge.
