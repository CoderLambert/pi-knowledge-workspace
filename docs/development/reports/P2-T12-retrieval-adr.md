# P2-T12 — Retrieval ADR

Status: **BLOCKED ON FINAL PRODUCT EVIDENCE**

## Objective

Publish the final V1 retrieval choice from real P2 benchmark/product evidence and prevent P3 from freezing an unevaluated retrieval stack into durable Answer provenance.

## Direct base

P2-T11 / `research/p2-existing-product-comparison` / PR #43.

This task is stacked and is not independently merge-safe before its base.

## Evidence now closed

The retrieval-strategy experiments are no longer broadly unrun:

- **P2-T04 FTS baseline:** real expanded-corpus evidence complete; Recall@10 `1.0`, MRR `0.928921568627451`, all-required Evidence coverage `1.0`, no category misses.
- **P2-T05 lexical normalization:** four fixed profiles complete; plain `baseline` selected because no more complex profile materially improved quality.
- **P2-T06 Dense:** two fixed multilingual profiles complete; both regressed FTS Recall/MRR/coverage; Dense rejected.
- **P2-T07 sqlite-vec:** not applicable after Dense rejection; it is a deployment mechanism, not an independent quality strategy.
- **P2-T08 Hybrid/RRF:** not applicable because Dense failed its prerequisite quality gate.
- **P2-T09 benchmark runner:** PASS with real generated frozen FTS development report.
- **P2-T10 automated direct-file Pi development run:** complete on 50 queries with frozen Pi/provider/model identity and deterministic metrics.

P2-T10 real deterministic result:

```text
any-required Evidence coverage: 1.0
all-required Evidence coverage: 1.0
citation precision: 0.7758620689655172 (45/58)
no-answer correct abstention: 0.625 (5/8)
median / p95 / max latency:
10165.077273999981 / 14855.569325999997 / 18050.93610000005 ms
```

## Retrieval candidate after evidence

The measured retrieval candidate set has effectively narrowed to:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

Dense, sqlite-vec and Hybrid/RRF are not evidence-backed V1 additions.

This is a **provisional retrieval direction**, not yet an Accepted ADR, because P2 also contains a product-value gate.

## Remaining blockers

Only two decision-critical evidence classes remain:

1. **P2-T10 independent human semantic review** of all 50 direct-file Pi development answers, including correctness, unsupported claims, version/conflict handling, omitted evidence and no-answer hallucination;
2. **P2-T11 fixed-version hands-on comparison** of AnythingLLM and Open WebUI Knowledge, especially historical citation durability after source update/restart plus same-corpus quality and target operational observations.

Public documentation research alone is not sufficient for P2-T11 PASS.

## Why status remains BLOCKED

The task's deliverable is the empirical architecture/product decision itself. The remaining product evidence can still determine whether building and carrying the Knowledge retrieval product is justified versus simpler direct-file Pi or mature local substitutes.

Therefore it would still be premature to mark ADR-029 Accepted even though the retrieval-quality experiments strongly favor FTS only.

## P3 stop condition

P3 must not proceed until ADR-029 is Accepted and an exact retrieval configuration/revision is frozen for durable ScopeManifest/AnswerRun provenance.

No placeholder retrieval revision is allowed.

## Out of scope while blocked

- reopening Dense/Hybrid merely to preserve task numbering;
- implementing sqlite-vec without an adopted Dense path;
- adding a reranker;
- starting P3 schemas/runtime;
- treating same-model or documentation-only review as final product evidence.

## Next closure sequence

1. complete P2-T10 human semantic review;
2. complete P2-T11 fixed-version hands-on comparison;
3. update ADR-029's evidence table with those observations;
4. decide whether FTS-only Knowledge is justified as the V1 product retrieval architecture;
5. only then set ADR-029 to `Accepted` and close P2;
6. stop before P3 unless explicitly authorized.
