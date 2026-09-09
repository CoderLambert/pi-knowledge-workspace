# P2-T11 — Existing local Knowledge product comparison

Status: **RESEARCHED / HANDS-ON UNRUN / PARTIAL**

Reviewed on: **2026-09-09**

Products are intentionally limited to two mature local/self-hosted Knowledge products:

1. AnythingLLM
2. Open WebUI Knowledge

The purpose is not feature-counting. The comparison focuses on the V1 invariants that could make Pi Knowledge Workspace unnecessary or justify keeping it distinct.

## Evidence status legend

- **DOCUMENTED** — the reviewed official source explicitly establishes the capability at a product-feature level.
- **NOT PROVEN** — the reviewed official sources do not establish the stronger invariant we need. This does **not** mean the product cannot do it.
- **HANDS-ON REQUIRED** — quality, persistence or operational behavior must be measured on a fixed local setup.

## Public-documentation matrix

| Criterion | AnythingLLM | Open WebUI Knowledge | Pi Knowledge Workspace requirement |
| --- | --- | --- | --- |
| local/self-hosted use | **DOCUMENTED** — Desktop for Linux/macOS/Windows and local-by-default app; self-hosted options documented | **DOCUMENTED** — self-hosted/offline platform; Docker/Python installation documented | single-user local-first desktop/workspace path |
| reusable document Knowledge | **DOCUMENTED** — ingest documents into workspaces; workspaces isolate document context | **DOCUMENTED** — reusable Knowledge bases, files/collections and model attachment | Workspace-scoped Sources/SourceVersions |
| retrieval | **DOCUMENTED** — vector DB/embedder choices and document chat/RAG product | **DOCUMENTED** — Focused Retrieval, BM25 + vector hybrid, reranking, agentic Knowledge tools | evidence-selected FTS or FTS+Dense+RRF |
| full-file context alternative | public materials reviewed here do not establish an equivalent fixed comparison mode | **DOCUMENTED** — Full Context injects the complete document, no chunking/search | P2-T10 direct-file Pi baseline covers this product question independently |
| source citations | **DOCUMENTED** — official README advertises source citations | **DOCUMENTED** — RAG citations and source filename/file id behavior documented | citation must resolve to immutable historical Evidence |
| immutable fixed SourceVersion identity | **NOT PROVEN** | **NOT PROVEN** | mandatory raw-byte SourceVersion identity |
| historical citation survives later source update | **NOT PROVEN** | **NOT PROVEN** | mandatory: citation opens historical SourceVersion/ParsedArtifact, not latest |
| update/sync behavior | docs expose document/workspace ingestion and a Live document sync beta, but historical retention semantics are **NOT PROVEN** | **DOCUMENTED** incremental directory sync for new/modified/deleted files; historical-version retention remains **NOT PROVEN** | update creates new immutable SourceVersion; old Evidence remains resolvable |
| Chinese retrieval quality on fixed corpus | **HANDS-ON REQUIRED** | **HANDS-ON REQUIRED** | measured Golden Dataset Chinese/mixed failures |
| code-symbol/version/error retrieval | **HANDS-ON REQUIRED** | **HANDS-ON REQUIRED** | measured code/version/error categories |
| conflict/multi-version questions | **HANDS-ON REQUIRED** | **HANDS-ON REQUIRED** | explicit multi-SourceVersion labels and conflict cases |
| notes/reuse | **DOCUMENTED adjacent capability** — workspaces and managed memories; Saved-Note-with-Evidence semantics **NOT PROVEN** | **DOCUMENTED adjacent capability** — Knowledge docs explicitly contrast Knowledge with Notes; stable Note→historical Evidence semantics **NOT PROVEN** | durable Saved Note revisions with stable Evidence refs |
| Pi workflow integration | **DOCUMENTED adjacent capability** — MCP compatibility and agents exist; Pi-specific integration **NOT PROVEN** | Knowledge/API/tool integration documented; Pi-specific integration **NOT PROVEN** | native PI WEB Workspace + restricted Pi runtime |
| API/export | Developer API documented | Knowledge export/API documented | local process API plus backup/restore |
| target operational cost | **HANDS-ON REQUIRED** | **HANDS-ON REQUIRED**; official docs describe Docker as recommended and warn RAG/embedding deployments need realistic memory headroom | compare install complexity, idle/RAG RSS, disk growth, startup/update/backup |

## What the documentation already tells us

### AnythingLLM

Official material establishes a broad local document-chat product rather than a narrow retrieval library. Its repository describes local-by-default operation, Desktop support, document ingestion, workspaces, source citations, agents, MCP compatibility, memories, multiple embedding providers and vector databases.

This makes AnythingLLM a serious **product substitute baseline** for “chat with a local knowledge collection.” It does not, from the reviewed sources, establish Pi Knowledge Workspace's stronger immutable SourceVersion/historical Evidence contract.

### Open WebUI Knowledge

Official documentation describes reusable Knowledge bases, Focused Retrieval and Full Context modes, BM25 + vector hybrid search with reranking, citations, agentic Knowledge tools, nested directories, incremental directory sync, export/API, and Notes as a separate full-content reuse concept.

This makes Open WebUI a strong baseline for both conventional RAG and “just provide the full document” workflows. The reviewed docs do not establish that a citation to an older file revision remains bound to immutable historical content after sync/update/delete.

## Sources reviewed

### AnythingLLM

- Official documentation home: https://docs.anythingllm.com/
- Official repository README: https://github.com/Mintplex-Labs/anything-llm/blob/master/README.md

### Open WebUI

- Knowledge: https://docs.openwebui.com/features/workspace/knowledge/
- RAG / citations: https://docs.openwebui.com/features/chat-conversations/rag/
- Quick Start: https://docs.openwebui.com/getting-started/quick-start/
- Performance / resource guidance: https://docs.openwebui.com/troubleshooting/performance/

## Required hands-on comparison

Public documentation is insufficient for the decision-critical rows. On the same target machine and fixed P2 corpus, test both products with:

1. the same development queries, including Chinese/mixed/code/version/conflict/no-answer categories;
2. a fixed source snapshot followed by a source update;
3. citation reopening after update and process restart;
4. multi-version/conflicting facts;
5. note/reuse flow where available;
6. installation/startup/update/backup friction;
7. idle RSS, query p95/RSS and disk/index growth.

Do not claim stable historical citations merely because the UI displays citations.

## Preliminary conclusion

Both products clearly overlap the broad “local documents + AI/RAG” product surface. Neither reviewed public documentation proves the exact historical Evidence invariant that is central to this repository.

Therefore P2-T11 cannot recommend abandoning or retaining Pi Knowledge Workspace from documentation alone. The decisive comparison remains the fixed-corpus hands-on test plus the P2-T10 direct-file Pi baseline.
