# Deferred Verification Debt

This ledger tracks acceptance checks that autonomous development cannot execute because they require the user's local environment or another unavailable capability.

The authoritative execution policy is `docs/development/AUTONOMOUS-EXECUTION.md`.

## Rules

- Missing local/manual evidence keeps the originating task `PARTIAL` when that evidence is required for PASS.
- Verification debt does not by itself stop later implementation.
- Later tasks must document assumptions when they consume an unverified contract.
- Each task remains isolated in its own branch/PR.
- A phase/release gate cannot be declared PASS while required debt for that gate remains unresolved.
- When evidence is later supplied, update this ledger, the task report, plan/changelog status, and PR description.

## Open debt

No open verification debt is recorded at the time this ledger is introduced.

P0-T03 is already fully accepted and remains PASS.

Future autonomous tasks must append entries using the template below instead of waiting for user availability.

## Entry template

```markdown
### <TASK-ID> — <short verification name>

- **Task status:** PARTIAL
- **Branch:** `<branch>`
- **PR:** #<number>
- **Debt status:** OPEN
- **Why deferred:** <capability unavailable to automation>
- **Required verification:**
  1. <exact step>
  2. <exact step>
- **Expected PASS evidence:** <observable result/log/UI state>
- **Assumptions used for continued development:** <documented contract or assumption>
- **Dependent tasks:** <task ids or none>
- **Resolution:** pending user verification
```

## Resolved debt

Move completed entries here with the date, supplied evidence, and resulting task-status change.