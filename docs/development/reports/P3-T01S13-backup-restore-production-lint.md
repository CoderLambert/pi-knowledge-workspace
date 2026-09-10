# P3-T01S13 — Backup / Restore Production Lint Baseline

Status: **PARTIAL — CI PENDING**

Date: 2026-09-10

## Objective

Continue P3-T01 from the verified 201-error checkpoint using the subsystem-scoped execution policy introduced after S12. This slice owns the production backup/restore boundary and its CLI adapters.

Target files:

- `src/knowledge/storage/backup.ts`
- `src/knowledge/storage/restore.ts`
- `src/knowledge/service/backupCli.ts`
- `src/knowledge/service/restoreCli.ts`

The current inherited baseline contains approximately 25 findings across these four files.

## Scope

Semantics-preserving lint cleanup only:

- replace non-null assertions with explicit narrowing or prevalidated local references;
- replace lint-forbidden type assertions with structural runtime narrowing/helpers;
- make nullable-string conditions explicit;
- remove static-condition lint noise without weakening runtime validation;
- preserve manifest/hash verification, SQLite closure checks, destination safety, artifact/evidence fail-closed behavior, and atomic temp-directory publication.

No backup format, schema, canonical identity, retrieval behavior, P2 evidence, benchmark, ADR, or product feature change is intended.

## Verification

CI must prove:

```text
npm run typecheck → PASS
ESLint baseline: 201 → expected ~176
```

The exact endpoint is authoritative only after CI. Focused backup/restore tests must remain behaviorally unchanged when reachable.

## Git / architecture boundaries

One task / one branch / one Draft PR. No merge, rebase, force-push, destructive ref movement, P2 evidence mutation, or benchmark retuning.
