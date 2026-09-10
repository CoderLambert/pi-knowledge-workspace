# P3-T01S9 — Source Evidence Viewer Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue inherited pre-P3 lint closure with one test-only Source/Evidence viewer slice after P3-T01S8 reduced the verified ESLint baseline to 219 findings.

## Changes

Only `src/knowledge/storage/sourceEvidenceViewer.test.ts` is behaviorally touched:

- make the fake database `exec`/`close` no-op methods explicit;
- replace the fixture's forbidden non-null assertion for the first Evidence quote byte with fail-fast narrowing;
- use optional chaining for the ParsedArtifact test store Workspace guard;
- preserve SourceVersion history, historical Evidence reopening, Workspace isolation and artifact ownership assertions.

No production Source/Evidence viewer implementation is changed.

## Expected verification

```text
npm run typecheck → PASS
ESLint 219 → 215
```

The focused `sourceEvidenceViewer.test.ts` scenarios must remain unchanged. Any remaining repository-wide lint findings are inherited baseline debt outside this slice.

## Scope exclusions

No production code, ADR, schema, retrieval configuration, P2 evaluation/evidence, benchmark, merge, rebase or force-push changes.
