# ADR-029 — V1 Retrieval Strategy

Status: **BLOCKED ON EVIDENCE**  
Date opened: **2026-09-09**

## Context

P2 exists to choose the V1 retrieval stack from measured evidence rather than architecture preference.

The valid final outcome may remain deliberately simple:

```text
FTS only
```

or, if real evidence justifies the added runtime cost:

```text
FTS + Dense + RRF
```

P3 must not begin until this ADR contains an accepted retrieval decision because P3 ScopeManifests and AnswerRuns freeze retrieval configuration/revision into durable answer provenance.

## Decision status

**No retrieval strategy is selected yet.**

The current automation environment has implemented the evaluation contracts but cannot produce the missing real retrieval/model/product measurements. Selecting FTS, Dense, sqlite-vec or Hybrid now would be fabricated evidence and would violate the P2 plan.

## Candidate decision set

The V1 decision is intentionally restricted to the smallest evidence-backed choices:

1. `FTS only` — current P1 FTS5 baseline, optionally with the least-complex P2-T05 lexical normalization that proves useful;
2. `FTS + Dense + RRF` — only if one fixed Dense profile proves materially useful and Hybrid produces enough incremental benefit to justify its operational cost.

`Dense only` is not the target default because the lexical baseline remains necessary for exact code/version/error behavior unless benchmark evidence explicitly forces reconsideration in a future ADR.

A reranker is **not** a P2 candidate. sqlite-vec is a deployment option for Dense storage, not a retrieval-quality strategy by itself.

## Mandatory evidence before decision

### P2-T04 — FTS baseline

Required:

- real fixed-development Recall@10;
- MRR;
- all-required-Evidence coverage;
- failures by category;
- latency;
- memory/index size;
- representative missed queries.

### P2-T05 — lexical normalization

Required:

- all four fixed profiles run on development data;
- least-complex winner or explicit `baseline/no material improvement` conclusion;
- one-shot holdout only after profile freeze.

### P2-T06 — Dense profile, only if Dense remains a candidate

Required:

- one or at most two fixed multilingual profiles with exact model/revision/dimensions/preprocessing;
- real development retrieval metrics and resource cost;
- one frozen profile or explicit `Dense not proven useful` conclusion.

If Dense is not proven useful, P2-T08 becomes unnecessary for the final V1 choice and this ADR should prefer the selected lexical/FTS path unless another mandatory baseline contradicts it.

### P2-T07 — sqlite-vec deployment, only if needed for the chosen Dense path

Required before adopting sqlite-vec:

- target extension load/reload after restart;
- runtime `vec_version()`;
- scoped filtering inside KNN before Top-K;
- concurrency smoke;
- p95/RSS/DB/vector-size measurements;
- explicit adopt/do-not-adopt conclusion.

Dense-quality evidence does not require sqlite-vec; the P2-T06 in-memory evaluation index is sufficient for quality comparison.

### P2-T08 — Hybrid + RRF, only after Dense is proven useful

Required:

- FTS vs Dense vs Hybrid on the same development labels;
- Recall@10/MRR/all-required coverage/category failures;
- end-to-end latency/resource overhead;
- frozen `rrfK` and retrieval configurations;
- explicit proof that Hybrid materially beats the simpler candidate.

### P2-T09 — reproducible benchmark report

Required:

- generated development report from complete observations;
- repository/dataset/config/model revisions recorded;
- no development/holdout mixing.

### P2-T10 — direct-file Pi product baseline

Required:

- same development user tasks with fixed files directly supplied to Pi;
- no Golden-label leakage;
- citation mapping and deterministic Evidence coverage/abstention metrics;
- independent human answer correctness/unsupported-claim review;
- runtime/latency/operational observations.

Retrieval complexity must demonstrate product value over this simpler path.

### P2-T11 — mature local-product comparison

Required:

- fixed-version AnythingLLM and Open WebUI hands-on runs;
- same fixed corpus/development queries;
- historical citation durability after source update/restart;
- Chinese/code/conflict quality;
- operational cost.

Public documentation research is useful context but is not sufficient acceptance evidence.

## Decision criteria

Evaluate candidates in this order:

1. **Evidence correctness and recall** — especially all-required-Evidence coverage and conflict/multi-source cases;
2. **exact lexical behavior** — code symbols, versions/error codes, Chinese/mixed queries;
3. **historical Evidence integrity** — retrieval must return locators that resolve against immutable SourceVersion/ParsedArtifact history;
4. **product value vs direct files** — retrieval must solve a real scale/scope/reuse problem rather than add infrastructure with no measured gain;
5. **simplicity and maintainability** — prefer fewer models/native extensions/indexes when quality is materially equivalent;
6. **latency/resource cost** — local p95/RSS/index growth must remain appropriate for a single-user desktop product;
7. **deployment reliability** — native-extension or model dependencies must install/restart/backup predictably.

## Default decision bias

When quality is materially equivalent:

```text
FTS only > FTS + Dense + RRF
```

This is a complexity preference, **not** a preselected outcome.

Dense/Hybrid must earn adoption with measured benefit. Conversely, FTS must not be retained merely because it is simpler if it materially fails required Evidence coverage on the fixed dataset.

## Decision table

| Evidence | FTS / selected lexical | Dense | Hybrid RRF | Direct-file Pi | External products |
| --- | --- | --- | --- | --- | --- |
| development quality | UNRUN | UNRUN | UNRUN | UNRUN | HANDS-ON UNRUN |
| holdout quality | UNRUN | UNRUN | UNRUN | UNRUN | optional / UNRUN |
| Chinese/code/version | UNRUN | UNRUN | UNRUN | UNRUN | HANDS-ON UNRUN |
| multi-source/conflict | UNRUN | UNRUN | UNRUN | UNRUN | HANDS-ON UNRUN |
| p95 / resource cost | UNRUN | UNRUN | UNRUN | UNRUN | HANDS-ON UNRUN |
| deployment/restart | FTS native SQLite partly proven; final package gates OPEN | model runtime UNRUN | depends on components | Pi runtime UNRUN | HANDS-ON UNRUN |
| historical Evidence semantics | repository contract implemented; P1 acceptance debt remains | locator contract only | locator contract only | post-run citation mapping only | NOT PROVEN publicly |

## Decision

**BLOCKED — no V1 retrieval choice is made in this ADR yet.**

Do not replace this section with a preference until the mandatory rows above contain real, reproducible evidence.

## Consequence while blocked

- P2 implementation contracts may exist as PARTIAL stacked PRs.
- No P2 benchmark result is represented as PASS without execution.
- P3-T01 and later P3 implementation must **not** proceed because P3 durable Answer/ScopeManifest schemas require a retrieval configuration/revision that this ADR has not selected.
- Existing P0/P1 verification debt remains independently tracked and is not waived by this ADR.

## Unblocking procedure

1. close or intentionally fail/not-applicable each applicable P2-T04..T11 verification row;
2. generate the P2-T09 development comparison from real observations;
3. freeze the chosen retrieval configuration;
4. run holdout according to the established no-retuning discipline;
5. fill this ADR's decision table with dated evidence references;
6. select the least-complex candidate that satisfies required quality/product-value constraints;
7. update the architecture baseline and P2 task status;
8. only then branch P3-T01.
