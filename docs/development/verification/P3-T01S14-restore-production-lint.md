# P3-T01S14 — Restore Production Lint Verification

Status: **PARTIAL — CI PENDING**

## Automated verification

Run on the task branch:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/restore.test.ts src/knowledge/storage/backup.test.ts
```

Expected task-owned delta:

- all 15 inherited findings previously reported in `src/knowledge/storage/restore.ts` disappear;
- no new finding appears in the touched production file;
- typecheck remains green;
- after S13's expected 201 → 191 reduction, S14 should move the inherited repository baseline to roughly 176. CI determines the authoritative exact count.

## Behavioral assertions

Focused tests must continue to prove:

- unsupported/tampered manifests fail before target publication;
- schema and SQLite integrity mismatch fail closed;
- blob and ParsedArtifact manifest closure matches the SQLite snapshot exactly;
- unsafe paths cannot escape the backup directory;
- missing artifact sink or historical Evidence verifier cannot report successful restore when required;
- restored blob identity is checked against expected content hash/size;
- failed restore removes its temp directory and never publishes the target;
- successful restore publishes only after all required materialization and Evidence verification steps complete.

## Baseline classification

S14 is stacked on S13. Any S13-owned failure must be classified against #80 rather than absorbed into S14. Unrelated remaining ESLint findings remain inherited P3-T01 baseline debt.

## User verification

None. This task is repository-owned refactoring/static debt and is CI-verifiable; no new user verification debt should be recorded.
