# P2-T10 verification — Direct-file Pi baseline

Status: **OPEN / PARTIAL — LOCAL REAL RUN + HUMAN REVIEW REQUIRED**

## 1. Focused protocol tests

```bash
npm test -- src/knowledge/eval/directFilePiBaseline.test.ts
```

PASS evidence requires:

- every query gets the same fixed sorted corpus snapshots;
- task/model input contains no Golden Evidence labels or retrieval ranks;
- deterministic Evidence coverage/citation/no-answer/latency scoring works;
- multi-source any-required vs all-required coverage is distinct;
- unmapped/wrong citations reduce citation precision rather than disappearing;
- a no-answer response with any mapped or unmapped citation does not count as a correct abstention;
- cross-split, duplicate and incomplete observations fail closed.

Focused task lint:

```bash
npx eslint \
  src/knowledge/eval/directFilePiBaseline.ts \
  src/knowledge/eval/directFilePiBaseline.test.ts
```

Task-owned findings must be zero before PASS.

## 2. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Classify inherited failures against the direct base rather than repairing unrelated code in P2-T10.

## 3. Freeze the direct-file runtime

Before the real baseline, record:

```text
repository/Pi runtime revision
actual provider/model identity
prompt/instruction revision
selected split
fixed corpus revision/hash
file/path presentation method
runtime limits/timeouts
```

Do not change these during the comparison without creating a new baseline identity.

Support PR #53 automates this provenance collection and fails closed if provider/model identity changes across the development run.

## 4. Run development tasks without Knowledge retrieval

Canonical support command:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

The harness constructs tasks through:

```text
buildDirectFilePiTasks(dataset, "development")
```

For every task Pi receives only:

- original query;
- the same six fixed corpus files;
- frozen system instructions.

Do not expose Golden labels, expected quotes, retrieval ranks/results or answer keys.

The support harness disables Pi tools, extensions, skills, prompt templates, themes, context files and persistent sessions for the run.

## 5. Map citations after inference

Pi returns file/path + exact quote citations. After each model run, map each citation to:

```text
sourceVersionId
parsedArtifactId
startByte
endByte
```

using the immutable corpus snapshot.

Mapping succeeds only when the path is in the frozen task and the quote is a unique verbatim occurrence in that file.

If a citation has a wrong path, missing quote or ambiguous quote, preserve it as unmapped and increment `unmappedCitationCount`. Never discard invalid citations before scoring.

## 6. Deterministic scoring

Run:

```text
evaluateDirectFilePiBaseline(dataset, "development", observations)
```

Publish:

- any-required Evidence coverage;
- all-required Evidence coverage;
- citation precision, including unmapped citations in the denominator;
- no-answer correct abstention rate;
- median/p95/max end-to-end Pi latency.

A no-answer observation is a correct abstention only if `insufficientEvidence=true`, mapped citations are empty and `unmappedCitationCount=0`.

## 7. Human answer-quality review

Independently review every development answer as:

```text
correct
partially correct
incorrect
```

Also record:

- unsupported claims;
- version/conflict mistakes;
- no-answer hallucinations;
- important evidence omitted despite being present in supplied files.

The model under test must not be the sole judge. Preserve reviewer disagreement if a second reviewer is used.

Support PR #53 generates `human-review-development.md` from the real run.

## 8. Holdout discipline

Do **not** run P2-T10 holdout in the current support harness. Development instructions/runtime/review criteria must first be frozen and accepted. Holdout must never feed retuning in the same experiment cycle.

## 9. Direct-base scope

```bash
git diff --check origin/feat/p2-retrieval-benchmark-runner...HEAD
git diff --name-status origin/feat/p2-retrieval-benchmark-runner...HEAD
```

Expected P2-T10-only scope remains exactly:

```text
src/knowledge/eval/directFilePiBaseline.ts
src/knowledge/eval/directFilePiBaseline.test.ts
eval/reports/direct-file-pi-baseline.md
docs/development/reports/P2-T10-direct-file-pi-baseline.md
docs/development/verification/P2-T10-direct-file-pi-baseline.md
```

No Knowledge retrieval implementation, provider secret, product comparison, ADR selection or P3 implementation belongs here.

## PASS condition

P2-T10 remains PARTIAL until repository/task gates are classified, the complete real 50-query Pi development observations are recorded, deterministic citation/Evidence scoring is generated, and independent human answer-quality review is completed.
