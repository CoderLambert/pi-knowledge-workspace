# P3-T01S15 — Evidence Read / Viewer Production Lint

Status: **PASS**

Date: 2026-09-10

## Objective

Continue P3-T01 from the verified 176 checkpoint with one cohesive read-only historical Evidence subsystem slice.

Production files:

- `src/knowledge/storage/sourceEvidenceViewer.ts`
- `src/knowledge/storage/evidenceRead.ts`

Targeted inherited findings from the 176 baseline: **14** (8 + 6).

## Changes

- replace database row type assertions with structural record validation;
- validate persisted locator snapshots as records rather than asserting them;
- replace UTF-8 byte non-null assertions with explicit bounds/fail-closed checks;
- normalize Evidence read mode through an `unknown` runtime guard, preserving rejection of unsupported runtime input while removing a statically exhaustive branch warning;
- validate heading level with explicit numeric narrowing;
- stringify numeric range limits explicitly in diagnostic text.

## Preserved contracts

- every Source/Evidence lookup remains scoped by Knowledge Workspace;
- historical Evidence continues to resolve through its exact ParsedArtifact, never a Source latest-version shortcut;
- artifact store authority/lineage mismatch still fails closed;
- locator snapshot must remain a JSON object;
- UTF-8 read windows still stop at valid byte boundaries;
- section/context/exact modes preserve their existing range semantics and limits.

## Verification evidence

GitHub CI run `34439146038` confirmed:

```text
npm run typecheck → PASS
ESLint 176 → 162
```

All 14 S15-owned findings are closed. The workflow remains red only because 162 inherited repository-wide ESLint findings remain and lint stops `npm run verify` before later knip/test/build steps.

P2 FTS Evidence run `34439146034` and P2 Lexical Evidence run `34439146054` both succeeded on the same head. Frozen P2 evidence/configuration was not modified.

## Scope exclusions

No Source publication mutation, Evidence identity change, schema, ADR, retrieval configuration, P2 evidence, benchmark, merge, rebase, force-push or unrelated cleanup.
