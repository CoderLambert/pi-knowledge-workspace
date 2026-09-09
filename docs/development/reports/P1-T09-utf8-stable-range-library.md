# P1-T09 — UTF-8 stable range library

Status: **PARTIAL**

Branch: `feat/p1-utf8-stable-range-library`  
Direct base: `feat/p1-parsed-artifact-canonicalization`  
PR: #19

## Scope

Implement the stable Evidence addressing primitive over authoritative canonical UTF-8 bytes using half-open byte ranges `[startByte, endByte)`.

This task deliberately does not persist Evidence, choose locators, chunk content, index content, or expose retrieval APIs. Those belong to later P1 tasks.

## Implementation

Added `src/knowledge/storage/utf8Range.ts` with:

- `Utf8ByteRange` as the explicit byte-offset value shape;
- `assertValidUtf8Range()` for safe-integer, bounds, range-order and UTF-8 code-point-boundary validation;
- fatal validation of the authoritative canonical byte sequence before accepting any range;
- `sliceUtf8Range()` for byte-exact half-open slicing;
- `extractExactQuote()` using fatal UTF-8 decoding;
- `hashUtf8Range()` using SHA-256 of the exact addressed bytes;
- `verifyExactQuote()` that verifies both stored UTF-8 quote bytes and lowercase SHA-256 against authoritative bytes without fuzzy matching or Unicode normalization.

The implementation operates on `Uint8Array` rather than JavaScript string indexes. This prevents UTF-16 code-unit indexing from corrupting Evidence addressing for Chinese, emoji, combining characters, or other multibyte UTF-8 text.

## Locked invariants

1. Evidence addressing uses canonical UTF-8 byte offsets, never JavaScript string indexes.
2. Ranges are half-open: `[startByte, endByte)`.
3. Both offsets must be UTF-8 code-point boundaries in a valid authoritative UTF-8 byte sequence.
4. Quote extraction is exact and performs no Unicode normalization or fuzzy matching.
5. Quote hash is SHA-256 of the exact authoritative bytes addressed by the range.
6. Duplicate textual quotes are disambiguated by byte range; identical text may legitimately have the same quote hash at different ranges.
7. Invalid UTF-8, invalid bounds, unsafe offsets, and mid-code-point offsets fail closed.

## Tests added

`src/knowledge/storage/utf8Range.test.ts` contains seven focused scenarios covering:

- ASCII half-open ranges;
- Chinese multibyte addressing;
- emoji and invalid mid-code-point boundaries;
- composed vs decomposed combining-character forms without normalization;
- duplicated quote text at distinct ranges;
- exact quote/hash verification;
- invalid offsets, invalid boundaries and invalid authoritative UTF-8.

## Deferred verification / dependency risk

This automation environment can inspect and mutate GitHub but does not expose a runnable repository checkout/dependency tree, and no CI evidence is currently available for this branch. P1-T09 therefore remains **PARTIAL** until the verification guide is executed.

P1-T09 consumes P1-T08's still-PARTIAL canonical UTF-8 byte contract. The dependency is deliberately narrow: this library accepts only authoritative `Uint8Array` bytes and has no knowledge of Workspace files, SourceVersion storage, parsing, SQLite or retrieval. P1-T10 may build server-authoritative Evidence creation on this primitive, but must not treat P1-T08 or P1-T09 as PASS until their executable verification debt is resolved.

## Scope check

Direct-base comparison against `feat/p1-parsed-artifact-canonicalization` must contain only this byte-range implementation/tests and P1-T09 task records. No Evidence persistence, locator semantics, chunking, FTS5, search API, source-viewer UI, model runtime or unrelated baseline fixes belong in this PR.
