# P3-T01S17 — Index / Search Publication Production Lint

Status: **PARTIAL — CI EVIDENCE PENDING**

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

## Expected verification

```text
npm run typecheck → PASS
ESLint baseline: 152 → expected 126
```

CI determines the authoritative endpoint. Focused index/search/publication/retention tests should retain existing behavior when reachable.

## Scope exclusions

No retrieval algorithm/profile change, no Top-K retuning, no schema migration, no ADR change, no P2 evidence mutation, no benchmark retuning, no P3-A03 production redesign, no merge, rebase, force-push or unrelated cleanup.
