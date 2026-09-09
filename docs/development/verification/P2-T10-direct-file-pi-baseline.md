# P2-T10 verification — Direct-file Pi baseline

Status: **PARTIAL — AUTOMATED DEVELOPMENT EVIDENCE COMPLETE / HUMAN REVIEW REQUIRED**

## 1. Focused protocol tests — PASS

```bash
npm test -- src/knowledge/eval/directFilePiBaseline.test.ts
```

Final CI preparation evidence on support PR #53 / Actions run `34332760481`:

```text
1 file / 5 tests PASS
focused P2-T10 lint PASS
```

Verified invariants:

- every query gets the same fixed sorted corpus snapshots;
- task/model input contains no Golden Evidence labels or retrieval ranks;
- deterministic Evidence coverage/citation/no-answer/latency scoring works;
- multi-source any-required vs all-required coverage is distinct;
- unmapped/wrong citations reduce citation precision rather than disappearing;
- a no-answer response with any mapped or unmapped citation does not count as a correct abstention;
- cross-split, duplicate and incomplete observations fail closed.

## 2. Repository gates — CLASSIFIED

Ordinary repository CI still reproduces inherited failures outside P2-T10-owned files. P2-T10-focused tests/lint are green. Do not repair unrelated ancestry merely to obtain a global green run.

## 3. Frozen direct-file runtime — PASS

Real development identity:

```text
support repository SHA: db71e7c6d746709ce152269b68b020bd05bdb0dd
Pi version: 0.85.1
provider: openai-codex
model: gpt-6-astra
API: openai-codex-responses
responseModel: null
thinkingLevel: null
split: development
dataset hash: 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
system prompt SHA-256: 8db92ab71e29b1f7228a5176e5f3de46f8eab02ad493896bc5a85e5463eddc16
fixed corpus files: 6
queries: 50
```

The local harness failed closed on provider/model drift across the run. No credentials were copied into repository evidence.

## 4. Development run without Knowledge retrieval — PASS

Canonical command:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

The user executed the command on Omarchy/Linux and all 50 development tasks completed.

For every task Pi received only:

- original query;
- the same six fixed corpus files;
- frozen system instructions.

No Golden labels, expected quotes, retrieval ranks/results or answer keys were model-facing.

## 5. Post-inference citation mapping — PASS

Pi returned file/path + exact quote citations. The harness mapped citations only when the path belonged to the frozen task and the quote was a unique verbatim occurrence in that file.

Wrong paths, missing quotes and ambiguous quotes were retained as unmapped and counted in `unmappedCitationCount`; they were not discarded before scoring.

## 6. Deterministic scoring — PASS

Real development result:

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

Equivalent counts:

```text
valid mapped citations: 45 / 58 total mapped+unmapped citations
correct no-answer abstentions: 5 / 8
```

Evidence output directory:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10
```

## 7. Human answer-quality review — OPEN / REQUIRED

Review the generated worksheet:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-development.md
```

Independently classify every development answer as:

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

The model under test must not be its own sole judge. This human review is the only remaining P2-T10 acceptance blocker.

## 8. Holdout discipline

Do **not** run P2-T10 holdout for tuning. Development runtime, instructions and review criteria must remain frozen. Any eventual holdout use must be one-shot acceptance-only after the development decision is fixed.

## 9. Comparison context

Frozen Knowledge retrieval-side evidence remains:

```text
SQLite FTS5 development Recall@10: 1.0
SQLite FTS5 development MRR: 0.9365079365079365
SQLite FTS5 all-required Evidence coverage: 1.0
Dense: rejected by P2-T06 development evidence
```

Do not compare FTS retrieval-only milliseconds directly against full model answer latency as equivalent operations. Product-value comparison must consider answer quality, citation discipline, abstention, historical Evidence semantics, scope/reuse and operational complexity.

## 10. Direct-base scope

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

Automated P2-T10 development evidence is complete. P2-T10 remains **PARTIAL** until the independent human semantic review is completed and recorded. ADR-029 remains blocked; P3 remains prohibited.
