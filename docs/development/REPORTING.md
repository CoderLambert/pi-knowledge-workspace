# Development Reporting Standard

Reporting follows the Product Slice First hierarchy. Permanent repository documentation is created when it provides durable review or maintenance value—not for every internal Agent task.

## Level 1 — Agent Work Unit

An Agent Work Unit returns a short handoff:

```text
TASK
STATUS
FILES_CHANGED
IMPLEMENTED
TESTS
RISKS
HANDOFF
```

This is enough by default. A work unit does not normally require its own remote branch, PR, report file, verification guide, changelog entry, report index entry or development-plan update.

The handoff must distinguish code written from checks actually executed and must identify unresolved integration or correctness risk. Keep it in the orchestration/PR workflow unless future maintainers need it as durable repository documentation.

## Level 2 — Product Slice

The Product Slice is the default branch, Draft PR, CI and review unit. Its PR description must record:

```text
Goal
Important implementation
Architecture/correctness invariants
Automated verification
Known limitations
```

It should also identify its direct base, required follow-up or external verification debt, and whether another Product Slice depends on it.

Create a standalone report under `docs/development/reports/` only when the slice produces evidence, rationale or operational knowledge with clear long-term value—for example a durable architecture/correctness analysis, benchmark result, migration rehearsal, incident finding or complex acceptance record. Do not create a report merely to mirror the PR description.

## Level 3 — Product Milestone

At a Product Milestone, formally record:

- a development report with the milestone result and evidence;
- the `DEVELOPMENT-PLAN.md` status/next-step update;
- a `CHANGELOG.md` entry;
- verification status and unresolved debt.

Typical milestones include:

```text
P3-T01 Exit
Reliable Knowledge
Product Preview
Slice A PASS
Quiz Preview
P3 PASS
```

A milestone is not PASS until its required evidence exists. Missing mandatory evidence is reported as `PARTIAL` or `BLOCKED`, not hidden by documentation status.

## Changelog policy

`CHANGELOG.md` is a concise product-development history, not an Agent activity ledger. Record only:

- Product Slice completion;
- Product Milestones;
- important architecture decisions;
- important blockers;
- meaningful user-visible capabilities.

Do not record individual Agent Work Units, frequent commits, routine wiring, test fixture work or inherited-debt cleanup merely because it occurred.

## Evidence rules

Reports and PR descriptions must distinguish:

- implemented behavior;
- static review;
- tests written;
- tests actually executed;
- CI state;
- manual verification;
- assumptions and deferred validation;
- Product Slice regressions versus inherited failures.

Never report a check as passing unless it ran successfully. A verification guide describes how to test a slice or user journey; its existence is not proof that the verification ran.

```text
Verification guide exists != verification passed
```

## Documentation locations

- `docs/architecture/`: durable architecture decisions and baselines.
- `docs/development/`: roadmap, standards, verification debt and concise changelog.
- `docs/development/reports/`: selected Product Slice or required milestone evidence with long-term value.
- `docs/development/verification/`: Product Slice or user-journey verification guides.

If work changes a durable architecture decision, update or add the relevant ADR. Process changes do not silently redefine ADR-029.

## Completion rules

```text
Agent Work Unit + accurate handoff = ready for integration

Product Slice + required implementation/verification
+ complete PR description = reviewable

Product Milestone + required evidence
+ development report + plan + changelog + verification/debt status = eligible for PASS
```

An independent report or verification guide may be required by the nature of the Product Slice, but neither is a universal per-work-unit Definition of Done.
