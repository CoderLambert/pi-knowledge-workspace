# P2-T11 support verification — existing-product evidence harness

Status: **PASS — CI CONTRACT / HEADLESS / HISTORY PROBES GREEN; LOCAL QUALITY RUNNER READY**

## CI gate

Canonical successful workflow run:

```text
run 34346351124
head aee050c1381231a6554ecd5cc73b8f080dfa35e7
conclusion success
```

Required artifacts were produced:

```text
p2-t11-existing-product-contracts
artifact 10101861390
sha256:0a101ee6ac2d8602246c678d1da3fe0123741a4a400858575c03acdfa881c068

p2-t11-anythingllm-smoke
artifact 10101923026
sha256:52da77763899234b34f2435dcbdb2f9db77fff0853b7adc95b79914da170002a

p2-t11-open-webui-smoke
artifact 10101922127
sha256:24806bef94f7069287078045e03b906f48179dacfb14681cde2ed3f3839f467e

p2-t11-anythingllm-history
artifact 10101976343
sha256:93bec875fcccbbc66eda6b2adeaf5ee7e6a774433709a2662cd243558dd64948
```

## Frozen product identities

```text
AnythingLLM tag v1.16.1
commit 35c58d89907e675a8c4fb10544c19be0f050f611

Open WebUI tag v0.11.3
commit 2a960a59fe1dbbd35282f0556b3666d81102e781
```

The contract probe must continue to fail closed on release/tag drift. No floating release may silently replace either fixed product.

## AnythingLLM local 50-query gate

The formal target-machine development run is:

```bash
node scripts/p2-run-anythingllm-development.mjs
```

The runner requires the existing frozen local setup:

```text
workspace: p2-t11-anythingllm
chat mode: query
exactly six frozen P2 corpus Markdown files
LLM: qwen3.5:9b-q8_0
LLM digest: 441ec31e4d2aedceb97dd834b036db104d943fbe3dbc1e5c8ac95eeaa9141c77
embedding: bge-m3:latest
embedding digest: 7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab
AnythingLLM commit: 35c58d89907e675a8c4fb10544c19be0f050f611
```

The script must execute exactly 50 development queries, serially, with `mode=query` and a unique API `sessionId` per query. It records the unmodified API response, source objects and latency for independent adjudication.

Default output:

```text
~/p2-t11-lab/evidence/anythingllm/anythingllm-development.json
~/p2-t11-lab/evidence/anythingllm/anythingllm-development.jsonl
```

A pre-existing final JSON file is a hard stop. Do not silently overwrite or rerun the formal bundle for tuning.

## Historical citation evidence

AnythingLLM has two independent positive observations:

1. CI API/storage probe: Source-A payload remains in historical chat source data after Source B becomes active and the service restarts.
2. Omarchy UI probe: original ORCHID answer -> same-named source replaced with COBALT -> service restart -> original citation reopened and still displayed ORCHID / `This statement is Source Version A.`

Classification for this tested path: **A — historical citation reopens Source Version A after replacement and restart.**

Do not over-generalize this to raw-byte-addressed immutable SourceVersion identity, delete/sync/export/restore paths, or Pi-native Evidence IDs without additional evidence.

## Safety / reproducibility

- no holdout data is loaded by this support task;
- no product code is vendored into this repository;
- model/provider revisions are frozen before formal scoring;
- query concurrency is one;
- raw answers/sources are preserved for independent review;
- no P3 implementation is allowed;
- no automatic merge.

## Remaining runtime hands-on gate

P2-T11 itself remains PARTIAL until:

- AnythingLLM 50-query development evidence is complete and independently adjudicated;
- Open WebUI v0.11.3 uses the same six corpus files and the same frozen Ollama LLM/embedder;
- Open WebUI historical citation durability is directly observed;
- multi-version/conflict behavior and citation reopen semantics are recorded;
- target-machine RSS/latency/persistent bytes/restart/update cost is measured;
- nearest native note/reuse semantics are exercised.

## Direct-base scope

Support-only. Expected direct-base scope is exactly five files:

```text
.github/workflows/p2-existing-product-evidence.yml
scripts/p2-prepare-existing-product-hands-on.mjs
scripts/p2-run-anythingllm-development.mjs
docs/development/reports/P2-T11-existing-product-evidence-harness.md
docs/development/verification/P2-T11-existing-product-evidence-harness.md
```

No automatic merge.
