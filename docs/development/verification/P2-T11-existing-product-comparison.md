# P2-T11 verification — Existing product comparison

Status: **PASS — DECISION-SUFFICIENT EVIDENCE**

## Verification objective

P2-T11 verifies whether mature local Knowledge products materially change the architecture decision for Pi Knowledge. It is not a requirement to produce symmetric benchmark coverage when additional product runs no longer affect that decision.

The selected products remain:

- AnythingLLM
- Open WebUI Knowledge

## Frozen AnythingLLM evidence

```text
AnythingLLM v1.16.1
commit 35c58d89907e675a8c4fb10544c19be0f050f611
LLM qwen3.5:9b-q8_0
LLM digest 441ec31e4d2aedceb97dd834b036db104d943fbe3dbc1e5c8ac95eeaa9141c77
embedding bge-m3:latest
embedding digest 7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab
vector DB LanceDB
chat mode Query
six frozen P2 corpus files
dataset hash 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
```

### Historical citation durability

Fixed-version direct observation:

```text
Version A: ALPHA-741 -> ORCHID
Version B: ALPHA-741 -> COBALT
same source replaced
current query advanced to B
service restarted
old thread reopened
old citation still displayed Version A / ORCHID
```

Classification: **A / PASS for the tested historical citation path.**

Do not over-generalize this to Pi's stronger byte/span-addressed Evidence, source deletion, backup/restore, or all update/sync paths.

### Formal 50-query development run

One formal run, serial, no retries, no tuning, no holdout:

```text
records: 50
success: 47
runtime/API failure: 3
failed IDs: dev-011, dev-040, dev-041
JSONL SHA-256: d62197426809c28636c8d04d609a901c613237c9be1a448364775c487c4b1cb9
```

Independent semantic adjudication:

```text
correct: 41
partial: 2
incorrect: 4
execution failure: 3
successful answerable: 39 / 39 correct
version/conflict mistakes among successful responses: 0
material required-Evidence omissions among successful answerable responses: 0
```

No-answer / negative-evidence discipline remains weak; this is not evidence that a different vector backend is required.

Returned-source observations:

```text
47 successful responses returned 188 source objects total
39 / 39 successful answerable queries contained all required Golden documents in returned top-4
required document top-1: 37 / 39
required-document MRR: 0.9743589743589743
```

The API exposed `<think>...</think>` tags in all 47 successful raw answers; a Pi-facing adapter would need an explicit sanitization/separation contract.

## Open WebUI scope decision — 2026-09-10

Open WebUI v0.11.3 public/fixed-version contract evidence remains useful as a second mature-product reference. A local long-form benchmark was started, but completion is intentionally de-scoped.

Reason:

The architecture question has changed from:

```text
Can a mature product replace Pi Knowledge as a whole?
```

to:

```text
Which canonical Knowledge semantics must Pi own,
and which retrieval/RAG capabilities may remain replaceable infrastructure?
```

AnythingLLM already demonstrates that mature products can provide strong answerable RAG quality and a durable historical citation path. Completing a second 50-query product benchmark has low decision value for the now-separate canonical-domain decision.

Rules for the partial Open WebUI run:

- preserve any captured raw diagnostics;
- do not score the partial run as a formal comparative result;
- do not retry/tune to improve it;
- do not require completion for P2-T11 PASS;
- reopen targeted Open WebUI probes later only if an external-provider decision needs them.

## Revised PASS condition

P2-T11 passes when mature-product evidence is sufficient to answer the product-substitution boundary with no remaining decision-critical unknown that could plausibly reverse the architecture direction.

That condition is satisfied because the evidence now establishes:

1. mature local RAG/retrieval can be strong on the frozen answerable corpus;
2. mature products can preserve meaningful historical citation state;
3. those capabilities do not establish Pi's stronger canonical identity, Evidence, generation-scope, or DerivedArtifact lifecycle semantics;
4. a second full product quality benchmark cannot decide whether Pi must own those canonical semantics.

Therefore P2-T11 is **PASS — DECISION-SUFFICIENT EVIDENCE**.

## Consequence for ADR-029

P2-T11 must no longer be listed as the only ADR blocker.

ADR-029 acceptance now depends on freezing the actual architecture contract, including:

- Source / SourceVersion selection semantics;
- versioned ParsedArtifact / DocumentIR identity;
- Stable Evidence and historical reopening;
- frozen generation scope / delivered Evidence;
- DerivedArtifact revision/provenance semantics;
- retrieval as a rebuildable projection/provider;
- evidence-backed V1 retrieval configuration.

P3 remains prohibited until ADR-029 is formally Accepted.

## Discipline

- no holdout rerun;
- no failed-query retries for tuning;
- no Open WebUI tuning campaign;
- no product code fork;
- no third comparison product;
- no P3 implementation;
- no automatic merge.
