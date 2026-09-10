# P3-T01S14 — Restore Production Lint Baseline

Status: **PASS**

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

This task preserves:

- manifest checksum verification before restore publication;
- exact backup format/schema gating;
- SQLite integrity and closure validation;
- safe relative object paths;
- fail-closed artifact materialization and historical Evidence verification;
- content-addressed blob identity checks;
- temp-directory cleanup and atomic final rename;
- no silent fallback to incomplete SQLite-only success.

## Verification evidence

Initial GitHub CI run `34438211673` confirmed:

```text
npm run typecheck → PASS
ESLint 191 → 178
```

That removed 13 of the 15 task-owned findings. Two closure-comparison lint findings remained and were corrected without changing the `undefined => mismatch` behavior.

A first follow-up run `34438491863` still reported 178 because TypeScript control-flow narrowing made two later optional chains unnecessary. The closure condition was then expressed with one optional-chain guard followed by directly narrowed properties.

Final GitHub CI run `34438673519` confirmed:

```text
npm run typecheck → PASS
ESLint 191 → 176
```

All 15 S14-owned findings are closed. The workflow remains red only because 176 inherited repository-wide ESLint findings remain and lint stops `npm run verify` before later knip/test/build steps.

P2 FTS Evidence run `34438673523` and P2 Lexical Evidence run `34438673512` both succeeded on the final head. No frozen evidence was changed.

## Scope exclusions

No backup/restore format change, schema migration, ADR change, retrieval change, P2 evidence mutation, benchmark retuning, merge, rebase, force-push or unrelated cleanup.
