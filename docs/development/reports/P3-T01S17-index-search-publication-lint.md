# P3-T01S17 — Index / Search Publication Production Lint

Status: **PASS**

Date: 2026-09-10

## Objective

Continue P3-T01 from the verified 152 checkpoint with one cohesive retrieval/index-publication subsystem slice.

Production files:

- `src/knowledge/storage/fts5Index.ts`
- `src/knowledge/storage/searchQuery.ts`
- `src/knowledge/storage/indexBuildPublication.ts`
- `src/knowledge/storage/indexBuildRetention.ts`

Targeted inherited findings: **26** (8 + 3 + 5 + 10).

## Changes

- replace truthiness/type/non-null assertions around SQLite rows with explicit structural validation;
- make optional SourceVersion filters and active-build lookups nullish-explicit;
- stringify numeric template values explicitly without changing stable handle/chunk identity inputs;
- replace array index non-null assertions with bounds/fail-closed checks;
- preserve IndexBuild publication compare-and-swap semantics;
- preserve active-build leases, durable/expiring pins and GC re-checks;
- keep search result metadata hydration scoped to the leased IndexBuild and Knowledge Workspace.

## Preserved contracts

- V1 retrieval remains SQLite FTS5 / `unicode61` / lexical baseline / quoted-literal-or;
- default Top-K and maximum limit remain unchanged;
- allowed SourceVersion filters retain the same meaning;
- chunk IDs remain deterministic from the same semantic fields;
- candidate IndexBuild must be validated before publication;
- stale generation/base-active-build publication still fails closed;
- only the published active IndexBuild may be leased for search;
- retained builds with active/durable pins remain protected from GC;
- GC still re-checks active/pin state at deletion time;
- retrieval index remains a projection, not canonical identity.

## Automated verification

The first S17 code head exposed a task-owned compatibility regression in P2 FTS run `34440515211`: the missing-search-metadata path still failed closed and released its lease, but a generic structural validator changed the established error message. This was corrected within `searchQuery.ts` only.

A second follow-up restored that error contract and made P2 FTS pass, but CI run `34440755118` exposed 11 task-owned `no-unsafe-assignment` findings caused by inline `Object.fromEntries` inference; the measured endpoint was 137 rather than the intended 126. This was corrected with an `unknown -> Record<string, unknown>` type guard, again without changing runtime search semantics.

Final code head `d80a2ea9c9e79e7f8c844f791192c22bac04d5a9` was verified by CI run `34440910038`:

```text
npm run typecheck → PASS
ESLint baseline: 152 → 126
```

All 26 S17-owned inherited findings are closed and no new finding remains in the four touched production files. The repository verify workflow remains red only because 126 unrelated inherited ESLint findings remain, so later knip/test/build stages are not reached there.

P2 FTS Evidence run `34440909994` and P2 Lexical Evidence run `34440910007` both succeeded on the final code head. The earlier FTS failure was therefore resolved as a task-owned API-error-contract regression, not by changing frozen P2 evidence or retrieval configuration.

## Scope exclusions

No retrieval algorithm/profile change, no Top-K retuning, no schema migration, no ADR change, no P2 evidence mutation, no benchmark retuning, no P3-A03 production redesign, no merge, rebase, force-push or unrelated cleanup.
