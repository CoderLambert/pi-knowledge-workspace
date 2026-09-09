# P3-T01S5 — Verification Guide

Status: **PARTIAL until CI evidence exists**

## Automated acceptance

Run:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/durableJobs.test.ts src/knowledge/storage/searchQuery.test.ts src/knowledge/storage/sourceDomain.test.ts src/knowledge/storage/fts5Index.test.ts
```

Expected:

- typecheck remains green;
- the nine S5-targeted lint findings disappear;
- no new lint finding appears in the four touched test files;
- focused storage tests preserve existing behavior.

Global CI may remain red on inherited findings outside this slice; classify those against the S4 baseline rather than expanding S5 scope.

## Manual/user verification

None required. This is repository test-harness/static debt and should be verified through CI.
