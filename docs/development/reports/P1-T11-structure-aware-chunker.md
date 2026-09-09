# P1-T11 — Structure-aware chunker

Status: **PARTIAL**

Branch: `feat/p1-structure-aware-chunker`  
Direct base: `feat/p1-stable-evidence-entity`  
PR: #21

## Scope

Implement deterministic structure-aware chunking for canonical Markdown/TXT ParsedArtifacts.

V1 structure comes from P1-T08 and recognizes headings, paragraphs, list items, code blocks and table rows. Chunking must preserve canonical UTF-8 byte addressing so later indexing/retrieval can create P1-T10 Evidence without fuzzy remapping.

## Implementation

Added `src/knowledge/storage/chunker.ts`.

Algorithm:

1. Validate canonical UTF-8 and structural byte ranges.
2. Treat headings as section boundaries.
3. Keep a heading-delimited section intact when it fits the experimental byte budget.
4. For an oversized section, split first at structural-node boundaries.
5. Split inside a node only when that individual node itself exceeds the budget.
6. When an oversized node must be split, choose only UTF-8 code-point boundaries; if the configured budget is smaller than one code point, advance to the next valid boundary so chunking always makes progress.
7. Materialize chunk text directly from the canonical byte range; never synthesize, normalize, prepend or rewrite text.

`DEFAULT_CHUNK_TARGET_BYTES = 2400` is explicitly an implementation heuristic, not a persisted retrieval contract. The development-plan estimate of roughly 400–800 tokens remains experimental; this task intentionally avoids introducing a tokenizer dependency before retrieval evaluation.

Each chunk records:

- ordinal;
- canonical `startByte` / `endByte`;
- exact canonical text;
- structural node kinds represented by the range.

## Locked invariants

1. Chunk ranges refer directly to P1-T08 canonical UTF-8 bytes.
2. Text is never synthesized or normalized by the chunker.
3. Heading-delimited sections are preserved whole when they fit the budget.
4. Oversized sections split at node boundaries before any node-internal split.
5. Only individually oversized nodes are split internally.
6. All boundaries are valid UTF-8 code-point boundaries.
7. Chunk ordinals are deterministic for identical artifact bytes/structure/options.
8. Empty canonical content yields no chunks; whitespace-only content remains recoverable without invented structure.
9. The byte budget is experimental and must not become an Evidence/retrieval identity contract.

## Tests

`src/knowledge/storage/chunker.test.ts` covers:

- preserving a small heading section;
- heading-delimited section boundaries;
- oversized section splitting at list-item/node boundaries;
- oversized code-block splitting on valid UTF-8 boundaries;
- progress when target bytes are smaller than a Chinese/emoji code point;
- whitespace-only TXT fallback without synthetic nodes;
- fail-closed malformed structural boundaries and invalid budget values.

## Deferred verification / dependency risk

P1-T11 consumes still-PARTIAL P1-T08 canonicalization and structure contracts. It deliberately depends only on `ParsedArtifactCanonical`; it does not read Workspace files, blobs, SQLite, models, or retrieval state.

The current automation environment has no runnable repository dependency tree and the branch has no known CI/status evidence. Focused tests and static/build/package/full-suite checks therefore remain OPEN verification debt and P1-T11 remains **PARTIAL**.

P1-T12 may consume stable chunk ranges/text for FTS5 indexing, but later retrieval quality work must evaluate whether the experimental 2400-byte default should change. Changing the chunking strategy must create a new IndexBuild rather than reinterpret existing Evidence ranges.

## Scope check

Direct-base comparison must contain only chunker implementation/tests and P1-T11 task records. No FTS5 table/index implementation, search API, source viewer, model runtime, embedding/vector work or unrelated baseline repair belongs in this PR.
