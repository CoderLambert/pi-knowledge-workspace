# P1-T05 — Source + SourceVersion domain verification

Status: **OPEN / PARTIAL**

## Automated verification

```bash
npm test -- src/knowledge/storage/sourceDomain.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-content-addressed-blob-store...HEAD
git diff --name-status origin/feat/p1-content-addressed-blob-store...HEAD
```

Expected focused result: five Source/SourceVersion domain tests pass. Do not patch inherited baseline failures in this task.

## Contract acceptance

Verify with a real file-backed P1 SQLite database plus P1-T04 blob store:

1. create a Knowledge Workspace identity and Source;
2. capture bytes `A`; confirm one `source_versions` row and one blob hash;
3. rename Source metadata; confirm no new SourceVersion;
4. capture byte-identical `A`; confirm the same SourceVersion id is returned and row count is unchanged;
5. capture changed bytes `B`; confirm exactly one new SourceVersion with a different hash;
6. archive the Source; confirm default list hides it while historical SourceVersions remain readable;
7. issue concurrent identical captures and confirm `UNIQUE(source_id, content_sha256)` converges on one SourceVersion;
8. confirm `blob_key` is a content address, not an absolute mutable filesystem path;
9. confirm Sources from Workspace A never appear in Workspace B list results.

## Expected PASS evidence

- focused tests: 5/5 PASS;
- typecheck/lint/knip/build/pack gates PASS;
- full suite has no new P1-T05-attributable failures;
- real SQLite captures demonstrate byte-change-only version creation and concurrency dedupe;
- P1-T04 blob integrity remains valid for captured versions;
- direct-base diff contains only P1-T05 implementation/tests/docs/plan/changelog/debt records.

P1-T05 remains PARTIAL until this evidence and its P1-T02/P1-T04 dependency evidence are recorded. P1-T06 may proceed against the documented Source capture contract under the autonomous policy.
