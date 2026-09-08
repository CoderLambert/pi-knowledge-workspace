# Development Reporting Standard

This repository treats task reporting as part of the implementation Definition of Done.

A development task is not considered complete until its repository report has been written or updated.

## Required workflow

```text
Task implementation
→ verification
→ repository report
→ report index / phase status update
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
9. **Known limitations / unresolved items** — anything not yet verified or intentionally deferred.
10. **Result** — PASS / PARTIAL / BLOCKED with a precise explanation.
11. **Impact on the plan** — whether later tasks or architecture changed.
12. **Next task** — exact next development step.

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

When a task produces a PR, the PR should link to its repository report.

## Architecture discipline

A task report is not a replacement for an ADR or architecture document.

Use:

- `docs/architecture/` for durable architecture decisions and baselines;
- `docs/development/` for plans and implementation constraints;
- `docs/development/reports/` for chronological task execution evidence.

If a task changes a durable architectural decision, update or add the corresponding ADR in the same task.

## Completion rule

From P0 onward, the completion state is:

```text
Implementation complete + report missing = NOT COMPLETE
Implementation complete + verification pending = PARTIAL
Implementation + required verification + report complete = PASS
```
