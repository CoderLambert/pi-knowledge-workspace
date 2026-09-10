# P3-T01S13 — Backup / Restore Entry Production Lint

Status: **PASS**

Date: 2026-09-10

## Objective

Continue P3-T01 inherited baseline closure using the subsystem-scoped execution policy introduced at the verified 201 checkpoint.

This slice targets the backup/restore entry boundary without mixing the more sensitive `KnowledgeRestore` implementation into the same change.

## Scope

Production files changed:

- `src/knowledge/storage/backup.ts`
- `src/knowledge/service/backupCli.ts`
- `src/knowledge/service/restoreCli.ts`

Targeted inherited findings: **10**.

## Changes

- replace `artifactProvider!` with explicit provider narrowing before artifact materialization;
- replace SQLite row type assertions with fail-closed record validation;
- remove the Node error type assertion by narrowing `code` structurally;
- replace CLI argv non-null assertions with explicit bounds checks;
- replace backup-capability type assertions with a structural type guard;
- make required CLI string checks explicit for undefined/empty values.

No backup format, restore format, schema, canonical identity, retrieval behavior or CLI argument contract is intentionally changed.

## Verification evidence

GitHub CI run `34438125327` confirmed:

```text
npm run typecheck → PASS
ESLint 201 → 191
```

All ten task-owned findings are closed. The CI workflow remains red only because 191 inherited repository-wide ESLint findings remain and lint stops `npm run verify` before later knip/test/build steps.

P2 FTS Evidence run `34438125322` and P2 Lexical Evidence run `34438125323` both succeeded on the same head.

## Risk split

`src/knowledge/storage/restore.ts` still has a larger set of production lint findings. It is intentionally excluded from S13 because its manifest validation, historical Evidence verification and atomic restore behavior deserve an independently reviewable slice rather than being bundled only to maximize lint-count throughput.

## Scope exclusions

No ADR change, no P2 evidence/configuration mutation, no benchmark retuning, no unrelated cleanup, no merge, no rebase and no force-push.
