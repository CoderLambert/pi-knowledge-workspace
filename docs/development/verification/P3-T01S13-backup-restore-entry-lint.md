# P3-T01S13 — Backup / Restore Entry Production Lint Verification

Status: **PASS**

## Automated verification

GitHub CI run `34438125327` confirmed:

```text
typecheck: PASS
ESLint inherited baseline: 201 → 191
```

All ten targeted findings are gone from:

- `src/knowledge/storage/backup.ts` — 4 findings;
- `src/knowledge/service/backupCli.ts` — 4 findings;
- `src/knowledge/service/restoreCli.ts` — 2 findings.

P2 FTS Evidence run `34438125322` and P2 Lexical Evidence run `34438125323` also passed on the same head. No P2 evidence was modified.

## Reproduction

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/backup.test.ts src/knowledge/storage/restore.test.ts
```

## Behavioral assertions

The focused tests must continue to prove the existing backup/restore contracts, including:

- backup uses an online SQLite snapshot rather than mutating the live database;
- SourceVersion blob identity and byte length are checked;
- incomplete ParsedArtifact backup fails closed without a durable provider;
- backup destination publication remains atomic/no-overwrite;
- restore checksum and manifest closure are verified before target publication;
- restore continues to fail closed when durable artifact materialization or historical Evidence verification is required but unavailable.

The repository CI remains globally red because 191 inherited ESLint findings remain; that failure is outside S13.

## User verification

None. This is repository-owned static/refactoring debt and is verified autonomously by CI. No user verification debt is added.
