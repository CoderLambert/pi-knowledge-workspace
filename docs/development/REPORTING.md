# Development Reporting Standard

This repository treats task reporting and user verification documentation as part of the implementation Definition of Done.

A development task is not considered complete until its repository report has been written or updated. A user-visible or behavior-changing task must also include a reproducible verification guide.

## Required workflow

For analysis/documentation-only tasks:

```text
Task deliverable
→ verification/review
→ repository report
→ report index / phase status update
→ task may be marked complete
```

For behavior-changing tasks:

```text
Task implementation
→ automated verification
→ repository report
→ human verification guide
→ report/verification indexes + phase status update
→ task may be marked complete
```

## Report location

Completed-task reports live under:

```text
docs/development/reports/
```

Human-executable feature verification guides live under:

```text
docs/development/verification/
```

See [`VERIFICATION.md`](./VERIFICATION.md) for the required verification-guide format.

## Required report sections

Every task report must contain, at minimum:

1. Task metadata.
2. Objective.
3. Scope.
4. Changes.
5. Files changed.
6. Architecture decisions.
7. Security / correctness invariants.
8. Verification actually executed.
9. User verification guide link for behavior-changing tasks.
10. Known limitations / unresolved items.
11. Result: PASS / PARTIAL / BLOCKED.
12. Impact on the plan.
13. Next task.

## Evidence rules

Reports must distinguish between implemented behavior, static review, tests written, tests actually executed, CI state, manual verification, and assumptions/deferred validation.

Do not report a test or CI gate as passing unless it actually ran successfully.

A verification guide documents **how** a user can test a feature. It is not evidence that the user test has already been performed.

```text
Verification guide exists ≠ verification passed
```

When a task produces a PR, the PR should link to both its repository report and its human verification guide when the task changes behavior.

## Architecture discipline

Use:

- `docs/architecture/` for durable architecture decisions and baselines;
- `docs/development/` for plans and implementation constraints;
- `docs/development/reports/` for chronological task execution evidence;
- `docs/development/verification/` for copyable human acceptance procedures.

If a task changes a durable architectural decision, update or add the corresponding ADR in the same task.

## Completion rule

From P0 onward:

```text
Analysis task + report missing = NOT COMPLETE
Behavior implementation + report missing = NOT COMPLETE
Behavior implementation + verification guide missing = NOT COMPLETE
Behavior implementation + required runtime/CI verification pending = PARTIAL
Behavior implementation + required verification + report + verification guide = PASS
```
