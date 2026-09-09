# Autonomous Development Execution Policy

This document supplements `DEVELOPMENT-PLAN.md` for unattended development periods and **supersedes the stop-on-unverified-dependency sentence in `DEVELOPMENT-PLAN.md` §1.3(4) while unattended automation is active**.

Verification execution follows `docs/development/CI-FIRST-VERIFICATION.md`. When repository/runtime evidence can be produced credibly by GitHub Actions, GitHub Actions is the default verification environment before local/manual debt is created.

## Objective

Allow implementation to continue autonomously while the user is unavailable, without weakening final PASS, phase-gate, or release-gate standards.

Development progression and final acceptance are separate concerns:

- implementation may advance;
- reproducible verification should be executed through GitHub CI/evidence workflows whenever possible;
- genuinely unavailable target-machine/manual verification is recorded as debt;
- no task is falsely marked PASS;
- deferred verification does not by itself block later implementation unless the project defines a hard gate.

## Unattended execution rule

When a task reaches verification:

1. Run every automated/static/build check available through the current environment or existing GitHub CI.
2. If ordinary CI is insufficient but GitHub Actions can credibly execute the required real workload, add or reuse the narrowest evidence harness/workflow and inspect its logs/artifacts.
3. Classify failures before changing code: task-attributable, inherited, or infrastructure/transient.
4. Only after GitHub-capable verification is exhausted, record checks that truly require the user's target machine, browser/desktop trust boundary, Fleet/multi-host topology, hardware/GPU, system services, user-owned credentials, provider access, or human judgment in `docs/development/VERIFICATION-DEBT.md` and the task report/verification guide.
5. Keep the task `PARTIAL` if required acceptance evidence is still missing.
6. Continue to the next planned implementation task instead of waiting for the user when policy and architecture permit.
7. If a later task depends on an unverified invariant, proceed against the documented contract/assumption, isolate that dependency behind the narrowest practical interface, and add contract tests, mocks, fixtures, or GitHub evidence workflows where possible.
8. Record the assumption and dependency risk in both the producer and consumer task records.
9. Stop only when implementation is literally impossible without missing information/data/credentials that cannot reasonably be stubbed, when continuing would require destructive/unsafe actions, or when an explicit architecture/phase gate forbids progression without the missing decision/evidence.

A missing runnable checkout in the assistant environment is not, by itself, a reason to defer executable repository verification to the user. Prefer GitHub Actions when it can execute the workload reproducibly.

A deferred invariant is therefore a recorded risk, not an automatic development stop condition, unless it is part of an explicit hard gate.

## CI-first verification tiers

Use the following order by default:

```text
Level 1 — GitHub CI
  unit/integration/static/build/package checks

Level 2 — GitHub evidence workflow
  real SQLite/FTS/parser/chunker/retrieval/benchmark workloads + artifacts

Level 3 — target-machine / human acceptance
  Omarchy performance, physical Fleet, desktop/browser trust boundaries,
  hardware/GPU, local system services, user credentials, human review
```

GitHub runner measurements are valid evidence for the runner environment but must not be relabeled as target-machine performance.

Do not ask the user to repeat deterministic repository work that GitHub Actions can execute and preserve as auditable logs/artifacts.

## Branch and PR policy

Each development task must have its own branch and PR.

Preferred naming:

```text
feat/p0-<task-name>
feat/p1-<task-name>
experiment/p2-<task-name>
feat/p3-<task-name>
chore/p4-<task-name>
feat/p5-<task-name>
```

Rules:

1. One task scope per branch/PR.
2. Do not place later-task implementation into an earlier task branch.
3. When task B depends on unmerged task A, branch B from A and open B as a stacked PR against A's branch.
4. Continue stacking dependent tasks in implementation order.
5. Independent tasks may branch from the nearest accepted/stable base instead of being needlessly stacked.
6. Every PR description must state its base task/branch, deferred verification debt, and whether it is safe to merge independently.
7. Do not automatically merge PRs unless the user explicitly authorizes merging.
8. Before marking a PR implementation-complete, compare it against its direct base and confirm the diff contains only that task's intended scope.
9. Verification-support harnesses/workflows may use a separate narrow stacked PR when including them in the owning task would pollute product scope; support PRs must not silently change production behavior.

This structure lets the user later validate and merge progress incrementally in dependency order without losing task boundaries.

## Status semantics during unattended development

- `PASS`: all required implementation and acceptance evidence exists.
- `PARTIAL`: implementation is complete or substantially complete, but required verification debt remains.
- `BLOCKED`: implementation cannot proceed because required information/capability cannot reasonably be stubbed, proceeding would be destructive/unsafe, or an explicit hard gate requires missing evidence/decision.
- `TODO`: implementation has not started.

Do not convert `PARTIAL` to `PASS` solely because later tasks have been implemented successfully or because a GitHub workflow is green when the task still requires target-machine/human acceptance.

## Verification debt discipline

Before creating a new debt row, determine whether the requirement can be covered credibly by GitHub CI or a dedicated evidence workflow under `CI-FIRST-VERIFICATION.md`.

Every deferred item must include:

```text
Task
Branch
PR
Status
Why GitHub/current automation cannot credibly verify it
GitHub evidence already obtained, if any
Exact remaining local/manual verification procedure
Expected PASS evidence
Assumptions used by later tasks
Dependent tasks, if any
Resolution state
```

Older debt rows that say the assistant lacks a checkout/dependency tree must be re-evaluated when their owning task is revisited. Do not mass-close them; execute the GitHub-capable portion first, close only evidence actually proven, and leave genuinely target-specific portions open.

When the user returns, remaining target-machine/manual verification should be performed task-by-task or in compatible batches, preferably through a one-shot harness that minimizes user actions. Once evidence is supplied, update the originating task report, changelog/plan status, PR description, and debt ledger.

## Benchmark and holdout discipline

Autonomous evidence collection must preserve experiment isolation:

- development diagnostics may be exposed for tuning;
- holdout results may be computed for acceptance but must remain tuning-blind;
- do not publish holdout per-query identities/hit lists into tuning artifacts when doing so would enable parameter tuning against the holdout;
- fixture/static-research results must not be represented as real benchmark evidence when executable runtime evidence is required.

## Merge order

For stacked work, the normal merge order is oldest dependency first:

```text
Task A
→ Task B
→ Task C
```

After merging a lower PR, later stacked PRs may be retargeted/rebased as appropriate, but their task-specific diff must remain reviewable.

## Inherited failures

Known inherited baseline failures remain explicitly classified and must not be patched inside unrelated task branches merely to make a test suite appear green.

When GitHub CI exposes a failure, compare the failing file/signature with the direct-base task diff and prior evidence before assigning ownership.

## Final gates remain strict

Autonomous progression and CI-first verification do not waive phase or release acceptance. Before a phase/release is declared PASS, all verification debt required by that gate must be resolved or explicitly removed by an intentional plan/architecture decision.

A green CI/evidence workflow never overrides an explicit architecture or phase gate such as a required ADR decision.