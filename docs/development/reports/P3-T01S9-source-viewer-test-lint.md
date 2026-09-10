# P3-T01S9 — Source Evidence Viewer Test Lint Baseline

Status: **PASS**

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

## Verification evidence

GitHub CI run `34434199519` confirmed:

```text
npm run typecheck → PASS
ESLint 219 → 215
```

All four task-owned lint findings are closed. The CI workflow still concludes failure because the remaining 215 repository-wide ESLint findings are inherited P3-T01 baseline debt outside this slice; lint stops the workflow before later `knip`/test/build steps. P2 FTS Evidence run `34434199488` and P2 Lexical Evidence run `34434199733` both completed successfully on the same head, without evidence/configuration mutation or retuning.

The focused behavioral scenarios in this test file are unchanged by the lint-only edits.

## Scope exclusions

No production code, ADR, schema, retrieval configuration, P2 evaluation/evidence, benchmark, merge, rebase or force-push changes.
