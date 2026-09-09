# P2-T11 support — existing-product evidence harness

Status: **PREPARATION — FIXED-VERSION CONTRACT PROBE ADDED**

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

The probe stores source-file SHA-256 hashes and the resolved Open WebUI image digest in the evidence artifact.

## Next execution layer

After this contract gate is green, extend this same support task with headless runtime probes:

1. start fixed versions in isolated persistent volumes;
2. use a single frozen local model/embedder configuration for both products where possible;
3. import the six P2 corpus files;
4. exercise update/restart/historical-citation behavior;
5. run the fixed development-query quality subset/full set required by P2-T11;
6. record RSS, latency, persistent bytes and restart/update cost.

No P3 work and no automatic merge.
