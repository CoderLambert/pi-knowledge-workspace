# P2-T11 — Existing product comparison

Status: **PASS — DECISION-SUFFICIENT EVIDENCE; OPEN WEBUI FULL BENCHMARK DE-SCOPED**

## Objective

Use mature local/self-hosted Knowledge products to answer a product-architecture question, not to complete a feature checklist:

> Which Knowledge responsibilities are sufficiently commoditized that Pi should reuse or replace them, and which semantics must remain Pi-owned?

The selected products remain:

1. AnythingLLM
2. Open WebUI Knowledge

No third product is added.

## Decision change — 2026-09-10

The original P2-T11 plan required comparable full hands-on evidence for both products. That gate was useful while the architecture question was still framed as:

```text
custom Pi Knowledge
vs
mature local Knowledge product
```

The architecture question has since been decomposed into two independent decisions:

```text
1. Canonical Knowledge Domain ownership
2. Retrieval / generic RAG infrastructure
```

That decomposition materially changes the value of a second 50-query product benchmark.

Current architecture direction is:

```text
Pi owns canonical Knowledge identity and lifecycle:
Source / SourceVersion / ParsedArtifact / Evidence
Generation scope / DerivedArtifact revisions / provenance

Retrieval is a replaceable derived-index capability.
```

AnythingLLM already supplies enough direct evidence to establish that mature local products can provide strong generic RAG/retrieval and even meaningful historical citation durability. A second long Open WebUI quality run is therefore no longer decision-critical for deciding whether Pi must own its canonical Knowledge Domain.

The owner explicitly de-scoped the full Open WebUI benchmark rather than continuing it only to satisfy an obsolete checklist. Any partial Open WebUI run is retained as diagnostic evidence only and is not promoted to a formal quality score.

## AnythingLLM fixed hands-on setup

```text
product: AnythingLLM v1.16.1
commit: 35c58d89907e675a8c4fb10544c19be0f050f611
LLM: Ollama qwen3.5:9b-q8_0
LLM digest: 441ec31e4d2aedceb97dd834b036db104d943fbe3dbc1e5c8ac95eeaa9141c77
embedding: Ollama bge-m3:latest
embedding digest: 7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab
vector DB: LanceDB
chat mode: Query
corpus: same six frozen P2 Markdown files
dataset hash: 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
```

## AnythingLLM historical citation durability — PASS

Observed fixed-version sequence:

1. Version A contained `ALPHA-741 -> ORCHID` and explicitly identified itself as Source Version A.
2. The original thread answered ORCHID and exposed a source citation.
3. The same-named source was replaced with Version B containing `ALPHA-741 -> COBALT`.
4. A fresh thread answered COBALT, proving current retrieval advanced to B.
5. AnythingLLM restarted.
6. The original ORCHID thread was reopened without re-querying.
7. The original citation still displayed Version A / ORCHID content.

Classification: **A — historical citation reopened Version A after same-name replacement and restart.**

This proves one durable historical citation path in AnythingLLM v1.16.1. It does not prove Pi's stronger canonical contract: immutable raw SourceVersion identity, stable byte/span Evidence, frozen generation scope, retention closure, or every delete/sync/export/restore path.

## AnythingLLM formal 50-query development run

The formal target-machine run completed once with no retries and no tuning.

```text
records: 50
first-attempt success: 47 / 50 = 94%
first-attempt runtime/API failure: 3 / 50 = 6%
failed queries: dev-011, dev-040, dev-041
```

Failures were preserved as runtime/reliability evidence:

- `dev-011`: HTTP 500 / CUDA launch timeout path;
- `dev-040`: fixed 180,000 ms request timeout;
- `dev-041`: fixed 180,000 ms request timeout.

Raw JSONL:

```text
SHA-256: d62197426809c28636c8d04d609a901c613237c9be1a448364775c487c4b1cb9
records: 50
```

Independent semantic adjudication over the frozen corpus/labels:

```text
correct: 41
partial: 2
incorrect: 4
execution failure: 3

successful answerable responses: 39 / 39 correct
first-attempt end-to-end correct answerable: 39 / 42 = 92.857%
version/conflict mistakes among successful responses: 0
material required-Evidence omissions among successful answerable responses: 0
```

Primary weakness was no-answer / negative-evidence discipline, not answerable retrieval quality. Unsupported definitive negatives/generalizations appeared in `dev-015`, `dev-032`, `dev-046`, and `dev-050`; `dev-039` and `dev-045` were partial. `dev-035` remains a known Golden answerability defect because the challenge corpus directly supports the comparison despite its frozen `no-answer` label.

Returned-source observations:

```text
47 successful responses x 4 sources = 188 returned source objects
39 / 39 successful answerable queries contained all required Golden source documents in returned top-4
required document top-1: 37 / 39
required-document MRR: 0.9743589743589743
```

The raw API answer also exposed `<think>...</think>` reasoning tags on all 47 successful responses, which is an adapter/sanitization concern for a Pi integration surface.

## Open WebUI evidence — intentionally bounded

Open WebUI v0.11.3 remains useful as:

- a documented second mature-product reference;
- a possible future external-provider candidate;
- a source of targeted API/citation/operational probes if a concrete integration decision later requires them.

A fixed-version local 50-query run was started, but the owner stopped treating completion as a P2 acceptance requirement after the architecture decision was reframed. The partial run is not scored, not retried, and not used to claim comparative quality.

This is an explicit scope decision, not a hidden test failure.

## Product-architecture conclusion

The mature-product evidence is sufficient for the decision it was intended to support:

1. Generic local RAG/retrieval is already mature enough that Pi should not justify custom Knowledge by claiming mature products cannot retrieve, answer, or preserve any historical citation state.
2. Mature-product capability does **not** establish suitability as Pi's canonical Knowledge store.
3. Pi's durable differentiation and ownership boundary is the canonical Knowledge Domain: workspace scope, immutable SourceVersion/ParsedArtifact identity, Stable Evidence, generation scope, DerivedArtifact revision/provenance, and lifecycle semantics.
4. Retrieval should therefore be treated as replaceable infrastructure rather than the owner of Knowledge identity.

P2-T11 is **PASS on decision sufficiency**. The full Open WebUI benchmark is de-scoped because it no longer has a plausible path to changing the core domain-ownership decision.

## Consequence for P2-T12 / ADR-029

P2-T11 is no longer the ADR blocker.

ADR-029 must now close the actual architecture boundary:

- canonical Pi-owned Knowledge identity/lifecycle;
- versioned ParsedArtifact / Evidence contract;
- frozen generation scope;
- DerivedArtifact revision semantics;
- retrieval as a rebuildable provider/projection;
- V1 retrieval selection from existing P2 evidence.

P3 remains prohibited until ADR-029 is formally Accepted.

## Out of scope

- optimizing or tuning AnythingLLM/Open WebUI;
- rerunning failed product queries to improve scores;
- completing a second 50-query benchmark solely for checklist symmetry;
- adding a third product;
- entering P3 before ADR-029 acceptance;
- automatically merging any PR.
