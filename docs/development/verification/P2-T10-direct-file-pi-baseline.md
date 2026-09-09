# P2-T10 verification — Direct-file Pi baseline

Status: **OPEN / PARTIAL**

## 1. Focused protocol tests

```bash
npm test -- src/knowledge/eval/directFilePiBaseline.test.ts
```

PASS evidence:

- every query gets the same fixed sorted corpus snapshots;
- task/model input contains no Golden Evidence labels or retrieval ranks;
- deterministic Evidence coverage/citation/no-answer/latency scoring works;
- multi-source any-required vs all-required coverage is distinct;
- cross-split, duplicate and incomplete observations fail closed.

## 2. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Classify inherited failures rather than repairing unrelated code in this task.

## 3. Freeze the direct-file runtime

Before running the baseline, record:

```text
repository/Pi runtime revision
model/provider exact revision
prompt/instruction revision
selected split
fixed corpus revision/hash
file/path presentation method
runtime limits/timeouts
```

Do not change these during the comparison without creating a new baseline identity.

## 4. Run development tasks without Knowledge retrieval

Build tasks through:

```text
buildDirectFilePiTasks(dataset, "development")
```

For every task provide Pi only:

- original query;
- the fixed files/paths from the task;
- the frozen general instructions.

Do not expose Golden labels, expected quotes, retrieval ranks or answer keys.

Record raw answer text, runtime latency, explicit insufficient-evidence/abstention behavior and the source references/quotes Pi produced.

## 5. Map citations after inference

After each model run, map each cited fixed file + quote to:

```text
sourceVersionId
parsedArtifactId
startByte
endByte
```

using the immutable corpus snapshot. This is post-run evaluator work; do not feed mapped labels back into the model.

If a citation is ambiguous/incorrect and cannot be mapped uniquely, record it as an invalid/unmapped citation rather than forcing it onto the expected Evidence.

## 6. Deterministic scoring

Run:

```text
evaluateDirectFilePiBaseline(dataset, "development", observations)
```

Publish:

- any-required Evidence coverage;
- all-required Evidence coverage;
- citation precision;
- no-answer correct abstention rate;
- median/p95/max latency.

## 7. Human answer-quality review

Independently review each answer as:

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

The model under test must not be the sole judge. If a second reviewer is available, preserve disagreements rather than silently reconciling them.

## 8. Holdout discipline

Run holdout only after all direct-file instructions/runtime settings are frozen. Do not tune the baseline from holdout answers.

## 9. Direct-base scope

```bash
git diff --check origin/feat/p2-retrieval-benchmark-runner...HEAD
git diff --name-status origin/feat/p2-retrieval-benchmark-runner...HEAD
```

Expected P2-T10-only scope: direct-file task/evaluator contract, focused tests, UNRUN report, task report/verification and safe bookkeeping. No Knowledge retrieval implementation, product comparison or retrieval ADR belongs here.

## PASS condition

P2-T10 remains PARTIAL until repository gates, complete real Pi development-run observations, deterministic citation scoring, and human answer-quality review are recorded. Holdout may be added only after the baseline configuration is frozen.
