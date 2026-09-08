# P1-T04 — Content-addressed blob store verification

Status: **OPEN / PARTIAL**

## Automated verification

From the P1-T04 branch:

```bash
npm test -- src/knowledge/storage/blobStore.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-knowledge-workspace-identity...HEAD
git diff --name-status origin/feat/p1-knowledge-workspace-identity...HEAD
```

Expected focused result: six blob-store tests pass. The full suite must introduce no new task-attributable failures; do not patch the known inherited `piSessionService.promptQueue` baseline inside this task.

## Filesystem acceptance

Run a small Node/script harness against a temporary data root and verify:

1. storing bytes creates exactly `blobs/sha256/<lowercase sha256>`;
2. the stored bytes match the original byte-for-byte;
3. storing the same bytes repeatedly returns the same hash and leaves one final object;
4. concurrent identical writes converge on the same object without truncation or corruption;
5. manually modifying the final object causes `read()` and `verify()` to fail with `BlobIntegrityError`;
6. invalid hashes such as `../escape`, uppercase hex, non-hex, or wrong-length strings are rejected before path access;
7. stale `.pi-knowledge-blob-tmp-*` files are removed by cleanup while recent temp files and unrelated files are preserved.

## Expected PASS evidence

- focused tests: 6/6 PASS;
- typecheck/lint/knip/build/pack gates PASS;
- full suite has no new P1-T04-attributable failure;
- direct-base diff contains only P1-T04 implementation/tests/docs/plan/changelog/debt records;
- raw-byte roundtrip, dedupe, concurrent publication, tamper detection and stale-temp cleanup all behave as documented.

Until this evidence is recorded, P1-T04 remains PARTIAL. P1-T05 may proceed against the documented blob-store contract under the autonomous execution policy.
