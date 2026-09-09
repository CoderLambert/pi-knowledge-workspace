# P2-T10 support verification — Direct-file Pi evidence harness

Status: **REAL DEVELOPMENT HARNESS PASS / ASSISTED HUMAN REVIEW OPEN**

## 1. CI preparation + review-helper gate — PASS

Canonical dedicated run: `34339238995` on head `4c5fd5b9c2617bbbcc11735ac98bb4bd37682832`.

Observed results:

```text
focused evaluator suite = PASS
focused evaluator + assisted-review lint = PASS
assisted-review node --check = PASS
prepare-only harness = PASS
queryCount = 50
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
artifact = 10099024031
artifact digest = sha256:a1774e215ddf77af5d6d7c0858db6a40a0a844b83ee3ea687d993c52deca7245
```

The prepare-only path does not execute Pi/provider inference and requires no provider credential.

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

## 7. Assisted independent human review — OPEN / REQUIRED

Run from the updated support branch:

```bash
node scripts/p2-review-direct-file-pi-baseline.mjs
```

The helper consumes only the already-generated local evidence bundle. It must not invoke Pi/provider inference or remove/rewrite `answers-development.jsonl`, `observations-development.json`, raw Pi event streams, or the deterministic report.

For each query the terminal shows:

- query/categories;
- expected answerable/no-answer state;
- Pi answer;
- expected required Evidence quotes and citation coverage;
- actual model citations with mapped/unmapped state;
- deterministic warning list;
- rule-based starting classification.

Reviewer controls:

```text
Enter = accept rule suggestion
c = correct
p = partially correct
i = incorrect
q = save and quit
```

For non-correct decisions, issue flags cover:

```text
u = unsupported claim
v = version/conflict mistake
o = important Evidence omission
h = no-answer hallucination
x = other
```

The helper saves progress after every reviewed query and rejects resume data belonging to a different dataset/evidence SHA.

The rule suggestion is not a model-based semantic judge. It uses deterministic answerability/Evidence/citation signals only; the final classification remains the human reviewer's decision.

## 8. Human-review completion evidence

After all 50 decisions, require:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-development.json
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-development.md
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-summary.json
```

The terminal final result and `human-review-summary.json` include:

- correct / partially-correct / incorrect counts;
- unsupported-claim count;
- version/conflict mistake count;
- no-answer hallucination count;
- Evidence-omission count;
- accepted vs overridden rule-suggestion counts;
- SHA-256 review digest bound to dataset hash + original evidence repo SHA + per-query human decisions.

The detailed review stays local unless later audit requires it. Aggregate counts + digest are sufficient for repository status bookkeeping; no provider credentials or unrelated user files belong in GitHub.

## 9. Evidence preservation

Preserve the complete local output directory, including raw Pi JSONL streams and completed human-review records, until P2-T10 is accepted.

## 10. Holdout discipline

Do not execute P2-T10 holdout for tuning. Development configuration and review criteria are frozen; any later holdout use must remain one-shot acceptance-only.

## 11. Direct-base scope

Compared with `experiment/p2-direct-file-pi-baseline`, support scope is exactly:

```text
.github/workflows/p2-direct-file-pi-evidence.yml
scripts/p2-run-direct-file-pi-baseline.mjs
scripts/p2-review-direct-file-pi-baseline.mjs
docs/development/reports/P2-T10-direct-file-pi-evidence-harness.md
docs/development/verification/P2-T10-direct-file-pi-evidence-harness.md
```

No production Knowledge retrieval change, provider secret, dataset mutation, product-comparison implementation, ADR decision or P3 code belongs here.

## PASS condition

The **model evidence harness execution and assisted-review implementation/CI gates are PASS**. P2-T10 itself remains **PARTIAL** until the assisted independent human semantic review reaches 50/50 and its aggregate summary/digest are recorded.
