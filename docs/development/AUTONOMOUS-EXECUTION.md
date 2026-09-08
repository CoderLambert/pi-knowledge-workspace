# Autonomous Development Execution Policy

This document supplements `DEVELOPMENT-PLAN.md` for unattended development periods and **supersedes the stop-on-unverified-dependency sentence in `DEVELOPMENT-PLAN.md` §1.3(4) while unattended automation is active**.

## Objective

Allow implementation to continue autonomously while the user is unavailable, without weakening final PASS, phase-gate, or release-gate standards.

Development progression and final acceptance are separate concerns:

- implementation may advance;
- unavailable local/manual verification is recorded as debt;
- no task is falsely marked PASS;
- deferred verification does not by itself block later implementation.

## Unattended execution rule

When a task reaches a verification step that requires the user's local machine, browser/UI interaction, Fleet or multi-instance environment, system services, hardware, credentials, provider access, or another capability unavailable to the current execution environment:

1. Run every automated/static/build check that is available.
2. Record the unavailable checks in `docs/development/VERIFICATION-DEBT.md` and the task report/verification guide.
3. Keep the task `PARTIAL` if required acceptance evidence is still missing.
4. Continue to the next planned implementation task instead of waiting for the user.
5. If a later task depends on an unverified invariant, proceed against the documented contract/assumption, isolate that dependency behind the narrowest practical interface, and add contract tests, mocks, or fixtures where possible.
6. Record the assumption and dependency risk in both the producer and consumer task records.
7. Stop only when implementation is literally impossible without missing information/data/credentials that cannot reasonably be stubbed, or when continuing would require destructive or unsafe actions.

A deferred invariant is therefore a recorded risk, not an automatic development stop condition.

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

This structure lets the user later validate and merge progress incrementally in dependency order without losing task boundaries.

## Status semantics during unattended development

- `PASS`: all required implementation and acceptance evidence exists.
- `PARTIAL`: implementation is complete or substantially complete, but required verification debt remains.
- `BLOCKED`: implementation cannot proceed because required information/capability cannot reasonably be stubbed, or because proceeding would be destructive/unsafe.
- `TODO`: implementation has not started.

Do not convert `PARTIAL` to `PASS` solely because later tasks have been implemented successfully.

## Verification debt discipline

Every deferred item must include:

```text
Task
Branch
PR
Status
Reason automation cannot verify it
Exact verification procedure
Expected PASS evidence
Assumptions used by later tasks
Dependent tasks, if any
Resolution state
```

When the user returns, verification should be performed task-by-task or in compatible batches. Once evidence is supplied, update the originating task report, changelog/plan status, PR description, and debt ledger.

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

## Final gates remain strict

Autonomous progression does not waive phase or release acceptance. Before a phase/release is declared PASS, all verification debt required by that gate must be resolved or explicitly removed by an intentional plan/architecture decision.