# P1-T11 — Structure-aware chunker verification

Status: **OPEN / required for PASS**

Branch: `feat/p1-structure-aware-chunker`  
Direct base: `feat/p1-stable-evidence-entity`  
PR: #21

## Automated verification

```bash
npm test -- src/knowledge/storage/chunker.test.ts src/knowledge/storage/parsedArtifact.test.ts src/knowledge/storage/utf8Range.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Do not patch inherited unrelated baseline failures inside this task.

## Contract checks

1. Small heading-delimited sections remain intact.
2. A new heading starts a new section/chunk boundary.
3. Oversized sections split at document-node boundaries before splitting any node internally.
4. Only an individually oversized heading/paragraph/list/code/table node may be split internally.
5. Every chunk range is a valid canonical UTF-8 byte range and chunk text equals an exact slice of P1-T08 canonical bytes.
6. Chinese, emoji and combining-character content never splits inside a UTF-8 code point.
7. If `targetBytes` is smaller than a code point, chunking still makes progress by emitting that whole code point; this is the only case where a chunk may exceed the configured byte target.
8. Whitespace-only content remains recoverable without invented structural metadata.
9. Malformed/overlapping/out-of-bounds/non-boundary ParsedArtifact structure fails closed.
10. Repeating the same artifact/options produces identical ordinals/ranges/text/node kinds.

## Retrieval-quality note

`DEFAULT_CHUNK_TARGET_BYTES = 2400` is an experimental implementation heuristic. Before release-quality retrieval decisions, P2 evaluation must measure lexical/hybrid retrieval quality and may change chunking parameters. Such changes require a new IndexBuild and must never reinterpret already persisted Evidence ranges.

## Direct-base scope check

```bash
git diff --check origin/feat/p1-stable-evidence-entity...HEAD
git diff --name-status origin/feat/p1-stable-evidence-entity...HEAD
git diff --stat origin/feat/p1-stable-evidence-entity...HEAD
```

Expected scope: chunker implementation/tests, task report/verification, and required bookkeeping only. No P1-T12 FTS5/index schema, search API, UI, embedding/model runtime or unrelated baseline changes.

## PASS evidence

P1-T11 can move from PARTIAL to PASS only after focused/static/build/package gates pass, the full suite has no new task-attributable failure, canonical ParsedArtifact integration demonstrates exact byte-slice chunks, the direct-base diff is task-only, and evidence is written back to task records/plan/changelog/debt/PR.
