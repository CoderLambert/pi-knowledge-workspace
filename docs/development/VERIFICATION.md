# Feature Verification Guide Standard

Every user-visible or behavior-changing development task must include a reproducible verification guide in the repository.

The guide exists for a human user/developer to answer one question:

> How do I prove this feature works as intended on a real checkout?

A feature is not considered complete until both its implementation report and its verification guide exist.

## Required workflow

```text
Implement feature
→ automated verification
→ development report
→ human verification guide
→ update indexes / PR
→ task may be marked complete
```

## Location

Feature verification guides live under:

```text
docs/development/verification/
```

Naming convention:

```text
<Px-Tyy>-<short-title>.md
```

Analysis-only tasks that do not change executable behavior do not require a user verification guide. They still require a development report.

## Required guide sections

Each guide must include, when applicable:

1. **What this verifies** — exact feature/behavior under test.
2. **Prerequisites** — runtime/version/configuration requirements.
3. **Checkout / setup** — exact branch or release and dependency install steps.
4. **Automated verification** — copyable test/typecheck/lint commands.
5. **Start commands** — exact services/processes to run.
6. **Manual verification steps** — numbered UI/CLI steps a human can follow.
7. **Expected results** — observable output for every important step.
8. **Negative / failure checks** — how to verify rejection/error behavior where practical.
9. **Pass criteria** — explicit PASS checklist.
10. **Fail criteria / troubleshooting** — what counts as failure and first diagnostics to inspect.
11. **Cleanup / reset** — how to stop processes/remove test data if needed.
12. **Known verification limits** — anything this guide does not prove.

## Writing rules

Verification guides must be executable, not descriptive.

Prefer exact commands and numbered steps. Do not write vague instructions such as `Verify that the feature works correctly`.

## Evidence discipline

A verification guide describes how a human can validate a feature. It does not imply the validation has already been run.

The development report remains the source of truth for what was actually executed during development.

```text
Verification guide exists ≠ verification already passed
```

When a human verification run is performed, record its result in the corresponding development report or a later validation report.

## Completion rule

For behavior-changing tasks:

```text
Implementation + report, but no verification guide = NOT COMPLETE
Implementation + guide, required verification pending = PARTIAL
Implementation + required verification + report + guide = PASS
```
