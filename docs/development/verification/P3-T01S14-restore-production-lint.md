# P3-T01S14 — Restore Production Lint Verification

Status: **PASS**

## Automated verification

Final GitHub CI run `34438673519` confirmed:

```text
typecheck: PASS
ESLint inherited baseline: 191 → 176
```

All 15 inherited findings previously reported in `src/knowledge/storage/restore.ts` are gone and no new finding appears in that file.

Earlier runs were used to close two task-owned rule interactions without expanding scope:

```text
34438211673: 191 → 178
34438491863: 178 remained, with two closure-narrowing findings
34438673519: 191 → 176 final endpoint
```

P2 FTS Evidence run `34438673523` and P2 Lexical Evidence run `34438673512` both passed on the final head.

## Reproduction

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/restore.test.ts src/knowledge/storage/backup.test.ts
```

## Behavioral assertions

The existing focused tests continue to define these preserved contracts:

- unsupported/tampered manifests fail before target publication;
- schema and SQLite integrity mismatch fail closed;
- blob and ParsedArtifact manifest closure matches the SQLite snapshot exactly;
- unsafe paths cannot escape the backup directory;
- missing artifact sink or historical Evidence verifier cannot report successful restore when required;
- restored blob identity is checked against expected content hash/size;
- failed restore removes its temp directory and never publishes the target;
- successful restore publishes only after all required materialization and Evidence verification steps complete.

The repository CI remains globally red because 176 inherited ESLint findings remain; that failure is outside S14.

## Baseline classification

S14 is stacked on S13. S13 independently passed at 201 → 191. Unrelated remaining ESLint findings are inherited P3-T01 baseline debt.

## User verification

None. This task is repository-owned refactoring/static debt and is CI-verified; no new user verification debt is recorded.
