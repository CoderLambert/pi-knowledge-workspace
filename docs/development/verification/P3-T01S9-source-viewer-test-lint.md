# P3-T01S9 — Source Evidence Viewer Test Lint Verification

Status: **PARTIAL — CI evidence pending**

## Automated verification

Run on the task branch:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/sourceEvidenceViewer.test.ts
```

Expected static result:

```text
typecheck: PASS
ESLint inherited baseline: 219 → 215
```

Confirm the four prior findings in `src/knowledge/storage/sourceEvidenceViewer.test.ts` are gone:

1. empty fake database `exec` method;
2. empty fake database `close` method;
3. forbidden non-null assertion for the Evidence quote fixture;
4. optional-chain style finding in the ParsedArtifact read-store guard.

## Behavioral assertions

The focused test must continue to prove:

- Source listing exposes latest-version metadata without collapsing history;
- Source detail preserves SourceVersion/ParsedArtifact lineage;
- historical Evidence opens against its historical ParsedArtifact rather than latest Source content;
- cross-Workspace Source/artifact access fails closed;
- Evidence cannot be opened against an artifact it does not belong to.

## User verification

None. This is repository test-harness/static debt and should be verified in CI. Do not add user verification debt for this task.
