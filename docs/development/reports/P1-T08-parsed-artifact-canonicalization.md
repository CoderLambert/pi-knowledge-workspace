# P1-T08 — ParsedArtifact canonicalization

Status: **PARTIAL**

Branch: `feat/p1-parsed-artifact-canonicalization`  
Direct base: `feat/p1-md-txt-import-job`  
PR: #18

## Scope

Implement deterministic Markdown/TXT canonicalization from immutable `SourceVersion` bytes.

The implementation deliberately does **not** reopen a Workspace file. `ParsedArtifactCanonicalizer.fromSourceVersion()` accepts a durable `KnowledgeSourceVersion`, requires `blob_key === content_sha256`, reads through the P1-T04 content-addressed blob store, verifies the recorded byte length, and only then canonicalizes.

## Implementation

Added `src/knowledge/storage/parsedArtifact.ts` with:

- fatal UTF-8 validation; invalid byte sequences are rejected instead of replacement-decoded;
- optional UTF-8 BOM removal;
- CRLF and lone CR normalization to LF while preserving all other UTF-8 bytes exactly;
- canonical UTF-8 bytes/text;
- source-byte → canonical-byte mapping segments;
- deterministic Markdown/TXT structural nodes with UTF-8 byte offsets;
- explicit parser and normalization fingerprints;
- canonical text SHA-256;
- deterministic artifact hash binding SourceVersion identity, fingerprints, structure, source map and canonical-text hash.

Markdown V1 structure recognizes:

- headings;
- paragraphs;
- list items;
- fenced code blocks;
- pipe-table rows.

TXT remains paragraph-only so Markdown-like characters in `.txt` are not reinterpreted as structure.

## Locked invariants

1. Parsing consumes immutable SourceVersion/blob bytes, never the mutable Workspace path.
2. UTF-8 canonical byte offsets are the addressing basis for later P1-T09/P1-T10 evidence work.
3. Newline/BOM normalization is deterministic and fingerprinted.
4. Parser behavior is fingerprinted separately from normalization behavior.
5. Invalid UTF-8 fails closed.
6. Canonical text identity is independent of SourceVersion id, while artifact identity is bound to SourceVersion id and parser/normalization semantics.

## Tests added

`src/knowledge/storage/parsedArtifact.test.ts` contains seven focused scenarios covering:

- LF vs BOM+CRLF/CR normalization;
- Chinese, emoji, combining characters, duplicated text and fenced code;
- headings, paragraphs, lists and tables;
- TXT non-Markdown behavior;
- invalid UTF-8 rejection;
- deterministic artifact identity;
- immutable SourceVersion/blob consumption and identity validation.

## Deferred verification / dependency risk

This automation environment can write/review GitHub but does not expose a runnable checkout/dependency tree, and the branch currently has no known GitHub Actions evidence. P1-T08 therefore remains **PARTIAL** until the verification guide is executed.

P1-T08 consumes the still-PARTIAL P1-T04 blob-store contract and P1-T05 SourceVersion contract. The dependency is isolated behind `ContentAddressedBlobStore.read()` and the `KnowledgeSourceVersion` value object. Later P1-T09/P1-T10 work may rely on canonical UTF-8 byte offsets, but must not treat P1-T08 as PASS until executable evidence is supplied.

## Scope check

Direct-base comparison must remain limited to P1-T08 implementation/tests and task records. No P1-T09 range-library, Evidence persistence, chunking, indexing, search API, UI or model work belongs in this PR.
