# P1-T09 — UTF-8 stable range library verification

Status: **OPEN / required for PASS**

Branch: `feat/p1-utf8-stable-range-library`  
Direct base: `feat/p1-parsed-artifact-canonicalization`  
PR: #19

## Automated verification

Run from a clean checkout of the branch with dependencies installed:

```bash
npm test -- src/knowledge/storage/utf8Range.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Expected focused result: all seven P1-T09 UTF-8 stable-range scenarios pass.

Do not patch the known inherited `src/server/sessions/piSessionService.promptQueue.test.ts` baseline failure inside this task merely to make the full suite green. If its signature is unchanged from the accepted baseline, classify it as inherited; investigate any new P1-T09-attributable failure.

## Contract verification

Confirm the following against authoritative canonical bytes:

1. ASCII `[0, 5)` over `alpha beta` extracts exactly `alpha`.
2. Chinese offsets are counted in UTF-8 bytes rather than JS characters; one CJK code point occupies its encoded byte span.
3. Emoji ranges accept complete code points and reject start/end offsets inside continuation bytes.
4. `e\u0301` and precomposed `é` remain byte-distinct; no NFC/NFD normalization occurs.
5. Two identical textual quotes at different byte ranges remain independently addressable.
6. `hashUtf8Range()` equals SHA-256 of the exact sliced bytes.
7. `verifyExactQuote()` returns true only when both exact quote bytes and the lowercase 64-hex SHA-256 match.
8. Negative/out-of-bounds/reversed/unsafe offsets, invalid boundaries and invalid authoritative UTF-8 fail closed.

## Dependency verification

P1-T09 relies on the P1-T08 contract that ParsedArtifact canonical text is valid deterministic UTF-8 bytes. Once P1-T08 is executable locally, feed at least one canonicalized Markdown artifact containing Chinese, emoji and combining characters into this range library and verify exact byte slicing/hash roundtrips.

This cross-task check does not replace P1-T08's own acceptance requirements.

## Direct-base scope check

```bash
git diff --check origin/feat/p1-parsed-artifact-canonicalization...HEAD
git diff --name-status origin/feat/p1-parsed-artifact-canonicalization...HEAD
git diff --stat origin/feat/p1-parsed-artifact-canonicalization...HEAD
```

Expected scope:

- `src/knowledge/storage/utf8Range.ts`
- `src/knowledge/storage/utf8Range.test.ts`
- P1-T09 report/verification records
- required development-plan / verification-debt / changelog bookkeeping only

There must be no P1-T10 Evidence persistence, chunker, FTS5, search, UI or runtime implementation.

## PASS evidence

P1-T09 can move from PARTIAL to PASS only when:

- focused tests pass;
- typecheck/lint/knip/build/package checks pass;
- full suite has no new task-attributable failure;
- P1-T08 canonical-byte integration roundtrip succeeds;
- direct-base diff is task-only;
- the evidence is recorded in the report, DEVELOPMENT-PLAN, CHANGELOG, verification-debt ledger and PR description.
