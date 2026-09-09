# ADR-029 — V1 Retrieval Strategy

Status: **BLOCKED ON FINAL PRODUCT EVIDENCE**  
Date opened: **2026-09-09**

## Context

P2 exists to choose the V1 retrieval stack from measured evidence rather than architecture preference.

The intended candidate set was deliberately narrow:

```text
FTS only
```

or, only if real evidence justified the added runtime cost:

```text
FTS + Dense + RRF
```

P3 must not begin until this ADR is Accepted because P3 ScopeManifests and AnswerRuns freeze retrieval configuration/revision into durable answer provenance.

## Current evidence state

The retrieval-quality portion of P2 is now substantially resolved.

### P2-T04 — expanded FTS baseline

Real corrected-ancestry execution over 38 chunks / 35 challenge chunks / Top-K 10:

```text
80 queries
68 answerable
12 no-answer
query errors: 0
Recall@10: 1.0
MRR: 0.928921568627451
all-required Evidence coverage: 1.0
rank aggregate: 59 R1 / 7 R2 / 2 R3 / 0 miss
category failures: none
FTS dbstat allocation: 49152 bytes
```

GitHub-runner latency/RSS evidence is runner-specific and is not treated as Omarchy target-machine performance.

### P2-T05 — lexical normalization

Four fixed development profiles were evaluated. The least-complex materially-improving rule selected **plain baseline**:

| Profile | Recall@10 | MRR | Coverage |
| --- | ---: | ---: | ---: |
| baseline | 1.0 | 0.9365079365079365 | 1.0 |
| code-derived | 1.0 | 0.9365079365079365 | 1.0 |
| code-cjk-bigram | 1.0 | 0.9134920634920635 | 1.0 |
| code-cjk-bigram-trigram | 1.0 | 0.9293650793650793 | 1.0 |

`code-derived` produced no aggregate gain and increased complexity/cost. Both CJK n-gram profiles regressed MRR.

Winner: **`baseline`**.

One-shot post-freeze FTS holdout acceptance remained strong:

```text
30 queries / 26 answerable
Recall@10: 1.0
MRR: 0.9166666666666666
all-required Evidence coverage: 1.0
22 R1 / 3 R2 / 1 R3 / 0 miss
```

No holdout per-query diagnostics were used for tuning.

### P2-T06 — Dense retrieval

Two fixed multilingual profiles were executed before any Dense selection:

| Profile | Recall@10 | MRR | Coverage |
| --- | ---: | ---: | ---: |
| multilingual E5 small | 0.9523809523809523 | 0.8462301587301588 | 0.9523809523809523 |
| multilingual MiniLM | 0.9285714285714286 | 0.7633219954648526 | 0.9285714285714286 |

Frozen FTS development comparator:

```text
Recall@10: 1.0
MRR: 0.9365079365079365
coverage: 1.0
```

Both Dense candidates regress required quality. Predeclared eligibility required no Recall/coverage regression plus material MRR improvement. Neither qualified.

Conclusion:

```text
selectedDenseProfile = null
denseWorthCarryingForward = false
```

### P2-T07 — sqlite-vec

**NOT APPLICABLE for V1 selection.**

sqlite-vec was only a possible Dense deployment mechanism. Because Dense failed the quality gate, target sqlite-vec deployment is not required to decide the V1 retrieval strategy.

### P2-T08 — Hybrid + RRF

**NOT APPLICABLE for V1 selection.**

Hybrid/RRF was conditional on Dense first proving useful. Running Hybrid merely to preserve historical task order would violate the complexity/evidence rule.

### P2-T09 — reproducible benchmark

Generated benchmark PASS on the frozen FTS configuration:

```text
retriever: sqlite-fts5
tokenizer: unicode61
lexical profile: baseline
natural-language compiler: quoted-literal-or
Top-K: 10
38 chunks / 35 challenge chunks
50 development queries / 42 answerable / 8 no-answer
Recall@10: 1.0
MRR: 0.9365079365079365
all-required Evidence coverage: 1.0
category failures: none
FTS dbstat allocation: 49152 bytes
```

No Dense/Hybrid row was fabricated after Dense was rejected.

### P2-T10 — direct-file Pi product baseline

Real Omarchy/Pi development execution completed all 50 fixed queries without Knowledge retrieval.

Frozen runtime:

```text
Pi: 0.85.1
provider: openai-codex
model: gpt-6-astra
API: openai-codex-responses
```

Deterministic result:

```text
50 queries
42 answerable
8 no-answer
any-required Evidence coverage: 1.0
all-required Evidence coverage: 1.0
citation precision: 0.7758620689655172  (45/58)
no-answer correct abstention: 0.625  (5/8)
median latency: 10165.077273999981 ms
p95 latency: 14855.569325999997 ms
max latency: 18050.93610000005 ms
```

This proves direct-file Pi can cover all required Evidence on the answerable development set, but citation discipline and no-answer abstention are materially imperfect.

**Independent human semantic review remains OPEN**, so P2-T10 is still PARTIAL.

### P2-T11 — mature local-product comparison

AnythingLLM and Open WebUI Knowledge public documentation has been reviewed. Both are credible local document-chat/RAG product substitutes, but public material does not prove this repository's immutable historical Evidence invariant.

Still OPEN:

- fixed-version hands-on quality on the same corpus/development queries;
- source version A → citation → update to B → restart → reopen old citation;
- Chinese/code/version/conflict/no-answer behavior;
- target operational cost and workflow fit.

## Candidate decision set after measured retrieval evidence

The quality experiments reduce the practical V1 retrieval candidate set to:

```text
FTS only
```

with the exact frozen lexical configuration:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

`FTS + Dense + RRF` is no longer an evidence-backed V1 candidate because Dense failed the prerequisite quality gate.

This is **not yet the final Accepted architecture decision**. The remaining product-value evidence can still determine whether the Knowledge retrieval product itself is sufficiently justified versus direct-file Pi / mature local alternatives.

## Decision criteria

Evaluate the remaining decision in this order:

1. **Evidence correctness and coverage**;
2. **Chinese/code/version/conflict behavior**;
3. **immutable historical Evidence integrity**;
4. **product value vs direct-file Pi and mature local substitutes**;
5. **simplicity and maintainability**;
6. **latency/resource cost**;
7. **deployment/restart/backup reliability**.

## Evidence table

| Evidence | FTS baseline | Dense | Hybrid RRF | Direct-file Pi | External products |
| --- | --- | --- | --- | --- | --- |
| development quality | **PASS** — R@10 1.0, MRR 0.9365079365, coverage 1.0 | **REJECTED** — quality regression | **N/A** — Dense prerequisite failed | deterministic run complete; semantic review OPEN | hands-on OPEN |
| holdout quality | **PASS aggregate** — R@10 1.0, MRR 0.9166666667, coverage 1.0 | not run after rejection | N/A | not run; no tuning use | optional / unrun |
| Chinese/code/version | no category misses in frozen FTS benchmark | regressed overall | N/A | deterministic citation coverage complete; human correctness OPEN | hands-on OPEN |
| multi-source/conflict | all-required coverage 1.0 in frozen FTS benchmark | regressed overall | N/A | coverage 1.0; human semantic correctness OPEN | hands-on OPEN |
| citation discipline | Stable Evidence locators are retrieval-native | locator-compatible eval only | N/A | precision 0.7758620689655172 | hands-on OPEN |
| no-answer behavior | lexical hits are not answerability; answer layer not measured here | N/A | N/A | correct abstention 0.625 | hands-on OPEN |
| resource/deployment complexity | SQLite FTS5 only; 49152-byte FTS dbstat in benchmark | model runtime adds substantial memory/complexity | N/A | existing Pi model runtime; ~10.2 s median full-answer latency | hands-on OPEN |
| historical Evidence semantics | repository contract is designed around immutable SourceVersion/ParsedArtifact | same locator contract possible | N/A | post-run quote mapping only | **NOT PROVEN publicly / hands-on OPEN** |

## Provisional architecture direction

Measured retrieval evidence strongly favors **FTS only** and provides no justification for Dense, sqlite-vec, or Hybrid/RRF in V1.

However, ADR-029 remains blocked because P2 is not only a retrieval leaderboard. Before final acceptance we still need to establish whether the overall Knowledge product has enough differentiated value and correctness versus:

1. direct-file Pi, using the completed deterministic run plus independent human answer review;
2. AnythingLLM and Open WebUI Knowledge, using fixed-version hands-on historical-citation/quality/operational observations.

## Final Decision

**BLOCKED — no final V1 architecture acceptance yet.**

The retrieval candidate is now evidence-narrowed to FTS only, but the product-value gate is incomplete.

## Remaining blockers

Only these decision-critical blockers remain:

1. **P2-T10 human semantic review** of all 50 direct-file development answers;
2. **P2-T11 fixed-version hands-on comparison** for AnythingLLM and Open WebUI Knowledge.

P2-T07 sqlite-vec and P2-T08 Hybrid/RRF are explicitly not blockers unless Dense is intentionally reopened with new evidence.

## Consequence while blocked

- ADR-029 stays `BLOCKED ON FINAL PRODUCT EVIDENCE`.
- P3-T01 and later P3 implementation must **not** proceed.
- No placeholder retrieval revision may be frozen into durable Answer/ScopeManifest schemas.
- Existing P0/P1 verification debt remains independently tracked and is not waived by this ADR.

## Unblocking procedure

1. complete and record the P2-T10 independent human semantic review;
2. complete the P2-T11 fixed-version hands-on comparison or record an evidence-backed reason a comparison row is not applicable;
3. update this table with the final product-value observations;
4. confirm the frozen FTS retrieval configuration remains the least-complex acceptable strategy;
5. change this ADR to `Accepted` only if the full P2 gate is satisfied;
6. define the exact retrieval-config revision consumed by P3 durable provenance;
7. stop after ADR acceptance unless explicitly authorized to begin P3.
