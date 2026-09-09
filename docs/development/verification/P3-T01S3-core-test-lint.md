# P3-T01S3 — Core Storage Test Lint Verification

Status: **PARTIAL — CI evidence pending**

## Automated verification

Run through repository CI:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/chunker.test.ts src/knowledge/storage/evidence.test.ts
```

Expected:

- typecheck remains green;
- `chunker.test.ts` no longer reports the two `no-non-null-assertion` findings;
- `evidence.test.ts` no longer reports the two `no-confusing-void-expression` findings or the `consistent-type-assertions` finding;
- focused tests preserve the existing contract behavior.

Global ESLint may remain red due to inherited findings outside this two-test-file scope. Compare the post-slice count with the verified 252-error parent baseline and classify only new/touched-file findings as task regressions.

## User verification

None. This is deterministic repository test-harness cleanup and requires no browser, Fleet, hardware or local-system acceptance.
