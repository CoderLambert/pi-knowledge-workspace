# P3-T01S22 Verification — Storage Primitives Lint

Status: **PARTIAL**

## Automated verification

Required repository evidence:

```bash
npm run typecheck
npm run lint
```

Task PASS requires:

- typecheck remains PASS;
- repository lint moves from 65 to 53 unless CI exposes a directly task-owned interaction corrected within S22;
- `utf8Range.ts`, `blobStore.ts`, `workspaceFileReader.ts` and `workspaceIdentity.ts` disappear from authoritative ESLint output;
- relevant focused tests pass when reachable;
- unrelated remaining failures stay classified as inherited baseline.

If path-triggered, P2 FTS Evidence and P2 Lexical Evidence must remain PASS because these primitives are consumed by canonical Evidence/storage paths.

## Semantic regression checks

Preserve the following contracts:

1. UTF-8 ranges remain safe-integer, half-open byte ranges over valid canonical UTF-8.
2. Non-boundary offsets still fail; exact quote/hash verification stays byte-exact with no normalization.
3. Blob identity remains lowercase SHA-256 and invalid hashes fail before path resolution.
4. Blob publication remains atomic/no-overwrite; concurrent identical writes deduplicate; tampering fails closed.
5. Workspace file capture still rejects path escape, sensitive files, oversized files and files replaced/changed during capture.
6. Workspace identity remains installation + canonical-realpath based and external binding updates stay transactional.
7. Unexpected SQLite row shapes fail closed rather than being trusted through type assertions.

## Frozen boundaries

Do not modify:

- ADR-029;
- database schema/migrations;
- P2 corpus/query/label/evidence files;
- retrieval profile/compiler/Top-K;
- benchmark thresholds;
- Source publication or P3 Slice A semantics.

## User verification debt

None expected. These changes are repository-verifiable and do not require browser, Fleet, multi-instance, hardware, system-service or manual semantic acceptance for the S22 PASS decision.
