# CI-first verification policy adoption

Status: **IMPLEMENTED**

Branch: `docs/ci-first-verification-policy`  
Direct base: `chore/p2-fts-evidence-harness` (support PR #48)

## Decision

Autonomous verification is now CI-first.

The default evidence order is:

```text
GitHub CI
  -> GitHub evidence workflow/artifact
  -> target-machine or human acceptance only when GitHub cannot credibly substitute
```

This replaces the previous operational tendency to treat "the assistant runtime has no runnable checkout/dependency tree" as sufficient reason to defer deterministic repository verification to the user.

## Motivation

P2 retrieval verification demonstrated that GitHub Actions can execute real repository/native workloads and preserve auditable evidence:

- dependency installation;
- `better-sqlite3@13.0.3`;
- SQLite 3.53.4 + FTS5;
- focused Vitest suites;
- production parser/chunker/index/search path;
- expanded-corpus retrieval benchmark;
- SQLite `dbstat` allocation;
- workflow logs and evidence artifacts.

This evidence is valid for the environment actually executed by GitHub. It does not replace target-machine performance, physical Fleet, desktop/browser trust-boundary, hardware/GPU, user credential, or required human-review acceptance.

## Repository changes

- adds `docs/development/CI-FIRST-VERIFICATION.md` as the detailed verification policy;
- updates `docs/development/AUTONOMOUS-EXECUTION.md` so autonomous tasks must exhaust credible GitHub verification before creating local/manual debt;
- explicitly preserves hard phase/architecture gates;
- preserves inherited-failure classification rather than patching unrelated code for green CI;
- requires holdout tuning isolation in automated benchmark artifacts;
- requires old verification-debt rows to be re-evaluated incrementally when their owning tasks are revisited, not mass-closed.

## Operational effect

For future tasks the autonomous loop should be:

```text
implement -> push/PR -> CI -> inspect logs -> specialized evidence workflow if needed
          -> inspect artifact -> classify remaining local-only acceptance -> continue/stop per gate
```

The user should only be asked to perform verification that GitHub cannot credibly reproduce, and those remaining actions should be batched into one-shot harnesses where practical.

## Non-goals

This policy does not:

- lower PASS criteria;
- make GitHub runner performance equivalent to Omarchy target-machine performance;
- authorize repository secrets or provider credentials;
- permit holdout-driven tuning;
- authorize automatic PR merges;
- override ADR-029 or any other explicit hard gate.
