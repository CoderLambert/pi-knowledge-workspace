# P3-T01S16 — Canonical Lineage Core Production Lint

Status: **PARTIAL — CI EVIDENCE PENDING**

Date: 2026-09-10

## Objective

Continue P3-T01 from the verified 162 baseline with one cohesive canonical-lineage production slice covering the immutable SourceVersion → ParsedArtifact → Evidence core.

Production files:

- `src/knowledge/storage/sourceDomain.ts`
- `src/knowledge/storage/evidence.ts`
- `src/knowledge/storage/parsedArtifact.ts`

Targeted inherited findings: **10** (5 + 2 + 3).

## Changes

- replace nullable/truthiness checks in Source lookups and dedupe paths with explicit nullish handling;
- replace database row type assertions with structural runtime validation;
- keep SourceVersion byte/hash identity validation fail-closed;
- replace Evidence locator JSON assertion with record validation;
- remove ParsedArtifact array/index non-null assertions through explicit bounds/regex-group checks;
- preserve parser/normalization fingerprints and immutable artifact hashing inputs.

## Preserved contracts

- SourceVersion capture remains content-addressed and deduplicated per Source;
- concurrent duplicate capture still resolves to the winning immutable SourceVersion;
- Source archive/rename semantics are unchanged;
- ParsedArtifact canonicalization remains UTF-8 validated and byte-preserving under the existing normalization fingerprint;
- parser and normalization fingerprints remain unchanged;
- Stable Evidence quote/hash values remain derived from authoritative canonical bytes;
- locator snapshots still must be JSON objects and fail closed otherwise;
- no captured-vs-published Source state is introduced here.

## Expected verification

```text
npm run typecheck → PASS
ESLint baseline: 162 → expected 152
```

CI determines the authoritative endpoint. Focused Source/ParsedArtifact/Evidence tests should retain existing behavior when reachable.

## Scope exclusions

No P3-A01 publication-state implementation, schema migration, ADR change, retrieval configuration, P2 evidence mutation, benchmark retuning, merge, rebase, force-push or unrelated cleanup.
