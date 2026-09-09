# P2-T11 support — existing-product evidence harness

Status: **PASS — HARNESS COMPLETE; ANYTHINGLLM FORMAL EVIDENCE CAPTURED; OPEN WEBUI LONG RUN DE-SCOPED**

## Purpose

Provide reproducible fixed-version evidence tooling for P2-T11 without turning mature-product benchmarking into a permanent product-development track.

This support task does not choose the Pi architecture and does not modify production Knowledge code.

## Frozen products

```text
AnythingLLM v1.16.1
commit 35c58d89907e675a8c4fb10544c19be0f050f611

Open WebUI v0.11.3
commit 2a960a59fe1dbbd35282f0556b3666d81102e781
image ghcr.io/open-webui/open-webui:v0.11.3
```

## CI evidence

Canonical successful support workflow:

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

The AnythingLLM CI history probe independently retained Source-A material in historical chat source data after Source B became active and the service restarted. This agrees with the separate UI observation where the original ORCHID citation reopened Version A after COBALT replaced the active source.

## AnythingLLM formal local run — COMPLETE

`scripts/p2-run-anythingllm-development.mjs` executed the frozen development set once on the target machine.

```text
records: 50
first-attempt success: 47
first-attempt runtime/API failure: 3
failed IDs: dev-011, dev-040, dev-041
JSONL SHA-256: d62197426809c28636c8d04d609a901c613237c9be1a448364775c487c4b1cb9
```

No failed query was retried and no product parameter was tuned to improve the formal result.

Independent semantic adjudication:

```text
correct: 41
partial: 2
incorrect: 4
execution failure: 3
successful answerable responses: 39/39 correct
```

The main semantic concern is no-answer/negative-evidence discipline. This is preserved as product evidence rather than converted into a retrieval-tuning task.

## Open WebUI long-run scope decision

Open WebUI fixed-version contract/smoke evidence remains valid. A local 50-query run was later started, but completion was intentionally de-scoped by the owner after the architecture decision was reframed around canonical Knowledge ownership versus replaceable retrieval infrastructure.

Rules:

- preserve partial local diagnostics if useful;
- do not score the incomplete run as a formal comparative result;
- do not rerun or tune it to obtain checklist symmetry;
- do not treat a full Open WebUI run as a P2-T11 PASS requirement;
- reopen targeted probes only if a future external-provider decision has a concrete unanswered contract question.

This is a deliberate decision-sufficiency stop, not a silent benchmark failure.

## Support-task conclusion

The harness has done its job:

- fixed-version product identity is enforced;
- headless/API contracts were probed;
- AnythingLLM historical behavior was independently exercised;
- a reproducible formal AnythingLLM 50-query runner was delivered and executed;
- raw evidence was preserved for independent review.

No additional mature-product benchmark infrastructure is required for the current architecture decision.

P2-T11 product comparison is now closed on decision-sufficient evidence. ADR-029 must proceed by freezing Pi's own canonical Knowledge/domain and retrieval-provider boundaries rather than by demanding more symmetric product benchmarking.

No P3 work and no automatic merge.
