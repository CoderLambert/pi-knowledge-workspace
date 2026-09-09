# P1-T14 — Evidence read API verification

Status: **OPEN / PARTIAL**

Branch: `feat/p1-evidence-read-api`  
Direct base: `feat/p1-search-api-baseline`

## Automated repository checks

```bash
npm test -- src/knowledge/storage/evidenceRead.test.ts src/knowledge/storage/evidence.test.ts src/knowledge/storage/utf8Range.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-search-api-baseline...HEAD
git diff --name-status origin/feat/p1-search-api-baseline...HEAD
```

### Expected PASS evidence

- P1-T14 focused tests pass (6 scenarios) and P1-T09/P1-T10 regression suites remain green.
- Static/build/package gates show no P1-T14-attributable failure.
- Full suite adds no P1-T14-attributable failure; inherited baseline failures remain separately classified.
- Direct-base diff is P1-T14-only.

## Exact Evidence acceptance

1. Load authoritative canonical bytes for a persisted ParsedArtifact.
2. Create/read Evidence containing ASCII, Chinese and emoji.
3. Confirm exact mode returns exactly `[startByte,endByte)` and quote/hash validation succeeds.
4. Tamper with canonical bytes or persisted quote/hash fixture and confirm read fails closed.

Expected: no Unicode normalization/fuzzy relocation and no latest-version fallback.

## Context acceptance

1. Request context around multi-byte text with `contextBytes` values that land inside UTF-8 code points.
2. Confirm output decodes as valid UTF-8 and contains the complete exact Evidence.
3. Set a small `maxReadBytes` and confirm output never exceeds it.
4. Place Evidence at artifact start/end and confirm expansion never crosses artifact boundaries.

Expected: valid UTF-8, exact Evidence retained, bounded output, same ParsedArtifact only.

## Section acceptance

Use Markdown containing nested headings and two top-level peer sections.

1. Put Evidence under a top-level section before a nested heading.
2. Read `mode: "section"`.
3. Confirm the returned `containerRange` starts at the owning heading and ends at the next peer/ancestor heading.
4. Confirm a nested child heading remains inside the section.
5. Put Evidence in document preamble and confirm its container ends at the first heading.
6. Make the section exceed `maxReadBytes`; confirm the actual read stays bounded around Evidence and `truncatedBefore`/`truncatedAfter` accurately report clipping.

Expected: section expansion never leaks into a sibling section or another ParsedArtifact.

## Durable ParsedArtifact store debt

P1-T14 currently depends on `ParsedArtifactReadStore` because P1-T08 has not yet committed a durable canonical-artifact materialization/read contract.

Required closure before real Evidence durability acceptance:

1. Provide a repository implementation that resolves `(Knowledge Workspace, ParsedArtifact id)` to the immutable historical canonical bytes, SourceVersion and document structure.
2. Restart `pi-knowledge` and repeat exact/context/section reads without fixture-injected bytes.
3. Update the underlying Source and create a newer SourceVersion; confirm historical Evidence still resolves against its original ParsedArtifact.
4. Reparse/rechunk latest content and confirm old Evidence read remains exact.

Expected PASS evidence: process restart and later-source updates do not alter historical Evidence reads.

## Deferred environment debt

The autonomous runtime has GitHub access but its container cannot resolve `github.com`; repository installation and executable gates cannot be run here. The durable artifact-store dependency is also not yet implemented.

Until both executable gates and real persisted-artifact Evidence reads are recorded, P1-T14 remains **PARTIAL**.
