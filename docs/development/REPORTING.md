# Development Reporting Standard

This repository treats task reporting, human verification documentation, and the concise development changelog as part of the Definition of Done.

A development task is not considered complete until its repository report has been written or updated. A user-visible or behavior-changing task must also include a reproducible verification guide. Every task status change must be reflected in `CHANGELOG.md`.

## Required workflow

For analysis/documentation-only tasks:

```text
Task deliverable
→ verification/review
→ repository report
→ CHANGELOG entry
→ report index / phase status update
→ task may be marked complete
```

For behavior-changing tasks:

```text
Task implementation
→ automated verification
→ repository report
→ human verification guide
→ CHANGELOG entry
→ report/verification indexes + phase status update
→ task may be marked complete
```

## Documentation locations

Detailed task reports:

```text
docs/development/reports/
```

Human-executable feature verification guides:

```text
docs/development/verification/
```

Concise project progress log:

```text
docs/development/CHANGELOG.md
```

See [`VERIFICATION.md`](./VERIFICATION.md) for the required verification-guide format.

## Report requirements

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

## Changelog requirements

`CHANGELOG.md` is intentionally short. It is for quick progress review, not implementation evidence.

For each task status change, add:

```text
YYYY-MM-DD  TASK-ID  STATUS
- one-line outcome
- optional one-line important consequence / blocker
```

Do not duplicate file-by-file details, test logs, or architecture rationale there. Link to reports when detail is needed.

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
- `docs/development/` for plans, standards, and the concise changelog;
- `docs/development/reports/` for chronological task execution evidence;
- `docs/development/verification/` for copyable human acceptance procedures.

If a task changes a durable architectural decision, update or add the corresponding ADR in the same task.

## Completion rule

From P0 onward:

```text
Analysis task + report/changelog missing = NOT COMPLETE
Behavior implementation + report missing = NOT COMPLETE
Behavior implementation + verification guide missing = NOT COMPLETE
Behavior implementation + changelog missing = NOT COMPLETE
Behavior implementation + required runtime/CI verification pending = PARTIAL
Implementation + required verification + report + verification guide + changelog = PASS
```
