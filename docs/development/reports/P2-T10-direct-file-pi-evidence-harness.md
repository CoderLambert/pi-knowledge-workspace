# P2-T10 support — Direct-file Pi evidence harness

Status: **REAL DEVELOPMENT RUN PASS / HUMAN SEMANTIC REVIEW REQUIRED**

## Purpose

Make the P2-T10 product-value baseline executable as one local command while preserving the experiment boundary: Pi receives the same six frozen corpus files for every development query, no Knowledge retrieval ranks, and no Golden Evidence labels.

## CI preparation evidence

Canonical preparation run on the frozen P2-T10 base:

```text
GitHub Actions run = 34332760481
focused evaluator suite = 1 file / 5 tests PASS
focused P2-T10 lint = PASS
direct-file prepare-only = PASS
queryCount = 50
datasetHash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
systemPromptSha256 = 8db92ab71e29b1f7228a5176e5f3de46f8eab02ad493896bc5a85e5463eddc16
Node = v24.20.0
platform = linux/x64
artifact = 10096440773
artifact digest = sha256:e65d56a823499760e80cbc832d06a1d6b3f789a8228aaaec17771174866dc88f
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
- `human-review-development.md` — independent semantic-review worksheet.

## Remaining boundary

The harness execution itself is now **PASS**. Machine scoring does not establish semantic answer correctness, so P2-T10 still requires a human reviewer to complete `human-review-development.md`.

The reviewer must classify every answer as `correct`, `partially correct`, or `incorrect` and record unsupported claims, version/conflict mistakes, no-answer hallucinations and important omitted evidence.

The model under test cannot be its own sole judge.

## Scope

Support-only. No Knowledge retrieval behavior, provider credential material, holdout execution, existing-product comparison, ADR selection or P3 implementation is included.
