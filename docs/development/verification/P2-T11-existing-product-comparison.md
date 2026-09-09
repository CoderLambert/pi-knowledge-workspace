# P2-T11 verification — Existing product comparison

Status: **OPEN / PARTIAL**

## 1. Products and versions

Compare exactly:

- AnythingLLM
- Open WebUI Knowledge

Before testing, record for each:

```text
exact product version/image/tag
installation method
model/provider + revision
embedding model + revision
vector/retrieval configuration
chunking/retrieval settings
target OS/hardware
```

Do not compare floating `latest` configurations without recording the resolved version.

AnythingLLM fixed hands-on configuration recorded on 2026-09-09:

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

## 2. Use the same fixed P2 corpus

Import the same immutable corpus snapshots used by the Golden Dataset. Do not substitute current web pages or silently refresh sources during the first run.

AnythingLLM: the same six fixed P2 Markdown corpus files used by P2-T10 were loaded successfully after correcting an initial UI placement mistake. No corpus mutation is accepted as benchmark evidence.

Record how each product identifies uploaded files/collections and whether raw source copies/embeddings are inspectable/exportable.

## 3. Development-query quality comparison

Run the same fixed development queries, emphasizing:

- Chinese;
- Chinese-English mixed;
- code symbols;
- versions/error codes;
- multi-source/conflict;
- no-answer.

For each query record:

- raw answer;
- citations/source references;
- latency;
- missing/incorrect/unsupported claims;
- whether the expected Stable Evidence can be mapped from the cited source.

Use the same human correctness rubric as P2-T10. Do not let either product's own model be the sole judge.

AnythingLLM canary observation only, not the formal 50-query score:

- 6 UI queries exercised Chinese, code-symbol, version/conflict and no-answer behavior;
- 4 matched the frozen evidence expectations;
- `dev-032` and `dev-050` failed the frozen no-answer rubric by making unsupported negative inferences from selected/incomplete option lists;
- because the UI canary was not run as fully isolated API sessions, do not use 4/6 as the final quality score.

## 4. Historical citation durability test

For each product:

1. ingest Source version A containing a uniquely identifiable fact;
2. ask a question and preserve the answer/citation;
3. update/replace/sync the source to version B where that fact changes;
4. restart the product;
5. reopen the original conversation/citation;
6. determine whether the old citation resolves to the exact version-A content, redirects to version B, becomes broken, or has no historical-open concept.

Record observable storage/UI/API evidence. Do not infer historical stability merely from a filename citation.

This is a decisive comparison row for Pi Knowledge Workspace.

### AnythingLLM v1.16.1 — observed PASS for the durability probe

Probe facts:

```text
Version A: ALPHA-741 -> ORCHID
Version B: ALPHA-741 -> COBALT
same source filename: durability-source.md
```

Observed sequence:

1. Version A was ingested in a dedicated workspace.
2. A first thread answered ORCHID and exposed a source citation.
3. The same-named source was replaced with Version B.
4. A fresh thread answered COBALT, proving current retrieval/index content had advanced to Version B.
5. AnythingLLM was restarted.
6. The original ORCHID thread was reopened without re-querying.
7. Its original citation was opened.
8. The source panel displayed Version A content, including the ORCHID fact and `This statement is Source Version A.`

Classification: **A — old citation resolves to Version A after replacement and restart.**

Acceptance consequence: AnythingLLM v1.16.1 passes this specific historical citation durability behavior. Do not downgrade it to “filename-only citation” or “citation drift” based on public docs. Do not overclaim that this proves Pi's stronger raw-byte-addressed immutable SourceVersion identity or all update/delete/export paths.

Open WebUI still requires the same direct probe.

## 5. Multi-version/conflict behavior

Load two fixed versions/sources with conflicting facts and run the P2 conflict queries. Record whether the product:

- retrieves both facts;
- exposes their source/version distinction;
- collapses them ambiguously;
- cites enough information to reopen the exact supporting content.

AnythingLLM canary successfully distinguished v16.7 Experimental from v22.3 no-longer-experimental, but formal isolated query evidence remains required.

## 6. Notes / reuse

Exercise the nearest native reuse feature:

- AnythingLLM: workspace/memory/reuse functionality applicable to the tested version;
- Open WebUI: Notes/Knowledge reuse applicable to the tested version.

Record whether saved/reused content preserves exact source/citation identity after source updates.

Do not label memories or Notes equivalent to Pi Saved Notes unless this behavior is demonstrated.

## 7. Pi workflow fit

Assess the actual integration cost of using each product beside PI WEB/Pi:

- API/tool/MCP surfaces available in the tested version;
- whether Workspace selection/scope can be made host-authoritative;
- whether Pi would need a second independent workspace/session/navigation model;
- credential/runtime boundaries;
- export/backup path.

Public MCP/API existence is not sufficient to claim native Pi integration.

## 8. Operational cost

On the same target machine record:

- install/setup time and steps;
- idle RSS/CPU;
- first-ingest time;
- query median/p95 latency and peak RSS for the fixed corpus;
- persistent data/vector index bytes;
- restart behavior;
- source update/reindex cost;
- backup/export procedure;
- upgrade friction encountered.

AnythingLLM install/model/network setup is now exercised, but quantitative operational measurements remain pending.

## 9. Public-documentation audit

Recheck the official sources cited in `eval/reports/existing-product-comparison.md` for the exact tested release. If product behavior differs from current docs, preserve both the observed result and documentation mismatch.

AnythingLLM note: public documentation did not prove historical citation retention, but the v1.16.1 hands-on probe did. Preserve that distinction.

## 10. Direct-base scope

```bash
git diff --check origin/experiment/p2-direct-file-pi-baseline...HEAD
git diff --name-status origin/experiment/p2-direct-file-pi-baseline...HEAD
```

Expected P2-T11-only scope: comparison report, task report/verification and safe bookkeeping. No product code fork, third product, retrieval implementation, ADR selection or P3 work belongs here.

## Remaining evidence before PASS

P2-T11 remains PARTIAL until:

- AnythingLLM formal isolated 50-query development run is captured and independently adjudicated;
- Open WebUI fixed-version hands-on run uses the same corpus, LLM and embedder;
- Open WebUI historical citation durability is directly observed;
- Chinese/code/conflict/no-answer quality is recorded from the formal runs;
- Notes/reuse and operational-cost rows are measured for both products.

## PASS condition

P2-T11 passes only when both fixed products have sufficient comparable hands-on evidence to support the product-substitution decision. Public documentation alone is not PASS evidence, and the successful AnythingLLM durability probe does not by itself complete P2-T11.
