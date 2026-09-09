# P2-T10 support — Direct-file Pi evidence harness

Status: **REAL DEVELOPMENT RUN PASS / QUERY-TEXT HUMAN REVIEW RECONFIRMATION REQUIRED**

## Stable model evidence

The frozen 50-query Omarchy/Pi development run remains valid and unchanged:

```text
repoSha = db71e7c6d746709ce152269b68b020bd05bdb0dd
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
Pi = 0.85.1
provider/model = openai-codex / gpt-6-astra
queries = 50
answerable/no-answer = 42 / 8
any/all required Evidence coverage = 1.0 / 1.0
citation precision = 0.7758620689655172 (45/58)
no-answer correct abstention = 0.625 (5/8)
median/p95/max latency ms = 10165.077273999981 / 14855.569325999997 / 18050.93610000005
```

No holdout was executed.

## Human-review defect

The first assisted-review helper displayed the query using `query.query`. The Golden query schema uses `query.text`, so all 50 review screens showed `QUERY undefined`.

The first completed review is preserved as provisional evidence only:

```text
correct / partially correct / incorrect = 46 / 1 / 3
unsupported claims = 0
version/conflict mistakes = 0
no-answer hallucinations = 3
evidence omissions = 0
review digest = 044f7a1bb1d150dc027e728d29e53a5b48e31208719da0e144a14e1916b8fc08
```

This defect does not affect the model run, deterministic citation/Evidence metrics, or raw evidence. It affects only the independent semantic-review acceptance gate because the reviewer did not see the actual query text.

The defective helper has been removed from the support branch so it cannot be reused accidentally.

## Repair

The corrected helper reads the existing model evidence and previous human decisions:

```bash
node scripts/p2-reconfirm-direct-file-pi-review.mjs
```

For every query it shows:

- real Golden `query.text`;
- Pi answer;
- expected required Evidence;
- previous human classification and issue flags.

Controls:

```text
Enter = keep previous classification
c = correct
p = partially correct
i = incorrect
q = save and quit
```

It never invokes Pi/provider inference and never reruns the benchmark or holdout. Progress is resumable. The final digest is bound to the dataset hash, model-evidence repo SHA, previous review digest, exact query-text digest, and reconfirmed per-query decisions.

Output:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-query-display-reconfirmation.json
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-query-display-reconfirmation.md
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-query-display-reconfirmation-summary.json
```

## Regression gate

CI runs:

```bash
node --check scripts/p2-reconfirm-direct-file-pi-review.mjs
npx eslint scripts/p2-reconfirm-direct-file-pi-review.mjs
node scripts/p2-reconfirm-direct-file-pi-review.mjs --verify-query-display
```

The query-display check fails if the 50 development rows do not expose non-empty `text` fields and records a query-text digest. CI also reruns the focused evaluator tests/lint and frozen prepare-only contract without provider access.

## Acceptance boundary

P2-T10 remains **PARTIAL** until the corrected query-text reconfirmation reaches 50/50 and its aggregate summary/digest are recorded. The provisional `044f7a1b...fc08` review digest must not be used to mark P2-T10 PASS.

## Support scope

PR #53 remains support-only with exactly five direct-base files:

```text
.github/workflows/p2-direct-file-pi-evidence.yml
scripts/p2-run-direct-file-pi-baseline.mjs
scripts/p2-reconfirm-direct-file-pi-review.mjs
docs/development/reports/P2-T10-direct-file-pi-evidence-harness.md
docs/development/verification/P2-T10-direct-file-pi-evidence-harness.md
```

No production retrieval behavior, provider credential material, dataset mutation, P2-T11/P2-T12 implementation, holdout execution or P3 code is included.
