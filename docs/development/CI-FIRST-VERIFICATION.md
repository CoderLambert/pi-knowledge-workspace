# CI-First Verification Policy

This document defines the default verification strategy for autonomous development in this repository.

It supplements `docs/development/AUTONOMOUS-EXECUTION.md` and narrows when verification debt may be deferred to the user's local machine.

## Principle

Verification must use the strongest reproducible environment available before asking for manual local evidence.

The default order is:

```text
GitHub CI
  -> GitHub evidence workflow / artifact
  -> target-machine or human acceptance only when GitHub cannot credibly cover the requirement
```

A missing local checkout in the current assistant runtime is **not** by itself a reason to defer executable repository verification. If GitHub Actions can execute the required workload, use GitHub Actions first.

## Verification layers

### Level 1 — GitHub CI

Use ordinary PR CI for deterministic repository checks such as:

- dependency installation;
- focused/unit/integration tests;
- typecheck;
- lint;
- knip/dead-code checks;
- build;
- package dry-run/install smoke;
- Linux/Windows compatibility where workflows provide both;
- direct-base diff/scope checks when the workflow has enough Git history.

CI failure must be classified before changing code:

1. Product Slice-attributable failure -> fix in the owning slice;
2. inherited failure with unchanged signature -> record/classify, do not patch unrelated code;
3. infrastructure/transient failure -> rerun or improve the workflow, do not treat as product failure.

### Level 2 — GitHub evidence workflows

Use a dedicated evidence workflow when acceptance requires a real executable workload beyond ordinary unit tests, including:

- real SQLite/native-driver execution;
- FTS5 or other database-extension probes;
- parser/chunker/index builds;
- retrieval benchmarks;
- fixed-corpus evaluation;
- deterministic resource/allocation measurements such as SQLite `dbstat`;
- generated benchmark reports;
- cross-profile quality comparisons;
- reproducibility bundles needed by an ADR.

Evidence workflows should execute production code paths rather than simulated ranks or hand-written fixtures whenever Product Slice or milestone acceptance depends on real runtime behavior.

Each evidence workflow should upload an artifact containing enough provenance to audit the run independently.

Recommended provenance:

```text
repository commit SHA
workflow/run identifier
runner OS/image
Node/npm/runtime versions
native dependency versions
SQLite/extension versions when relevant
fixed corpus/query/profile identifiers
important experiment parameters
result JSON/Markdown
logs
artifact digest when available
```

### Level 3 — Target-machine / human acceptance

Defer to the user's local environment only when GitHub Actions cannot credibly substitute for the required evidence.

Typical examples:

- performance claims about the user's Omarchy target machine;
- GPU- or hardware-specific behavior;
- real desktop/Wayland integration;
- real browser UX and browser-to-local-service behavior when hosted automation would not exercise the same trust boundary;
- physical Fleet/multi-host routing;
- local filesystem/workspace behavior that depends on the user's actual machine state;
- systemd/user-service behavior on the target installation;
- provider/model calls requiring user-owned credentials not explicitly configured for CI;
- interactive product hands-on where human judgment is an acceptance criterion;
- independent human correctness review required by an evaluation protocol.

Level 3 evidence should be minimized and batched into the smallest practical number of user actions, preferably a one-shot verification harness that produces a machine-readable evidence bundle.

## Evidence authority boundaries

GitHub Actions evidence is authoritative for the behavior it actually executes, but must not be generalized beyond its environment.

Examples:

- GitHub Linux SQLite/FTS correctness -> valid runtime/retrieval evidence.
- GitHub runner latency/RSS -> valid runner measurement and useful comparison data.
- GitHub runner latency/RSS -> **not** proof of Omarchy target-machine performance.
- Playwright/browser CI -> valid automated browser behavior for the tested environment.
- Playwright/browser CI -> **not automatically** equivalent to a physical Fleet or target desktop acceptance test.

Every report must label environment-specific measurements accordingly.

## Benchmark and holdout discipline

Evidence automation must preserve the experiment's evaluation protocol.

For retrieval work:

- development data may expose per-query diagnostics needed for tuning;
- holdout data must remain tuning-blind;
- CI may compute holdout aggregate acceptance metrics;
- do not publish holdout per-query identities/hit lists into ordinary tuning artifacts when that would enable parameter tuning against the holdout;
- fixture or static-research results must never be represented as a real retrieval benchmark when the task requires executable evidence.

## Workflow for Product Slices

For each Product Slice:

1. Integrate Agent Work Units on the Product Slice branch/Draft PR.
2. Run or trigger existing GitHub CI.
3. Read the actual checks/logs and classify every relevant failure.
4. If CI is insufficient but GitHub can execute the required workload, add or reuse the narrowest evidence harness/workflow.
5. Upload and inspect the evidence artifact.
6. Update the Product Slice PR, any warranted slice/user-journey verification guide, relevant ADR, and verification-debt classification from real evidence only.
7. Create or retain local/manual verification debt only for the acceptance portion that still cannot be credibly executed on GitHub.
8. Continue implementation under `AUTONOMOUS-EXECUTION.md` when policy permits; do not weaken a hard architecture/phase gate.

Agent Work Units normally use the Fast Gate and contribute their results through a concise handoff. They do not each require a dedicated CI workflow, remote branch, report or verification guide.

Do not repeatedly ask the user to execute commands that GitHub Actions can execute reproducibly.

## Evidence-harness scope

A verification harness may live in:

- the owning Product Slice PR when it is intrinsic to that slice's acceptance contract; or
- a narrow support PR when the harness has a genuinely independent lifecycle or review surface.

Support harnesses must not silently alter production behavior just to make the benchmark pass.

## Secrets and external providers

Prefer public/no-secret evidence paths.

Do not hard-code user credentials in workflows, repository files, logs, or artifacts.

Provider/model evidence that requires user-owned credentials remains local/manual unless the user explicitly authorizes a secure CI secret configuration and the repository workflow is designed to avoid secret disclosure.

## Verification debt reclassification

Older debt rows may state that repository verification is deferred because the assistant environment lacks a runnable checkout or dependency tree. After adoption of this policy, those reasons must be re-evaluated.

Do **not** mass-close old debt without evidence. Instead, when an owning task is revisited:

1. run the executable portion in GitHub Actions where practical;
2. attach the workflow/run/artifact evidence;
3. close only the rows actually proven;
4. leave target-machine, Fleet, hardware, credential, browser, or human-judgment portions open when still required.

## PASS semantics

CI-first changes *where* evidence is obtained, not the acceptance standard.

- `PASS` still requires all acceptance evidence required by the Product Slice or milestone gate.
- `PARTIAL` remains correct when GitHub proves repository/runtime behavior but target-machine or human evidence is still mandatory.
- `BLOCKED` remains correct for a hard gate whose required decision/evidence does not yet exist.
- A green GitHub workflow alone must never be used to override an explicit architecture or phase gate.
