# <Task ID> — <Feature Name> Verification Guide

## What this verifies

Describe the exact user-visible/runtime behavior this guide proves.

## Prerequisites

- Runtime/tool versions.
- Required services/configuration.
- Required test data/workspace.

## Checkout and setup

```bash
# exact commands
```

## Automated verification

### Focused tests

```bash
# exact task-specific commands
```

### Repository regression

```bash
# full required verification commands
```

Expected result:

```text
# concise observable success criteria
```

## Start the feature

```bash
# exact start commands
```

Open:

```text
# exact URL / CLI entry
```

## Manual verification

### Case 1 — <happy path>

1. ...
2. ...
3. ...

Expected:

- ...

### Case 2 — <scope / state transition>

1. ...

Expected:

- ...

## Negative / failure verification

### Case — <failure>

1. ...

Expected:

- explicit error behavior;
- no unsafe fallback;
- no silent empty state.

## PASS checklist

- [ ] Focused automated tests pass.
- [ ] Required repository regression commands pass.
- [ ] Happy path matches expected behavior.
- [ ] Scope/state behavior is correct.
- [ ] Required negative cases fail safely.
- [ ] Existing supported behavior shows no regression.

## FAIL criteria

Treat the feature as failed if any of the following occurs:

- ...

## Troubleshooting

### Symptom: ...

Check:

```bash
# diagnostic commands
```

## Cleanup / reset

```bash
# exact cleanup commands if needed
```

## Verification limits

This guide does not prove:

- ...

## Recording the result

After executing this guide, update the corresponding file under:

```text
docs/development/reports/
```

Record:

- environment;
- commands executed;
- PASS/FAIL result;
- failures or deviations;
- relevant logs/screenshots if useful.
