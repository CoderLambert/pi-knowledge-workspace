# P3-T01S4 — Storage Harness Lint Verification

Status: **PARTIAL — CI evidence pending**

## Automated acceptance

1. Run `npm run typecheck`; it must remain green.
2. Run repository ESLint through `npm run lint` or `npm run verify`.
3. Confirm these five inherited findings disappear:
   - `indexBuildPublication.test.ts`: `no-empty-function` on `close`;
   - `indexBuildRetention.test.ts`: `no-empty-function` on `close`;
   - `sourceEvidenceViewer.utf8.test.ts`: `no-empty-function` on `exec` and `close`;
   - `workspaceFileReader.test.ts`: unused `WorkspaceFileReadError` import.
4. Confirm no new lint/typecheck finding appears in the four changed tests.
5. Compare the remaining global lint count with the parent verified baseline of 247; expected result is 242 if no unrelated baseline changed.

## Behavioral regression checks

When `npm run verify` can reach tests, or through focused CI if available, verify the existing storage tests continue to pass. The changes are fixture-only no-op/import cleanup and must not alter publication, retention, UTF-8 preview or Workspace file capture behavior.

## Scope check

Direct-base diff must contain only:

```text
src/knowledge/storage/indexBuildPublication.test.ts
src/knowledge/storage/indexBuildRetention.test.ts
src/knowledge/storage/sourceEvidenceViewer.utf8.test.ts
src/knowledge/storage/workspaceFileReader.test.ts
docs/development/reports/P3-T01S4-storage-harness-lint.md
docs/development/verification/P3-T01S4-storage-harness-lint.md
```

No production, ADR, schema, retrieval, P2 evidence or benchmark files may change.

## User verification

None required. Do not add this task to `VERIFICATION-DEBT.md`.
