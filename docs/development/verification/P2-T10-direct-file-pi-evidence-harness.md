# P2-T10 support verification — Direct-file Pi evidence harness

Status: **REAL DEVELOPMENT HARNESS PASS / HUMAN REVIEW OPEN**

## 1. CI preparation gate — PASS

Canonical final run: `34332760481`.

Observed results:

```text
focused evaluator suite = 1 file / 5 tests PASS
focused P2-T10 lint = PASS
prepare-only harness = PASS
queryCount = 50
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
systemPromptSha256 = 8db92ab71e29b1f7228a5176e5f3de46f8eab02ad493896bc5a85e5463eddc16
artifact = 10096440773
artifact digest = sha256:e65d56a823499760e80cbc832d06a1d6b3f789a8228aaaec17771174866dc88f
```

All preparation steps passed. The prepare-only path does not execute Pi/provider inference and requires no provider credential.

## 2. Local runtime precondition — PASS

The user's existing Omarchy Pi authentication was sufficient. No provider credentials were copied into repository files, GitHub Actions or evidence output.

## 3. Frozen development execution — PASS

Command executed:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

All 50 development queries completed.

Frozen runtime identity:

```text
repoSha = db71e7c6d746709ce152269b68b020bd05bdb0dd
Pi = 0.85.1
provider = openai-codex
model = gpt-6-astra
API = openai-codex-responses
responseModel = null
thinkingLevel = null
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
```

The harness did not report provider/model drift.

## 4. Model-input audit — PASS BY FROZEN HARNESS CONTRACT

For every query the invocation remained constrained to:

- original development query;
- exactly six frozen corpus file references;
- fixed system instructions;
- no Golden Evidence labels;
- no retrieval ranks/results;
- no tools/extensions/skills/prompts/themes/context files;
- no persistent Pi session.

`task-manifest-development.json` records `goldenLabelsModelFacing: false`.

## 5. Citation mapping audit — PASS BY EXECUTED CONTRACT

Requested citations were mapped only when:

```text
path belongs to frozen task
exactQuote is non-empty
exactQuote occurs verbatim exactly once
```

Mapped citations resolve to immutable:

```text
sourceVersionId
parsedArtifactId
startByte
endByte
```

Wrong, missing or ambiguous citations remain unmapped and increment `unmappedCitationCount`; they are not dropped before scoring.

## 6. Deterministic report — PASS

Real result:

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

Equivalent counts:

```text
valid mapped citations = 45 / 58 total mapped+unmapped citations
correct no-answer abstentions = 5 / 8
```

Evidence directory:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10
```

No holdout data was loaded or executed.

## 7. Independent human review — OPEN / REQUIRED

Complete:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-development.md
```

Every query must receive one correctness classification:

```text
correct
partially correct
incorrect
```

Also record:

- unsupported claims;
- version/conflict mistakes;
- no-answer hallucinations;
- important evidence omitted despite being present.

The model under test must not be the sole reviewer.

## 8. Evidence preservation

Preserve the complete local output directory, including raw Pi JSONL streams, until P2-T10 is accepted. Credentials and unrelated user files must not be added to repository evidence.

## 9. Holdout discipline

Do not execute P2-T10 holdout for tuning. Development configuration and review criteria are now frozen; any later holdout use must remain one-shot acceptance-only.

## 10. Direct-base scope

Compared with `experiment/p2-direct-file-pi-baseline`, support scope remains exactly:

```text
.github/workflows/p2-direct-file-pi-evidence.yml
scripts/p2-run-direct-file-pi-baseline.mjs
docs/development/reports/P2-T10-direct-file-pi-evidence-harness.md
docs/development/verification/P2-T10-direct-file-pi-evidence-harness.md
```

No production Knowledge retrieval change, provider secret, dataset mutation, product-comparison implementation, ADR decision or P3 code belongs here.

## PASS condition

The **support harness execution is PASS**: CI preparation and the complete local 50-query development run both succeeded and produced deterministic evidence. P2-T10 itself remains **PARTIAL** solely because independent human semantic review is still open.
