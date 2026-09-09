# ADR-029 — V1 Retrieval Strategy

Status: **BLOCKED ON P2-T11 FINAL PRODUCT EVIDENCE**  
Date opened: **2026-09-09**

## Context

P2 exists to choose the V1 retrieval stack from measured evidence rather than architecture preference. P3 must not begin until this ADR is Accepted because P3 durable provenance freezes an exact retrieval configuration/revision.

The candidate set was deliberately narrow:

```text
FTS only
```

or, only if real evidence justified the added cost:

```text
FTS + Dense + RRF
```

## Retrieval evidence

### P2-T04 — expanded FTS baseline

```text
38 chunks / 35 challenge chunks / Top-K 10
80 queries / 68 answerable / 12 no-answer
Recall@10 = 1.0
MRR = 0.928921568627451
all-required Evidence coverage = 1.0
59 R1 / 7 R2 / 2 R3 / 0 miss
```

### P2-T05 — lexical normalization

Four fixed development profiles were evaluated. Plain `baseline` won by the least-complex/material-improvement rule.

```text
baseline: Recall@10 1.0 / MRR 0.9365079365079365 / coverage 1.0
code-derived: same quality, no material gain
code-cjk-bigram: MRR 0.9134920634920635
code-cjk-bigram-trigram: MRR 0.9293650793650793
```

One-shot post-freeze FTS holdout:

```text
30 queries / 26 answerable
Recall@10 = 1.0
MRR = 0.9166666666666666
coverage = 1.0
22 R1 / 3 R2 / 1 R3 / 0 miss
```

No holdout per-query diagnostics were used for tuning.

### P2-T06 — Dense

Both fixed multilingual Dense candidates regressed the frozen FTS comparator.

```text
multilingual E5 small:
Recall@10 0.9523809523809523 / MRR 0.8462301587301588 / coverage 0.9523809523809523

multilingual MiniLM:
Recall@10 0.9285714285714286 / MRR 0.7633219954648526 / coverage 0.9285714285714286
```

Conclusion:

```text
selectedDenseProfile = null
denseWorthCarryingForward = false
```

### P2-T07 — sqlite-vec

**N/A for V1 selection.** Dense failed the prerequisite quality gate.

### P2-T08 — Hybrid + RRF

**N/A for V1 selection.** Hybrid was conditional on Dense first proving useful.

### P2-T09 — reproducible FTS benchmark

Frozen FTS configuration:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

Development result:

```text
50 queries / 42 answerable / 8 no-answer
Recall@10 = 1.0
MRR = 0.9365079365079365
all-required Evidence coverage = 1.0
category failures = none
FTS dbstat allocation = 49152 bytes
```

## P2-T10 — direct-file Pi product baseline — PASS

Real Omarchy/Pi execution completed all 50 fixed development queries without Knowledge retrieval.

Frozen runtime:

```text
Pi = 0.85.1
provider/model = openai-codex / gpt-6-astra
```

Deterministic result:

```text
50 queries
42 answerable
8 no-answer
any-required Evidence coverage = 1.0
all-required Evidence coverage = 1.0
citation precision = 0.7758620689655172
no-answer correct abstention = 0.625
median latency = 10165.077273999981 ms
p95 latency = 14855.569325999997 ms
max latency = 18050.93610000005 ms
```

Citation metric clarification: the preserved answer bundle contains 58 requested citations, all 58 mapped and zero unmapped. `45/58` is Golden-label relevance, not citation-mapping success.

### Owner-delegated independent semantic adjudication

The repository owner explicitly delegated final 50-answer adjudication to GPT-5.6 Sol, independent of tested `gpt-6-astra`. This is an owner-authorized independent model review, not a human review.

```text
answers file SHA-256 = eed0f944d546220d96c82431e3dfd0037efb574d72e541ae1db09b9fa158ba2b
review digest = 0e450d064781a0390e192e4338e0b1cb45a43297ee2a5629428b3351f1dd9e84
correct = 48
partially correct = 0
incorrect = 2
no-answer hallucinations = 2
version/conflict mistakes = 0
material Evidence omissions = 0
```

Incorrect cases:

- `dev-015`: evidence establishes `.value` but not a definitive negative claim about `.current`;
- `dev-032`: the v16.7.0 file lists **Selected options**, so omission does not justify a definitive negative claim about `verbatimSymlinks`.

### Golden answerability defect

`dev-035` remains categorized as `no-answer`, but the current challenge-expanded corpus directly contains enough evidence to compare `fsPromises.cp` and `fsPromises.copyFile`. The model answer is semantically correct. Historical deterministic metrics remain frozen for reproducibility; the inconsistency is recorded as dataset debt rather than silently repaired inside P2-T10.

P2-T10 is therefore **PASS** and is no longer an ADR blocker.

## P2-T11 — mature local-product comparison — PARTIAL

AnythingLLM and Open WebUI Knowledge public documentation has been reviewed. Public material does not prove this repository's immutable historical Evidence invariant.

Still required:

- fixed-version hands-on quality on the same corpus/development queries;
- source version A → citation → update to B → restart → reopen the original citation;
- Chinese/code/version/conflict/no-answer behavior;
- target operational observations and workflow fit;
- install/update/backup behavior;
- target RSS/query latency/persistent bytes/reindex observations where practical.

This is now the **only remaining decision-critical P2 blocker**.

## Evidence-backed V1 retrieval candidate

Measured retrieval evidence narrows the practical V1 retrieval strategy to:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

Dense, sqlite-vec and Hybrid/RRF are not evidence-backed V1 additions.

## Decision criteria

Final product-value acceptance must consider, in order:

1. Evidence correctness and coverage;
2. Chinese/code/version/conflict behavior;
3. immutable historical Evidence integrity;
4. product value versus direct-file Pi and mature local substitutes;
5. simplicity and maintainability;
6. latency/resource cost;
7. deployment/restart/backup reliability.

## Evidence table

| Evidence | FTS baseline | Dense | Hybrid RRF | Direct-file Pi | External products |
| --- | --- | --- | --- | --- | --- |
| development quality | **PASS** — R@10 1.0, MRR 0.9365079365, coverage 1.0 | **REJECTED** | **N/A** | **PASS evidence complete** — 48/50 semantic correct | hands-on OPEN |
| holdout quality | **PASS aggregate** — R@10 1.0, MRR 0.9166666667, coverage 1.0 | not run after rejection | N/A | no holdout tuning | optional/unrun |
| Chinese/code/version | no category misses | regressed overall | N/A | no material version/conflict mistakes in independent review | hands-on OPEN |
| multi-source/conflict | coverage 1.0 | regressed overall | N/A | semantic review found no material conflict mistakes | hands-on OPEN |
| citation discipline | Stable Evidence locators are retrieval-native | locator-compatible eval only | N/A | 58/58 citations mapped; Golden relevance 45/58 | hands-on OPEN |
| no-answer behavior | retrieval hits are not answerability | N/A | N/A | frozen abstention 5/8; two semantic boundary failures + one Golden answerability defect | hands-on OPEN |
| resource/deployment complexity | SQLite FTS5 only; 49152-byte benchmark dbstat | model runtime adds complexity | N/A | existing Pi model runtime; ~10.2 s median full-answer latency | hands-on OPEN |
| historical Evidence semantics | repository contract designed around immutable SourceVersion/ParsedArtifact | same locator contract possible | N/A | post-run quote mapping only | **NOT PROVEN publicly / hands-on OPEN** |

## Provisional architecture direction

Measured evidence strongly favors **FTS only** and provides no justification for Dense/sqlite-vec/Hybrid in V1.

However, ADR-029 is still **not Accepted**. P2 includes a product-value gate, and P2-T11 fixed-version hands-on evidence is still required before deciding whether this Knowledge product has sufficient differentiated value versus mature local alternatives.

## Final Decision

**BLOCKED — P2-T11 HANDS-ON PRODUCT EVIDENCE ONLY.**

No P3 work is authorized.

## Unblocking procedure

1. complete P2-T11 fixed-version hands-on comparison for AnythingLLM and Open WebUI Knowledge, or record a defensible evidence-backed reason a row is not applicable;
2. update the final product-value table;
3. confirm the frozen FTS configuration remains the least-complex acceptable strategy;
4. change this ADR to `Accepted` only if the full P2 gate is satisfied;
5. define the exact retrieval-config revision consumed by P3 durable provenance;
6. stop after ADR acceptance unless explicitly authorized to begin P3.
