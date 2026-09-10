# P3-T01S15 — Evidence Read / Viewer Production Lint Verification

Status: **PARTIAL — CI PENDING**

## Automated verification

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/sourceEvidenceViewer.test.ts src/knowledge/storage/sourceEvidenceViewer.utf8.test.ts src/knowledge/storage/evidenceRead.test.ts
```

Expected task-owned delta:

- 8 inherited findings disappear from `sourceEvidenceViewer.ts`;
- 6 inherited findings disappear from `evidenceRead.ts`;
- typecheck remains green;
- repository ESLint baseline should move from 176 to approximately 162; exact CI output is authoritative.

## Behavioral assertions

Verification must preserve:

- Knowledge Workspace isolation for Source, ParsedArtifact and Evidence reads;
- reopening historical Evidence from the exact historical ParsedArtifact;
- rejection of mismatched artifact-store lineage;
- exact/context/section range semantics and configured byte caps;
- valid UTF-8 window boundaries;
- malformed persisted DB rows/locator snapshots fail closed;
- unsupported runtime Evidence read modes remain explicitly rejected.

## Baseline classification

Any unrelated remaining lint findings are inherited P3-T01 baseline debt and must not be pulled into S15.

## User verification

None. This production refactoring is repository/CI-verifiable and adds no user verification debt.
