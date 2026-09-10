# P3-T01S14 — Restore Production Lint Baseline

Status: **PARTIAL — CI PENDING**

Date: 2026-09-10

## Objective

Close the inherited lint findings in the production `KnowledgeRestore` implementation as a dedicated high-risk subsystem slice after S13 isolated the lower-risk backup/restore entry boundary.

Target file:

- `src/knowledge/storage/restore.ts`

Inherited findings targeted from the 201-checkpoint lint output: **15**.

## Changes

- replace verified blob/artifact Map non-null assertions with fail-closed lookup helpers;
- narrow optional artifact/evidence dependencies before invoking them;
- validate SQLite rows structurally instead of asserting their types;
- parse the untrusted backup manifest into a validated typed object rather than asserting `Partial<KnowledgeBackupManifest>` / `KnowledgeBackupManifest`;
- preserve explicit unsupported-format rejection;
- make closure/null checks and checksum syntax lint-safe without weakening validation;
- remove the Node error assertion through structural narrowing.

## Preserved contracts

This task must preserve:

- manifest checksum verification before restore publication;
- exact backup format/schema gating;
- SQLite integrity and closure validation;
- safe relative object paths;
- fail-closed artifact materialization and historical Evidence verification;
- content-addressed blob identity checks;
- temp-directory cleanup and atomic final rename;
- no silent fallback to incomplete SQLite-only success.

## Expected verification

S14 is stacked on S13. If S13 reaches its expected 191 baseline, S14 should reduce the repository baseline by the 15 task-owned findings to approximately **176** while keeping `npm run typecheck` green. The exact endpoint is determined by CI.

## Scope exclusions

No backup/restore format change, schema migration, ADR change, retrieval change, P2 evidence mutation, benchmark retuning, merge, rebase, force-push or unrelated cleanup.
