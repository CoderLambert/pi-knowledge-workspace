# P2-T11 support verification — existing-product evidence harness

Status: **PASS — SUPPORT EVIDENCE COMPLETE FOR CURRENT DECISION**

## CI gate

Canonical successful workflow run:

```text
run 34346351124
head aee050c1381231a6554ecd5cc73b8f080dfa35e7
conclusion success
```

Artifacts:

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
AnythingLLM v1.16.1
commit 35c58d89907e675a8c4fb10544c19be0f050f611

Open WebUI v0.11.3
commit 2a960a59fe1dbbd35282f0556b3666d81102e781
```

The contract probe must continue to fail closed on tag/release drift if reused later.

## AnythingLLM formal development evidence — VERIFIED

Formal target-machine run:

```text
50 development records
47 success
3 first-attempt runtime/API failures
failure IDs: dev-011, dev-040, dev-041
JSONL SHA-256: d62197426809c28636c8d04d609a901c613237c9be1a448364775c487c4b1cb9
```

Discipline:

- development split only;
- serial execution;
- unique API session per query;
- no failed-query retry;
- no tuning after results;
- no holdout run;
- raw answers/sources/errors preserved.

Independent semantic adjudication:

```text
correct: 41
partial: 2
incorrect: 4
execution failure: 3
successful answerable responses: 39/39 correct
```

Historical citation classification remains:

```text
A / PASS
old ORCHID citation reopens Version A
after same-named COBALT replacement + restart
```

## Open WebUI scope decision

The support harness proved the fixed Open WebUI v0.11.3 contract/smoke surface. A local long-run benchmark was later started but is intentionally not required to complete this support task or P2-T11.

Reason:

The mature-product comparison no longer decides whether Pi should delegate its entire Knowledge domain. The architecture is now split between Pi-owned canonical Knowledge semantics and replaceable retrieval/RAG infrastructure. AnythingLLM already supplies enough direct mature-product evidence for generic RAG viability and one strong historical-citation path.

Therefore:

- incomplete Open WebUI long-run evidence is diagnostic only;
- do not publish a partial quality score;
- do not retry/tune it;
- do not complete it solely for symmetry;
- future targeted Open WebUI probes require a concrete adapter/integration question.

## PASS condition

This support task passes when it provides enough reproducible product evidence to support the current architecture decision without creating unnecessary benchmark debt.

That condition is met.

The support task does **not** establish that AnythingLLM or Open WebUI can own Pi canonical SourceVersion/Evidence/DerivedArtifact semantics. It establishes that generic mature-product RAG capabilities are sufficiently real that Pi should not justify custom domain ownership by claiming generic RAG is unavailable elsewhere.

## Direct-base scope

Support-only scope remains the existing five files:

```text
.github/workflows/p2-existing-product-evidence.yml
scripts/p2-prepare-existing-product-hands-on.mjs
scripts/p2-run-anythingllm-development.mjs
docs/development/reports/P2-T11-existing-product-evidence-harness.md
docs/development/verification/P2-T11-existing-product-evidence-harness.md
```

No production Knowledge code, ADR acceptance, P3 implementation, branch deletion, or automatic merge belongs in this PR.
