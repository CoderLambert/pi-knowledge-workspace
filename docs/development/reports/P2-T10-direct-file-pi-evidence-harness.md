# P2-T10 support — Direct-file Pi evidence harness

Status: **REAL DEVELOPMENT RUN PASS / ASSISTED HUMAN SEMANTIC REVIEW REQUIRED**

## Purpose

Make the P2-T10 product-value baseline executable as one local command while preserving the experiment boundary: Pi receives the same six frozen corpus files for every development query, no Knowledge retrieval ranks, and no Golden Evidence labels.

## Canonical CI preparation + review-helper evidence

Latest dedicated support run:

```text
GitHub Actions run = 34339238995
head SHA = 4c5fd5b9c2617bbbcc11735ac98bb4bd37682832
focused evaluator suite = PASS
focused evaluator + assisted-review lint = PASS
assisted-review node --check = PASS
direct-file prepare-only = PASS
queryCount = 50
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
artifact = 10099024031
artifact digest = sha256:a1774e215ddf77af5d6d7c0858db6a40a0a844b83ee3ea687d993c52deca7245
```

The CI path did not execute `pi`, contact a model provider, or consume provider credentials.

## Real local development execution — PASS

The user ran from the support branch on Omarchy/Linux:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

All 50 development queries completed successfully.

Frozen runtime identity:

```text
repoSha = db71e7c6d746709ce152269b68b020bd05bdb0dd
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
Pi = 0.85.1
provider = openai-codex
model = gpt-6-astra
API = openai-codex-responses
responseModel = null
thinkingLevel = null
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

Equivalent counts:

```text
valid mapped citations = 45 / 58 total mapped+unmapped citations
correct no-answer abstentions = 5 / 8
```

Default evidence directory:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10
```

## Frozen input

Exactly six corpus records were used:

```text
vue-reactivity-core-zh
node-fspromises-cp-v16.7.0
node-fspromises-cp-v22.3.0
challenge-vue-reactivity-neighbors
challenge-node-fspromises-neighbors-a
challenge-node-fspromises-neighbors-b
```

The same frozen development dataset identity used by P2-T09 was preserved. Holdout files were not loaded.

## Pi isolation

Each query ran in a fresh ephemeral Pi process with:

- JSON event mode;
- no saved session;
- no tools;
- no extensions;
- no skills;
- no prompt templates;
- no themes;
- no context files;
- project-local trust disabled for the run;
- the same fixed system prompt;
- the same six `@eval/corpus/...` files.

The first actual response froze provider/model identity and all remaining responses matched it.

## Citation accounting

Citation mapping happened only after model inference.

A citation mapped to Stable Evidence only when:

1. its path was one of the frozen task files;
2. `exactQuote` was non-empty;
3. the quote occurred verbatim in that file;
4. it occurred exactly once.

The mapped citation records immutable `sourceVersionId`, `parsedArtifactId`, `startByte`, and `endByte`.

Wrong paths, missing quotes, and ambiguous quotes were preserved as unmapped citations. They were not silently discarded: P2-T10's evaluator includes `unmappedCitationCount` in the citation-precision denominator, and a no-answer response with an unmapped citation does not count as a correct abstention.

## Output bundle

The real run wrote:

- `direct-file-pi-development.json` — deterministic report plus runtime provenance;
- `observations-development.json` — evaluator observations;
- `answers-development.jsonl` — parsed answers, requested citations, mapped/unmapped citations and runtime identity;
- `raw/<query>.jsonl` — raw Pi JSON event stream for every query;
- optional `raw/<query>.stderr.txt` when Pi emits stderr;
- `task-manifest-development.json` — frozen model-facing task manifest;
- `human-review-development.md` — original independent semantic-review worksheet.

## Assisted human review

To avoid making the reviewer manually reconstruct all 50 rows, support includes:

```bash
node scripts/p2-review-direct-file-pi-baseline.mjs
```

This helper **does not invoke Pi, does not contact a provider, and does not delete or regenerate the model evidence bundle**. It reads the existing local `answers-development.jsonl`, frozen development labels and corpus metadata, then presents one query at a time with:

- original query/categories;
- full Pi answer;
- expected required Evidence quotes;
- actual requested citations and mapped/unmapped state;
- deterministic warnings;
- a rule-based starting classification.

Reviewer controls are intentionally minimal:

```text
Enter = accept suggestion
c = correct
p = partially correct
i = incorrect
q = save and quit
```

For non-correct answers, issue flags are prefilled from deterministic signals where possible and can be accepted or overridden. Progress is saved after every answer and resumes safely against the same dataset/evidence SHA.

When complete, the helper writes:

- `human-review-development.json` — per-query human decisions;
- `human-review-development.md` — completed aggregate/per-query record;
- `human-review-summary.json` — compact counts plus SHA-256 review digest.

The deterministic suggestion is only triage. The human remains the final semantic reviewer; the model under test is not used as its own judge.

## Remaining boundary

The 50-query model harness execution and assisted-review implementation/CI gates are **PASS**. P2-T10 remains PARTIAL until the independent reviewer completes the assisted review and its summary/digest are recorded.

## Scope

Support-only. Current direct-base scope is five files:

```text
.github/workflows/p2-direct-file-pi-evidence.yml
scripts/p2-run-direct-file-pi-baseline.mjs
scripts/p2-review-direct-file-pi-baseline.mjs
docs/development/reports/P2-T10-direct-file-pi-evidence-harness.md
docs/development/verification/P2-T10-direct-file-pi-evidence-harness.md
```

No Knowledge retrieval behavior, provider credential material, holdout execution, existing-product comparison, ADR selection or P3 implementation is included.
