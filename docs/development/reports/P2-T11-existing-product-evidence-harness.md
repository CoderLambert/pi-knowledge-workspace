# P2-T11 support — existing-product evidence harness

Status: **PASS — FIXED-VERSION CONTRACT / HEADLESS / HISTORICAL PROBES GREEN; LOCAL 50Q RUNNER READY**

## Purpose

Move P2-T11 hands-on evidence toward CI-first execution and minimize local/manual work. This support branch does not change the comparison decision or product code.

## Frozen products

Exactly two products are in scope:

```text
AnythingLLM v1.16.1
commit 35c58d89907e675a8c4fb10544c19be0f050f611

Open WebUI v0.11.3
commit 2a960a59fe1dbbd35282f0556b3666d81102e781
image ghcr.io/open-webui/open-webui:v0.11.3
```

AnythingLLM is intentionally pinned by Git tag/commit rather than a floating `latest/master` container.

## CI evidence

GitHub Actions run **34346351124** completed successfully on support head `aee050c1381231a6554ecd5cc73b8f080dfa35e7`.

Artifacts:

```text
p2-t11-existing-product-contracts
artifact 10101861390
digest sha256:0a101ee6ac2d8602246c678d1da3fe0123741a4a400858575c03acdfa881c068

p2-t11-anythingllm-smoke
artifact 10101923026
digest sha256:52da77763899234b34f2435dcbdb2f9db77fff0853b7adc95b79914da170002a

p2-t11-open-webui-smoke
artifact 10101922127
digest sha256:24806bef94f7069287078045e03b906f48179dacfb14681cde2ed3f3839f467e

p2-t11-anythingllm-history
artifact 10101976343
digest sha256:93bec875fcccbbc66eda6b2adeaf5ee7e6a774433709a2662cd243558dd64948
```

The CI history probe independently demonstrated that AnythingLLM preserves Source-A material in the stored historical chat source payload after replacing active Source A with Source B and restarting the service. This agrees with the separate Omarchy UI observation where the original ORCHID citation reopened Version A after COBALT replaced the active source.

## Contract probe

`scripts/p2-prepare-existing-product-hands-on.mjs --contracts-only` fails closed if either upstream tag resolves to a different commit or if the tested release no longer exposes the required headless/API surfaces.

AnythingLLM checks:

- single-user token request;
- Developer API key generation;
- workspace creation;
- workspace chat;
- workspace embedding update;
- document upload;
- Dockerfile source identity.

Open WebUI checks:

- Knowledge creation;
- Knowledge file attachment;
- file upload;
- exact release image digest resolution.

## Local AnythingLLM development runner

`scripts/p2-run-anythingllm-development.mjs` is the frozen local-machine quality runner for the already prepared `p2-t11-anythingllm` Workspace.

It fails closed on:

- AnythingLLM commit drift from `35c58d89907e675a8c4fb10544c19be0f050f611`;
- Ollama `qwen3.5:9b-q8_0` digest drift;
- Ollama `bge-m3:latest` digest drift;
- development-query count/order drift;
- Workspace document count other than exactly six;
- any missing frozen corpus filename.

The runner:

- authenticates through the local `AUTH_TOKEN` without printing or persisting it;
- creates a temporary Developer API key without writing the secret to evidence;
- executes all 50 frozen development queries serially;
- uses `mode=query` and a unique API `sessionId` per query;
- records raw answer, raw sources/citations, API metrics and wall-clock latency;
- writes a progressive JSONL plus one final JSON evidence bundle;
- refuses to overwrite the first formal evidence bundle silently.

This is development evidence only. It does not load or inspect holdout data.

## Remaining P2-T11 execution

Support harness preparation is PASS, but P2-T11 itself remains PARTIAL until:

1. the AnythingLLM 50-query local run is completed and independently adjudicated;
2. Open WebUI v0.11.3 is run on the same fixed corpus, LLM and embedder;
3. Open WebUI historical citation durability is directly observed;
4. target-machine operational measurements and nearest note/reuse behavior are recorded.

No P3 work and no automatic merge.
