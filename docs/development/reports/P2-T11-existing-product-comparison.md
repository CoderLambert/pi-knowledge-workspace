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

The reviewed sources do not prove immutable historical SourceVersion identity or that a citation to an older source revision remains resolvable after the source changes.

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

## Decision-critical unknowns

Documentation cannot establish:

- stable historical citation reopening after source update/restart;
- Chinese/code/version/error retrieval quality on the fixed P2 corpus;
- conflict/multi-version behavior;
- exact note→historical-source reuse semantics;
- Pi-specific workflow integration quality;
- target-machine idle/query RSS, p95, disk/index growth and operating friction.

These remain hands-on acceptance rather than assumptions.

## Preliminary conclusion

Both products are credible product substitutes for broad local document chat/RAG. Neither can be dismissed from feature descriptions, and neither can be declared equivalent to this repository's historical Evidence model from public documentation alone.

P2-T11 therefore remains PARTIAL until fixed-corpus hands-on comparison is executed. The final P2-T12 Retrieval ADR must use those results together with P2 retrieval benchmarks and the P2-T10 direct-file Pi baseline.

## Out of scope

- installing/modifying either external product in this GitHub automation environment;
- adding a third comparison product;
- changing Pi Knowledge Workspace architecture from marketing/documentation claims alone;
- final retrieval ADR selection.
