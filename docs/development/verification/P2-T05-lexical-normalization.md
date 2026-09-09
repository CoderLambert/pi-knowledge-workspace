# P2-T05 verification — Chinese / code lexical normalization experiment

Status: **OPEN / PARTIAL**

## 1. Focused deterministic tests

Run:

```bash
npm test -- \
  src/knowledge/eval/lexicalNormalization.test.ts \
  src/knowledge/eval/lexicalNormalizationEvaluation.test.ts
```

PASS evidence:

- baseline keeps original text unchanged;
- code-derived profile produces deterministic camel/dotted/snake/error-code/version aliases;
- CJK bigram/trigram profiles produce stable overlapping Han n-grams;
- profile comparison uses only development queries;
- holdout observations are rejected during tuning.

## 2. Static/build/package gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Classify inherited failures instead of patching unrelated PI WEB code merely to obtain green.

## 3. Real development-set experiment

Use the fixed P2-T02 corpus and P2-T03 **development** queries/labels only.

For each profile:

```text
baseline
code-derived
code-cjk-bigram
code-cjk-bigram-trigram
```

build a fresh comparable lexical index using the same:

- corpus/SourceVersions;
- ParsedArtifact bytes;
- chunking;
- Workspace scope;
- Top-K = 10;
- SearchQuery relevance contract.

The candidate index must preserve original text and append only the profile's derived terms. Normalized terms must not alter SourceVersion, ParsedArtifact or Stable Evidence identity.

Record one observation for every development query:

- ordered SearchQuery hit locators;
- latency;
- peak RSS;
- index bytes.

Feed those observations through `evaluateLexicalNormalizationDevelopment` / P2-T04 metric semantics.

## 4. Development selection discipline

Publish for every profile:

- Recall@10;
- MRR;
- all-required-Evidence coverage;
- failure counts for `chinese`, `chinese-english-mixed`, `code-symbol`, `version-error-code` and overall;
- median/p95/max latency;
- peak RSS;
- index bytes;
- representative missed-query details.

Select the least complex profile that provides a material targeted improvement without unacceptable overall/resource regression.

Do not inspect holdout metrics while making this selection.

If none materially improve the baseline, select `baseline` and record that result rather than keeping complexity by default.

## 5. One-shot holdout confirmation

Only after the profile is frozen, run the fixed 30-query holdout once. Publish its metrics separately and do not retune the selected profile from holdout failures within this task.

Any subsequent tuning requires a new documented experiment decision rather than silently contaminating the holdout.

## 6. Regression/full suite

```bash
npm test
git diff --check origin/experiment/p2-fts-baseline-report...HEAD
git diff --name-status origin/experiment/p2-fts-baseline-report...HEAD
```

The direct-base diff must be P2-T05-only: normalization experiment code/tests, experiment report, task report/verification and safe bookkeeping. No production FTS default change, dense/vector/RRF work or P2-T09 generic runner belongs here.

## Expected PASS evidence

P2-T05 may become PASS only when:

1. focused/static/build/package gates have no task-attributable failures;
2. all four profiles have real development-set measurements;
3. failure details and resource costs are published;
4. a least-complex winner or explicit baseline/no-improvement decision is recorded;
5. holdout is run only after selection and published without tuning contamination;
6. direct-base scope is task-only.

Until then the task remains PARTIAL and later P2 experiments may proceed against the explicit normalization interface/assumptions under the autonomous execution policy.
