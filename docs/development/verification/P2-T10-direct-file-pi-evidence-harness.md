# P2-T10 support verification — Direct-file Pi evidence harness

Status: **CI PREPARATION PASS / LOCAL REAL RUN + HUMAN REVIEW OPEN**

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

All preparation steps passed on the final P2-T10 base. The prepare-only path does not execute Pi/provider inference and requires no provider credential.

## 2. Local runtime precondition

On the user's Omarchy checkout, normal Pi authentication must already work. Do not copy provider credentials into repository files, GitHub Actions secrets, evidence JSON, chat messages or command-line arguments.

The harness consumes the existing local Pi authentication/configuration only.

## 3. Execute the frozen development baseline

Run from the support branch:

```bash
npx tsx scripts/p2-run-direct-file-pi-baseline.mjs
```

Optional explicit provider/model selection may be supplied through `P2_T10_PROVIDER` and `P2_T10_MODEL`. If omitted, the first actual Pi response freezes the runtime identity and every subsequent query must match it.

The harness fails closed on provider/model drift.

## 4. Model-input audit

For every query verify the raw Pi invocation is constrained to:

- original development query;
- exactly the six frozen corpus file references;
- fixed system instructions;
- no Golden Evidence labels;
- no retrieval ranks/results;
- no tools/extensions/skills/prompts/themes/context files;
- no persistent Pi session.

`task-manifest-development.json` must record `goldenLabelsModelFacing: false`.

## 5. Citation mapping audit

For every requested citation, verify post-inference mapping rules:

```text
path must belong to frozen task
exactQuote must be non-empty
exactQuote must occur verbatim exactly once
```

Mapped citations must resolve to immutable:

```text
sourceVersionId
parsedArtifactId
startByte
endByte
```

Wrong, missing or ambiguous citations must remain in `unmappedCitations` and increment `unmappedCitationCount`; never drop them before scoring.

## 6. Deterministic report

`direct-file-pi-development.json` must contain a complete 50-query report with:

- any-required Evidence coverage;
- all-required Evidence coverage;
- citation precision including unmapped citations in the denominator;
- no-answer correct abstention rate;
- median/p95/max end-to-end Pi latency;
- exact Pi version;
- actual stable provider/model identity;
- repository SHA;
- development dataset hash;
- system-prompt hash;
- runtime/platform provenance.

No holdout data may be loaded or executed.

## 7. Independent human review

Complete `human-review-development.md` by reading `answers-development.jsonl` and the fixed source files.

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

## 8. Evidence return

Preserve the complete output directory, including raw Pi JSONL streams. Return the bundle to repository/evidence review without credentials or unrelated user files.

The machine report and completed human worksheet are both required to close P2-T10.

## 9. Holdout discipline

Do not execute P2-T10 holdout in this support harness. Development configuration and review criteria must first be frozen and P2-T10 development evidence accepted.

## 10. Direct-base scope

Compared with `experiment/p2-direct-file-pi-baseline`, support scope is exactly:

```text
.github/workflows/p2-direct-file-pi-evidence.yml
scripts/p2-run-direct-file-pi-baseline.mjs
docs/development/reports/P2-T10-direct-file-pi-evidence-harness.md
docs/development/verification/P2-T10-direct-file-pi-evidence-harness.md
```

No production Knowledge retrieval change, provider secret, dataset mutation, product-comparison implementation, ADR decision or P3 code belongs here.

## PASS condition

The **CI preparation portion is PASS**. The support harness as a complete real-evidence procedure remains open until the local one-shot command produces a complete, internally consistent 50-query bundle. P2-T10 itself remains PARTIAL until independent human semantic review is also completed and recorded.
