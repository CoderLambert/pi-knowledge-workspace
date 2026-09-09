# P2-T11 support verification — existing-product evidence harness

Status: **OPEN — CONTRACT GATE PENDING CI**

## Contract gate

Run:

```bash
node scripts/p2-prepare-existing-product-hands-on.mjs --contracts-only
```

Required PASS conditions:

```text
AnythingLLM tag v1.16.1 -> 35c58d89907e675a8c4fb10544c19be0f050f611
Open WebUI tag v0.11.3 -> 2a960a59fe1dbbd35282f0556b3666d81102e781
```

The probe must also verify the exact fixed-release API surfaces used by the later hands-on harness and resolve an immutable digest for `ghcr.io/open-webui/open-webui:v0.11.3`.

Evidence output:

```text
/tmp/pi-knowledge-p2-evidence/p2-t11/existing-product-contracts.json
```

## Safety / reproducibility

- no floating product version is accepted;
- no provider credentials are required for the contract gate;
- no holdout data is loaded;
- no product code is vendored into this repository;
- no P3 implementation is allowed;
- failures are recorded rather than bypassed with a newer upstream release.

## Runtime hands-on gate — still required

This support preparation does not by itself satisfy P2-T11. PASS still requires both fixed products to be executed with the P2 corpus and to directly observe:

- Chinese/code/version/conflict/no-answer behavior;
- citations/source references;
- source A -> answer/citation -> source B update -> process restart -> reopen original citation;
- multi-version conflict behavior;
- persistent storage/restart/update behavior;
- operational measurements.

The model/provider configuration used for quality comparison must be fixed and recorded before development queries are scored.

## Direct-base scope

Support-only. Expected direct-base scope is exactly four files:

```text
.github/workflows/p2-existing-product-evidence.yml
scripts/p2-prepare-existing-product-hands-on.mjs
docs/development/reports/P2-T11-existing-product-evidence-harness.md
docs/development/verification/P2-T11-existing-product-evidence-harness.md
```

No automatic merge.
