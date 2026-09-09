# P1-T08 — ParsedArtifact canonicalization verification

Status: **OPEN verification debt**

Branch: `feat/p1-parsed-artifact-canonicalization`  
Direct base: `feat/p1-md-txt-import-job`

## Automated verification

Run from a clean checkout of this branch:

```bash
npm test -- src/knowledge/storage/parsedArtifact.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-md-txt-import-job...HEAD
git diff --name-status origin/feat/p1-md-txt-import-job...HEAD
```

Expected focused result: **7 tests PASS**.

Do not patch an inherited baseline failure merely to make the full suite green. If the previously classified `piSessionService.promptQueue` baseline still reproduces unchanged, record it as inherited and keep it out of this task scope.

## Canonicalization acceptance

1. Verify identical semantic UTF-8 content encoded as LF and as UTF-8-BOM + CRLF/CR produces identical `canonicalText` and `canonicalTextSha256`.
2. Verify Chinese, emoji and combining characters round-trip exactly except for the documented BOM/newline normalization.
3. Verify invalid UTF-8 is rejected; no replacement characters may silently enter a canonical artifact.
4. Verify Markdown headings, paragraphs, list items, fenced code blocks and pipe-table rows produce deterministic UTF-8 byte ranges.
5. Verify `.txt` content containing `#`, `-`, or table-like syntax remains paragraph structure rather than Markdown structure.
6. Verify duplicated text remains duplicated; canonicalization must not deduplicate or rewrite prose.
7. Verify repeated canonicalization for the same SourceVersion bytes produces the same artifact hash.
8. Verify another SourceVersion with identical bytes has the same canonical-text hash but a different artifact hash.

## Immutable-source acceptance

1. Store raw bytes through `ContentAddressedBlobStore.put()`.
2. Construct the matching `KnowledgeSourceVersion` and canonicalize via `ParsedArtifactCanonicalizer.fromSourceVersion()`.
3. Confirm the result is derived from the immutable blob even if the original Workspace file is subsequently edited or removed.
4. Confirm a mismatched `blobKey` / `contentSha256` fails closed before parsing.
5. Confirm a recorded byte length that differs from the verified blob length fails closed.
6. Tamper with the stored blob and confirm P1-T04 integrity verification prevents parsing.

## Expected PASS evidence

- focused 7/7 tests PASS;
- typecheck/lint/knip/build/pack gates PASS;
- no new P1-T08-attributable full-suite failure;
- direct-base diff contains only P1-T08 scope;
- immutable blob acceptance proves Workspace rereads are absent;
- normalization and UTF-8 byte-range behavior match the locked fingerprints.

Until this evidence is recorded, P1-T08 remains **PARTIAL**.

## Assumptions consumed by later tasks

P1-T09 and P1-T10 may proceed against these documented contracts:

- canonical text is valid UTF-8;
- canonical byte offsets address `canonicalBytes` exactly;
- BOM is absent and newlines are LF;
- `canonicalTextSha256` identifies canonical bytes;
- parser/normalization fingerprints describe behavior that would require artifact regeneration if changed.

If executable verification invalidates any invariant, dependent stacked tasks must be corrected rather than weakening evidence-addressing semantics.
