# P3-T01S16 — Canonical Lineage Core Production Lint Verification

Status: **PARTIAL — CI EVIDENCE PENDING**

## Automated verification

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/sourceDomain.test.ts src/knowledge/storage/parsedArtifact.test.ts src/knowledge/storage/evidence.test.ts
```

Expected task-owned delta:

- 5 inherited findings disappear from `sourceDomain.ts`;
- 2 inherited findings disappear from `evidence.ts`;
- 3 inherited findings disappear from `parsedArtifact.ts`;
- typecheck remains green;
- repository ESLint baseline should move from 162 to approximately 152; exact CI output is authoritative.

## Behavioral assertions

Verification must preserve:

- Source CRUD/capture behavior and content-addressed dedupe;
- duplicate concurrent capture resolves without creating a second canonical SourceVersion;
- SourceVersion blob hash/size identity remains authoritative;
- Markdown/TXT canonicalization, parser fingerprint and normalization fingerprint remain unchanged;
- document byte ranges/source maps remain valid;
- Stable Evidence exact quote/hash remain computed from canonical bytes;
- malformed DB rows or locator snapshots fail closed;
- no new publication-current pointer or P3-A01 semantics are introduced.

## Baseline classification

Any unrelated remaining lint findings are inherited P3-T01 baseline debt and must not be absorbed into S16.

## User verification

None. This production refactoring is repository/CI-verifiable and adds no user verification debt.
