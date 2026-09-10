# P0-T07 — Restricted Pi Runtime Probe

Status: **PARTIAL**

Branch: `experiment/p0-restricted-pi-runtime-probe`

## Objective

Convert the prior restricted-runtime spike into repository-owned executable code and tests using the current Pi SDK surface.

## Implementation

Added `src/knowledge/runtime/restrictedPiRuntime.ts`.

The probe constructs Pi with:

- explicit custom tool allowlist containing only `knowledge_sources`, `knowledge_search`, `knowledge_read`, `submit_answer`;
- `DefaultResourceLoader` with extensions, skills, prompt templates, themes, and context files disabled;
- in-memory settings storage with project trust disabled;
- `SessionManager.inMemory()`;
- `InMemoryCredentialStore`;
- `ModelRuntime.create({ modelsPath: null, refreshOnCreate: false, allowModelNetwork: false })`.

The runtime is intentionally a P0 executable contract probe, not the P3 grounded-Ask implementation. Tool bodies are deterministic no-op probes.

## Security contract

Model-visible built-in shell/filesystem mutation or discovery tools are not allowed. Project/global AGENTS, skills, extensions, prompts, themes, model config files, and persisted credentials are not loaded through this runtime factory.

## Tests

`src/knowledge/runtime/restrictedPiRuntime.test.ts` asserts:

1. active tools are exactly the four Knowledge tools;
2. `bash`, `read`, `write`, `edit`, `grep`, `find`, and `ls` are absent;
3. seeded project `AGENTS.md`, extension, skill, and prompt resources remain undiscovered.

## Dependency assumptions

P0-T07 consumes P0-T06 only as an architectural sequencing dependency; it does not add or alter Machine/Fleet routing. Open P0-T04/P0-T05/P0-T06 verification debt therefore does not change this runtime isolation contract.

## Verification state

The autonomous environment can inspect GitHub source but cannot run the repository dependency tree. Focused tests, typecheck, lint, knip, build, package dry-run, and full-suite execution remain OPEN verification debt. P0-T07 stays PARTIAL until executable evidence is recorded.

No production Ask workflow, retrieval implementation, provider credential plumbing, or network-capable custom tool is introduced by this task.
