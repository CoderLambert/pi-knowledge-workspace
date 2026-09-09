# P2-T10 support — Direct-file Pi evidence harness

Status: **IMPLEMENTED / CI PREPARATION PENDING / REAL LOCAL RUN REQUIRED**

## Purpose

Make the P2-T10 product-value baseline executable as one local command while preserving the experiment boundary: Pi receives the same six frozen corpus files for every development query, no Knowledge retrieval ranks, and no Golden Evidence labels.

## Local acceptance command

From the P2-T10 support branch on the user's authenticated Omarchy checkout:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

The command uses the existing `pi` login/configuration. It does not read, print or persist provider credentials.

Optional explicit runtime freeze:

```bash
P2_T10_PROVIDER=<provider> \
P2_T10_MODEL=<model> \
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

If provider/model are not explicitly supplied, the harness records the provider/model identity exposed by Pi's authoritative final `message_end` and requires that identity to remain identical for all 50 queries.

## Frozen input

Exactly six corpus records are used:

```text
vue-reactivity-core-zh
node-fspromises-cp-v16.7.0
node-fspromises-cp-v22.3.0
challenge-vue-reactivity-neighbors
challenge-node-fspromises-neighbors-a
challenge-node-fspromises-neighbors-b
```

The harness requires:

```text
development queries = 50
dataset hash = 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
```

This is the same frozen development dataset identity used by P2-T09. Holdout files are not loaded.

## Pi isolation

Each query runs in a fresh ephemeral Pi process with:

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

The model must return a strict JSON answer containing an `insufficientEvidence` flag and zero or more `{path, exactQuote}` citations.

## Citation accounting

Citation mapping happens only after model inference.

A citation maps to Stable Evidence only when:

1. its path is one of the frozen task files;
2. `exactQuote` is non-empty;
3. the quote occurs verbatim in that file;
4. it occurs exactly once.

The mapped citation records immutable `sourceVersionId`, `parsedArtifactId`, `startByte`, and `endByte`.

Wrong paths, missing quotes, and ambiguous quotes are preserved as unmapped citations. They are not silently discarded: P2-T10's evaluator includes `unmappedCitationCount` in citation-precision denominator, and a no-answer response with an unmapped citation does not count as a correct abstention.

## Output bundle

Default output directory:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10
```

The real run writes:

- `direct-file-pi-development.json` — deterministic report plus runtime provenance;
- `observations-development.json` — evaluator observations;
- `answers-development.jsonl` — parsed answers, requested citations, mapped/unmapped citations and runtime identity;
- `raw/<query>.jsonl` — raw Pi JSON event stream for every query;
- optional `raw/<query>.stderr.txt` when Pi emits stderr;
- `task-manifest-development.json` — frozen model-facing task manifest;
- `human-review-development.md` — independent semantic-review worksheet.

## Human review boundary

Machine scoring does not establish semantic answer correctness. The model under test cannot be its own judge.

A human reviewer must classify every development answer as `correct`, `partially correct`, or `incorrect` and separately record unsupported claims, version/conflict mistakes, no-answer hallucinations and important omitted evidence.

P2-T10 remains PARTIAL until both the real model run and this human review are complete.

## CI boundary

GitHub Actions runs only:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs --prepare-only
```

That path validates the frozen corpus/query count, dataset hash, task construction, focused evaluator tests and focused lint without invoking Pi or any provider. CI must never fabricate provider/model observations.

## Scope

Support-only. No Knowledge retrieval behavior, provider credential material, holdout execution, existing-product comparison, ADR selection or P3 implementation is included.
