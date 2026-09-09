# P2-T11 — Existing product comparison

Status: **PARTIAL**

## Objective

Compare at most two mature local Knowledge products against the repository's decision-critical V1 requirements rather than against a generic feature checklist.

## Direct base

P2-T10 / `experiment/p2-direct-file-pi-baseline` / PR #42.

This task is stacked and is not independently merge-safe before its base.

## Products selected

1. AnythingLLM
2. Open WebUI Knowledge

No third product is added in this task.

## Research performed — 2026-09-09

Reviewed current official documentation/repository material for:

- local/self-hosted operation;
- document Knowledge/RAG;
- citations;
- retrieval modes;
- agents/tools/APIs;
- note/memory/reuse-adjacent features;
- installation/resource guidance.

`eval/reports/existing-product-comparison.md` separates **DOCUMENTED**, **NOT PROVEN**, and **HANDS-ON REQUIRED** claims.

## High-confidence public-documentation findings

### AnythingLLM

Official material establishes:

- local-by-default product positioning and Desktop support including Linux;
- document ingestion/workspaces;
- source citations;
- agents;
- MCP compatibility;
- memories/personalization;
- multiple embedding and vector database choices;
- developer API.

Public documentation alone did not prove immutable historical SourceVersion identity or citation durability after source replacement. Hands-on evidence below now establishes one historical citation durability probe for the fixed v1.16.1 setup.

### Open WebUI Knowledge

Official documentation establishes:

- self-hosted/offline deployment;
- reusable Knowledge bases;
- Focused Retrieval and Full Context modes;
- BM25 + vector hybrid retrieval with reranking;
- citations;
- agentic Knowledge tools;
- nested directories and incremental directory sync;
- export/API;
- Notes as a distinct reuse/full-content concept.

The reviewed sources do not prove Pi Knowledge Workspace's immutable historical SourceVersion/Evidence semantics after sync/update/delete.

## AnythingLLM hands-on evidence — 2026-09-09

Fixed setup used for the local probe:

```text
product: AnythingLLM v1.16.1
LLM provider: Ollama
LLM model: qwen3.5:9b-q8_0
LLM digest: 441ec31e4d2aedceb97dd834b036db104d943fbe3dbc1e5c8ac95eeaa9141c77
embedding provider: Ollama
embedding model: bge-m3:latest
embedding digest: 7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab
vector DB: LanceDB
chat mode: Query
```

The same six fixed P2 corpus Markdown files used by P2-T10 were loaded into the workspace. A six-query canary exercised Chinese, code-symbol, version/conflict and no-answer behavior. Four answers matched the frozen evidence expectations; two no-answer boundary cases (`dev-032`, `dev-050`) made unsupported negative inferences from incomplete/selected option lists. Because these six canary questions were not executed as fully isolated API sessions, this result is diagnostic only and is not the formal 50-query score.

### Historical citation durability probe — PASS for observed UI behavior

A dedicated workspace was used so the probe did not mutate the fixed P2 corpus.

1. Source Version A contained `ALPHA-741 -> ORCHID` and explicitly identified itself as Source Version A.
2. A query produced an ORCHID answer with a source citation.
3. The same-named source was replaced by Version B containing `ALPHA-741 -> COBALT`.
4. A fresh thread retrieved COBALT, confirming the current workspace/index had moved to Version B.
5. AnythingLLM was restarted.
6. The original ORCHID thread was reopened and its original source citation was opened.
7. The source panel still displayed the Version A text, including `ORCHID` and `This statement is Source Version A.`

Observed classification: **A — the historical citation reopened Version A after source replacement and process restart.**

This is direct evidence that AnythingLLM v1.16.1 preserves enough historical source material for the tested chat citation to reopen the old content. It does **not** yet prove Pi's stronger internal contract of raw-byte-addressed immutable SourceVersion identity, nor does one probe establish all update/delete/export paths.

## Remaining decision-critical unknowns

P2-T11 still requires:

- formal isolated 50-query AnythingLLM development run with raw answers, sources and latency;
- Open WebUI fixed-version hands-on run on the same corpus/model/embedder;
- Open WebUI historical citation durability probe;
- multi-version/conflict and no-answer adjudication from the formal runs;
- nearest Notes/reuse semantics;
- target-machine idle/query RSS, p95, disk/index growth and operating friction for both products.

## Preliminary conclusion

AnythingLLM can no longer be treated as lacking historical citation durability on the basis of public documentation: the fixed v1.16.1 hands-on probe directly reopened Version A after Version B replacement and restart. This materially narrows the architectural differentiation that Pi Knowledge Workspace must justify.

P2-T11 nevertheless remains **PARTIAL** until the formal AnythingLLM run and the equivalent Open WebUI evidence are complete. The final P2-T12 Retrieval ADR must use those results together with P2 retrieval benchmarks and the P2-T10 direct-file Pi baseline.

## Out of scope

- adding a third comparison product;
- changing Pi Knowledge Workspace architecture from marketing/documentation claims alone;
- final retrieval ADR selection;
- P3 work before ADR-029 is accepted.
