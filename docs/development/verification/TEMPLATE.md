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

## Start the feature

```bash
# exact start commands
```

Open the exact URL/CLI entry.

## Manual verification

Use numbered steps. After each case, state the expected observable result.

## Negative / failure verification

Document practical failure cases and the expected safe behavior.

## PASS checklist

- [ ] Focused tests pass.
- [ ] Required repository regression passes.
- [ ] Happy path matches expected behavior.
- [ ] Scope/state behavior is correct.
- [ ] Required negative cases fail safely.
- [ ] Existing supported behavior shows no regression.

## FAIL criteria

List concrete conditions that make this feature fail acceptance.

## Troubleshooting

Provide first diagnostic commands/log locations.

## Cleanup / reset

```bash
# exact cleanup commands if needed
```

## Verification limits

State what this guide does not prove.

## Recording the result

After executing this guide, update the corresponding report under `docs/development/reports/` with environment, commands, PASS/FAIL result, and relevant failure evidence.
