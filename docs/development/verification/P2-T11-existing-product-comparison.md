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

## 2. Use the same fixed P2 corpus

Import the same immutable corpus snapshots used by the Golden Dataset. Do not substitute current web pages or silently refresh sources during the first run.

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

## 5. Multi-version/conflict behavior

Load two fixed versions/sources with conflicting facts and run the P2 conflict queries. Record whether the product:

- retrieves both facts;
- exposes their source/version distinction;
- collapses them ambiguously;
- cites enough information to reopen the exact supporting content.

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

## 9. Public-documentation audit

Recheck the official sources cited in `eval/reports/existing-product-comparison.md` for the exact tested release. If product behavior differs from current docs, preserve both the observed result and documentation mismatch.

## 10. Direct-base scope

```bash
git diff --check origin/experiment/p2-direct-file-pi-baseline...HEAD
git diff --name-status origin/experiment/p2-direct-file-pi-baseline...HEAD
```

Expected P2-T11-only scope: comparison report, task report/verification and safe bookkeeping. No product code fork, third product, retrieval implementation, ADR selection or P3 work belongs here.

## PASS condition

P2-T11 remains PARTIAL until both products are tested on fixed versions with the same P2 development corpus/queries, historical citation durability is directly observed, Chinese/code/conflict quality is recorded, and operational cost is measured. Public documentation research alone is not PASS evidence.
