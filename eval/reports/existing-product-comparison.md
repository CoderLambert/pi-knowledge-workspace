# P2-T11 — Existing local Knowledge product comparison

Status: **RESEARCHED / ANYTHINGLLM HANDS-ON PARTIAL / PARTIAL**

Reviewed on: **2026-09-09**

Products are intentionally limited to two mature local/self-hosted Knowledge products:

1. AnythingLLM
2. Open WebUI Knowledge

The purpose is not feature-counting. The comparison focuses on the V1 invariants that could make Pi Knowledge Workspace unnecessary or justify keeping it distinct.

## Evidence status legend

- **DOCUMENTED** — the reviewed official source explicitly establishes the capability at a product-feature level.
- **HANDS-ON PASS** — directly observed on the fixed local setup for the stated probe.
- **PARTIALLY OBSERVED** — some required behavior was directly observed, but the stronger internal invariant remains unproven.
- **NOT PROVEN** — the reviewed evidence does not establish the stronger invariant we need. This does **not** mean the product cannot do it.
- **HANDS-ON REQUIRED** — quality, persistence or operational behavior still must be measured on a fixed local setup.

## Comparison matrix

| Criterion | AnythingLLM | Open WebUI Knowledge | Pi Knowledge Workspace requirement |
| --- | --- | --- | --- |
| local/self-hosted use | **DOCUMENTED + HANDS-ON** — v1.16.1 ran locally on the target Omarchy machine | **DOCUMENTED** — self-hosted/offline platform; Docker/Python installation documented | single-user local-first desktop/workspace path |
| reusable document Knowledge | **DOCUMENTED + HANDS-ON** — fixed six-file P2 corpus loaded into a dedicated workspace | **DOCUMENTED** — reusable Knowledge bases, files/collections and model attachment | Workspace-scoped Sources/SourceVersions |
| retrieval | **DOCUMENTED + HANDS-ON PARTIAL** — Query mode over LanceDB + Ollama embedding worked on canary queries | **DOCUMENTED** — Focused Retrieval, BM25 + vector hybrid, reranking, agentic Knowledge tools | evidence-selected FTS or FTS+Dense+RRF |
| full-file context alternative | public materials reviewed here do not establish an equivalent fixed comparison mode | **DOCUMENTED** — Full Context injects the complete document, no chunking/search | P2-T10 direct-file Pi baseline covers this product question independently |
| source citations | **DOCUMENTED + HANDS-ON** — answer sources were shown and historical source content could be reopened in the durability probe | **DOCUMENTED** — RAG citations and source filename/file id behavior documented | citation must resolve to immutable historical Evidence |
| immutable fixed SourceVersion identity | **PARTIALLY OBSERVED** — historical Version A content remained reopenable after replacement/restart, but raw-byte-addressed immutable identity is not proven | **NOT PROVEN** | mandatory raw-byte SourceVersion identity |
| historical citation survives later source update | **HANDS-ON PASS (single v1.16.1 probe)** — old ORCHID citation reopened Version A after same-name replacement with COBALT and restart | **NOT PROVEN / HANDS-ON REQUIRED** | mandatory: citation opens historical SourceVersion/ParsedArtifact, not latest |
| update/sync behavior | **HANDS-ON PARTIAL** — same-name manual replacement advanced current retrieval to Version B while old chat citation retained Version A | **DOCUMENTED** incremental directory sync for new/modified/deleted files; historical-version retention remains **NOT PROVEN** | update creates new immutable SourceVersion; old Evidence remains resolvable |
| Chinese retrieval quality on fixed corpus | **HANDS-ON PARTIAL** — canary succeeded on direct Chinese/version questions; formal isolated 50-query run pending | **HANDS-ON REQUIRED** | measured Golden Dataset Chinese/mixed failures |
| code-symbol/version/error retrieval | **HANDS-ON PARTIAL** — canary succeeded on `UnwrapRef<T>` and version-conflict questions; formal run pending | **HANDS-ON REQUIRED** | measured code/version/error categories |
| conflict/multi-version questions | **HANDS-ON PARTIAL** — v16.7 vs v22.3 stability canary distinguished both versions; formal run pending | **HANDS-ON REQUIRED** | explicit multi-SourceVersion labels and conflict cases |
| no-answer behavior | **HANDS-ON CONCERN** — canary `dev-032` and `dev-050` made unsupported negative inferences from incomplete/selected option lists | **HANDS-ON REQUIRED** | abstain when Stable Evidence is insufficient |
| notes/reuse | **DOCUMENTED adjacent capability** — workspaces and managed memories; Saved-Note-with-Evidence semantics **NOT PROVEN** | **DOCUMENTED adjacent capability** — Knowledge docs explicitly contrast Knowledge with Notes; stable Note→historical Evidence semantics **NOT PROVEN** | durable Saved Note revisions with stable Evidence refs |
| Pi workflow integration | **DOCUMENTED adjacent capability** — MCP compatibility and developer API exist; Pi-specific integration **NOT PROVEN** | Knowledge/API/tool integration documented; Pi-specific integration **NOT PROVEN** | native PI WEB Workspace + restricted Pi runtime |
| API/export | Developer API documented; API-based formal runner remains to be executed | Knowledge export/API documented | local process API plus backup/restore |
| target operational cost | **HANDS-ON PARTIAL** — install/model/network path established; formal idle/query RSS, latency and persistent-byte measurements pending | **HANDS-ON REQUIRED** | compare install complexity, idle/RAG RSS, disk growth, startup/update/backup |

## AnythingLLM fixed hands-on setup

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
corpus: same six fixed P2 Markdown corpus files used by P2-T10
```

### Canary observations

A six-query UI canary exercised Chinese, code-symbol, version/conflict and no-answer behavior. Four answers matched the frozen evidence expectations. `dev-032` and `dev-050` failed the frozen no-answer rubric by turning absence from a selected/incomplete option list into a negative conclusion. These canaries were not executed as fully isolated API sessions, so they are diagnostic evidence only, not the formal 50-query result.

### Historical citation durability probe

A dedicated source contained `ALPHA-741 -> ORCHID` and `This statement is Source Version A.` A first thread answered ORCHID and exposed a source citation. The same-named source was then replaced by Version B containing `ALPHA-741 -> COBALT`; a new thread answered COBALT, proving current retrieval had advanced. After restarting AnythingLLM, the original ORCHID thread's original source citation was reopened and the source panel still displayed the Version A text.

Observed classification: **A — historical citation reopened Version A after source replacement and restart.**

This directly disproves the provisional assumption that AnythingLLM necessarily lacks historical citation durability. It does not by itself prove Pi's stronger byte-addressed SourceVersion identity, retention across every delete/sync/export path, or a stable public identifier suitable for Pi Evidence references.

## What the documentation already tells us

### AnythingLLM

Official material establishes a broad local document-chat product rather than a narrow retrieval library. Its repository describes local-by-default operation, Desktop support, document ingestion, workspaces, source citations, agents, MCP compatibility, memories, multiple embedding providers and vector databases.

Hands-on v1.16.1 evidence now additionally establishes one successful historical citation durability path.

### Open WebUI Knowledge

Official documentation describes reusable Knowledge bases, Focused Retrieval and Full Context modes, BM25 + vector hybrid search with reranking, citations, agentic Knowledge tools, nested directories, incremental directory sync, export/API, and Notes as a separate full-content reuse concept.

The reviewed docs do not establish that a citation to an older file revision remains bound to immutable historical content after sync/update/delete; this still requires the equivalent hands-on probe.

## Sources reviewed

### AnythingLLM

- Official documentation home: https://docs.anythingllm.com/
- Official repository README: https://github.com/Mintplex-Labs/anything-llm/blob/master/README.md
- Fixed hands-on release: v1.16.1

### Open WebUI

- Knowledge: https://docs.openwebui.com/features/workspace/knowledge/
- RAG / citations: https://docs.openwebui.com/features/chat-conversations/rag/
- Quick Start: https://docs.openwebui.com/getting-started/quick-start/
- Performance / resource guidance: https://docs.openwebui.com/troubleshooting/performance/

## Remaining hands-on comparison

P2-T11 is not complete. Remaining required evidence includes:

1. formal isolated 50-query AnythingLLM development run with raw answers, raw sources and latency;
2. fixed-version Open WebUI run on the same corpus, LLM and embedder;
3. Open WebUI historical citation durability probe after source replacement and restart;
4. formal multi-version/conflict/no-answer adjudication;
5. nearest Notes/reuse flow for each product;
6. idle RSS/CPU, query median/p95 and peak RSS, persistent bytes, restart/update cost and backup/export friction.

## Preliminary conclusion

AnythingLLM now has direct evidence for the strongest product-level challenge examined so far: the tested v1.16.1 UI preserved and reopened historical Version A citation content after a same-name Version B replacement and process restart. That materially weakens “historical citation support” as a unique justification for a custom Pi Knowledge subsystem unless Pi's stricter immutable identity, host-authoritative scope, integration, or operational requirements remain differentiating in the full comparison.

P2-T11 remains **PARTIAL**. No ADR selection or P3 work is justified until the remaining AnythingLLM and Open WebUI evidence is complete.
