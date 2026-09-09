# P2-T11 — Existing local Knowledge product comparison

Status: **PASS — DECISION-SUFFICIENT EVIDENCE**

Reviewed: **2026-09-09 to 2026-09-10**

Products remain intentionally limited to:

1. AnythingLLM
2. Open WebUI Knowledge

## Decision purpose

The comparison is not a feature contest. It answers whether mature local products make a Pi-owned Knowledge subsystem unnecessary, and which responsibilities can reasonably be treated as reusable infrastructure.

The architecture question is now explicitly split:

```text
Canonical Knowledge Domain ownership
vs
Retrieval / generic RAG infrastructure
```

This split is the reason a second full 50-query product run is no longer a required P2 gate.

## Evidence status legend

- **DOCUMENTED** — official material establishes the product-level capability.
- **HANDS-ON PASS** — directly observed on the fixed local setup.
- **FORMAL RUN** — fixed local development run with raw evidence preserved.
- **PARTIAL / DIAGNOSTIC** — useful observation, not promoted to a formal score.
- **NOT PROVEN** — evidence does not establish Pi's stronger invariant; this does not mean the product cannot support it.
- **DE-SCOPED** — further testing intentionally stopped because it is no longer decision-critical.

## Comparison matrix

| Criterion | AnythingLLM v1.16.1 | Open WebUI v0.11.3 | Pi requirement / conclusion |
| --- | --- | --- | --- |
| local/self-hosted | **DOCUMENTED + HANDS-ON** | **DOCUMENTED + fixed-version contract/smoke evidence** | compatible with local-first direction |
| reusable Knowledge | **DOCUMENTED + HANDS-ON** | **DOCUMENTED** | mature products already cover generic document RAG |
| fixed-corpus answerable quality | **FORMAL RUN** — 39/39 successful answerable responses semantically correct | **DE-SCOPED** as a full quality benchmark | a second full run is not needed to prove mature RAG viability |
| first-attempt runtime reliability | **47/50 success**; 3 preserved runtime/API failures | partial long-run diagnostics only; no formal score | operational behavior remains product-specific |
| no-answer discipline | **CONCERN** — unsupported negative/generalized claims in several frozen no-answer cases | no formal score | generation/grounding policy is distinct from retrieval backend choice |
| returned-source coverage | **39/39 successful answerable queries contained all required Golden documents in returned top-4** | no formal score | mature retrieval can supply the required documents |
| historical citation after replacement/restart | **HANDS-ON PASS** — old ORCHID citation reopened Version A after COBALT replacement and restart | not required as a P2 completion gate after de-scope | historical citation is not a unique justification for custom generic RAG |
| immutable Pi SourceVersion / byte-span Evidence | **NOT PROVEN** | **NOT PROVEN** | remains Pi canonical-domain responsibility |
| frozen multi-step generation scope | **NOT PROVEN** | **NOT PROVEN** | Pi must own generation-scope semantics if required by product |
| DerivedArtifact revision/provenance lifecycle | **NOT PROVEN** | **NOT PROVEN** | Pi product/domain concern, not a generic retrieval capability |
| Pi host-authoritative Workspace/worktree scope | Pi-specific integration not proven | Pi-specific integration not proven | remains Pi-owned integration boundary |
| optional external-provider potential | plausible through API, but adapter/scope/identity contract not yet accepted | plausible in principle, targeted probes may be run later | future option, not canonical store decision |

## AnythingLLM fixed formal evidence

```text
product: AnythingLLM v1.16.1
commit: 35c58d89907e675a8c4fb10544c19be0f050f611
LLM: qwen3.5:9b-q8_0
LLM digest: 441ec31e4d2aedceb97dd834b036db104d943fbe3dbc1e5c8ac95eeaa9141c77
embedding: bge-m3:latest
embedding digest: 7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab
vector DB: LanceDB
chat mode: Query
corpus: same six frozen P2 Markdown files
dataset hash: 949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3
```

Formal run:

```text
records: 50
success: 47
failure: 3
failure IDs: dev-011, dev-040, dev-041
JSONL SHA-256: d62197426809c28636c8d04d609a901c613237c9be1a448364775c487c4b1cb9
```

Independent semantic adjudication:

```text
correct: 41
partial: 2
incorrect: 4
execution failure: 3
successful answerable: 39/39 correct
version/conflict mistakes among successful responses: 0
material required-Evidence omissions among successful answerable responses: 0
```

The weak area is no-answer / negative-evidence discipline. That finding does not imply that a denser retrieval stack is required.

Returned-source metrics:

```text
47 successful responses x 4 sources = 188 source objects
all required Golden documents returned for successful answerable queries: 39/39
required doc top-1: 37/39
required-document MRR: 0.9743589743589743
```

Raw successful answers contained `<think>...</think>` tags, so any Pi-facing adapter would require an explicit reasoning-output sanitization/separation contract.

## Historical citation durability

Observed fixed-version sequence:

```text
A: ALPHA-741 -> ORCHID
old thread answers ORCHID
same-named source replaced with B: COBALT
new thread answers COBALT
service restart
reopen original thread/citation
old citation still displays Version A / ORCHID
```

Classification: **HANDS-ON PASS for the tested AnythingLLM path.**

This establishes product-level historical citation durability for one path. It does not establish Pi's stronger canonical contract for immutable raw SourceVersion, ParsedArtifact identity, byte/span Evidence, retention closure, backup/restore, or DerivedArtifact lineage.

## Open WebUI de-scope decision

Open WebUI remains a useful second mature-product reference, but the full 50-query benchmark is explicitly **DE-SCOPED**.

A fixed-version long run was started and produced partial diagnostics. Those partial records are retained but are not scored, retried, or tuned.

Reason:

AnythingLLM already supplies the decision-critical mature-product evidence needed to show that generic local RAG/retrieval and historical citation behavior can be strong. The remaining architectural question is not whether a second product can also answer the frozen corpus; it is which canonical semantics Pi must own independently of retrieval implementation.

If Pi later considers a production external-RAG adapter, targeted Open WebUI tests may be reopened for the exact adapter contract: source/span mapping, scope isolation, update/restart behavior, export/backup, and operating cost.

## Final product-comparison conclusion

P2-T11 is **PASS on evidence sufficiency**.

The comparison supports the following architecture boundary:

```text
Pi should not reimplement generic retrieval/RAG merely to differentiate itself.

Pi should own canonical Knowledge semantics that mature-product evidence does not establish:
- host-authoritative Workspace scope
- Source / immutable SourceVersion
- versioned ParsedArtifact / canonical content
- Stable Evidence and historical reopening
- frozen generation scope / delivered Evidence
- DerivedArtifact revisions / provenance / lifecycle

Retrieval remains replaceable infrastructure.
```

The full Open WebUI benchmark is not required to close this product question because it no longer has a plausible path to changing the canonical-domain decision.

## P2-T12 consequence

ADR-029 must no longer be blocked on “complete both product benchmarks.” It must instead finalize the canonical Knowledge boundary and the evidence-backed V1 retrieval strategy.

P3 remains prohibited until ADR-029 is formally Accepted.

Do not restart broad product benchmarking solely to satisfy the superseded comparison checklist. No automatic merge.
