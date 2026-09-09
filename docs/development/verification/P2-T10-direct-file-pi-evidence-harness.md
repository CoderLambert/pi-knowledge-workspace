# P2-T10 support verification — Direct-file Pi evidence harness

Status: **MODEL EVIDENCE PASS / HUMAN REVIEW RECONFIRMATION OPEN**

## 1. Frozen model run — PASS

The real local 50-query development run remains valid:

```text
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
repoSha = db71e7c6d746709ce152269b68b020bd05bdb0dd
Pi = 0.85.1
provider/model = openai-codex / gpt-6-astra
queryCount = 50
anyRequiredEvidenceCoverage = 1.0
allRequiredEvidenceCoverage = 1.0
citationPrecision = 0.7758620689655172
noAnswerCorrectAbstentionRate = 0.625
```

No holdout data was loaded or executed.

## 2. First human review — INVALID FOR FINAL ACCEPTANCE

The first helper used `query.query` while `eval/queries/development.jsonl` stores the user query in `text`.

Observable defect:

```text
QUERY
undefined
```

The completed first-pass summary is preserved but must not close P2-T10:

```text
46 correct / 1 partially correct / 3 incorrect
reviewDigest = 044f7a1bb1d150dc027e728d29e53a5b48e31208719da0e144a14e1916b8fc08
```

Reason: independent semantic review requires the reviewer to see the actual user question.

## 3. Query-display repair gate

CI must pass:

```bash
node --check scripts/p2-reconfirm-direct-file-pi-review.mjs
npx eslint scripts/p2-reconfirm-direct-file-pi-review.mjs
node scripts/p2-reconfirm-direct-file-pi-review.mjs --verify-query-display
```

The final command must verify all 50 Golden rows expose non-empty `text` values and emit first/last query text plus a query-text digest.

The ordinary evaluator tests, evaluator lint and prepare-only harness must remain green. CI must not invoke Pi/provider inference.

## 4. Human query-text reconfirmation

After updating the support branch, run:

```bash
node scripts/p2-reconfirm-direct-file-pi-review.mjs
```

The helper reads only the existing local evidence bundle and previous review. For every row it displays:

```text
real query.text
Pi answer
expected required Evidence
previous human classification
previous issue flags
```

Controls:

```text
Enter = keep previous classification
c = correct
p = partially correct
i = incorrect
q = save and quit
```

If the classification changes to a non-correct state, issue flags may be updated. Unchanged decisions preserve the prior issue flags and note.

## 5. Reconfirmation integrity

The helper must fail closed unless:

- dataset hash equals the frozen P2 development hash;
- model evidence contains exactly 50 answers;
- first-pass human review contains exactly 50 decisions;
- first-pass review belongs to the same dataset/repo SHA;
- each stored model `answer.query` exactly equals Golden `query.text`;
- reconfirmation resume state matches the same dataset SHA, evidence SHA, previous review digest and query-text digest.

This proves the model run itself used the correct query while isolating the defect to the old review display.

## 6. Final human evidence

Require all three local files:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-query-display-reconfirmation.json
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-query-display-reconfirmation.md
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-query-display-reconfirmation-summary.json
```

The final summary must include:

- queryCount = 50;
- correct / partially-correct / incorrect counts;
- unsupported-claim / version-conflict / no-answer-hallucination / Evidence-omission counts;
- unchanged vs changed decision counts;
- previous review digest;
- query-text digest;
- new SHA-256 review digest.

Only the corrected reconfirmation digest may be used as final P2-T10 semantic-review evidence.

## 7. Holdout discipline

Do not rerun the 50-query model baseline and do not execute holdout for tuning. The correction is review-display-only.

## 8. Scope

Compared with P2-T10 task base, PR #53 remains support-only. No production retrieval behavior, provider secret, dataset mutation, external-product comparison implementation, ADR selection or P3 code belongs here.

## PASS condition

P2-T10 can become **PASS** only after:

1. the query-display regression gate passes in CI; and
2. corrected human reconfirmation reaches 50/50 with a new digest bound to the exact query texts.
