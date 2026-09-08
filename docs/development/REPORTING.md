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

Naming convention:

```text
<Px-Tyy>-<short-title>.md
```

Example:

```text
P0-T01-integration-seams.md
P0-T02-knowledge-plugin-skeleton.md
```

Human-executable feature verification guides live under:

```text
docs/development/verification/
```

See [`VERIFICATION.md`](./VERIFICATION.md) for the required verification-guide format.

## Required report sections

Every task report must contain, at minimum:

1. **Task metadata** — task id, date, branch, PR, status, phase.
2. **Objective** — what the task was intended to prove or deliver.
3. **Scope** — explicitly included and excluded work.
4. **Changes** — concrete behavior, architecture, code and documentation changes.
5. **Files changed** — important repository paths and their responsibilities.
6. **Architecture decisions** — decisions made, alternatives rejected, and why.
7. **Security / correctness invariants** — trust boundaries or correctness rules established by the task.
8. **Verification** — tests, CI, manual checks and other evidence actually executed.
9. **User verification guide** — for behavior-changing tasks, link the corresponding file under `docs/development/verification/`.
10. **Known limitations / unresolved items** — anything not yet verified or intentionally deferred.
11. **Result** — PASS / PARTIAL / BLOCKED with a precise explanation.
12. **Impact on the plan** — whether later tasks or architecture changed.
13. **Next task** — exact next development step.

## Evidence rules

Reports must distinguish between:

- implemented behavior;
- statically reviewed behavior;
- automated tests written;
- automated tests actually executed;
- CI status;
- manual verification;
- assumptions or deferred validation.

Do not report a test or CI gate as passing unless it actually ran successfully.

A verification guide documents **how** a user can test a feature. It is not evidence that the user test has already been performed.

Therefore:

```text
Verification guide exists ≠ verification passed
```

When a task produces a PR, the PR should link to both:

- its repository development report;
- its human verification guide, when the task changes behavior.

## Architecture discipline

A task report is not a replacement for an ADR or architecture document.

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
