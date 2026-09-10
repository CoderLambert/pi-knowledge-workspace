# P3-T01S13 — Backup / Restore Entry Production Lint Verification

Status: **PARTIAL — CI evidence pending**

## Automated verification

Run on the task branch:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/backup.test.ts src/knowledge/storage/restore.test.ts
```

Expected static endpoint:

```text
typecheck: PASS
ESLint inherited baseline: 201 → 191
```

Confirm the ten targeted findings are gone from:

- `src/knowledge/storage/backup.ts` — 4 findings;
- `src/knowledge/service/backupCli.ts` — 4 findings;
- `src/knowledge/service/restoreCli.ts` — 2 findings.

## Behavioral assertions

The focused tests must continue to prove the existing backup/restore contracts, including:

- backup uses an online SQLite snapshot rather than mutating the live database;
- SourceVersion blob identity and byte length are checked;
- incomplete ParsedArtifact backup fails closed without a durable provider;
- backup destination publication remains atomic/no-overwrite;
- restore checksum and manifest closure are verified before target publication;
- restore continues to fail closed when durable artifact materialization or historical Evidence verification is required but unavailable.

## User verification

None. This is repository-owned static/refactoring debt and should be verified autonomously by CI. Do not add user verification debt.
