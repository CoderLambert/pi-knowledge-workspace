# P2-T03A verification — Development retrieval challenge expansion

Status: **OPEN / PARTIAL**

## 1. Focused integrity and production chunking test

Run from a checkout of `data/p2-retrieval-challenge-expansion`:

```bash
npm ci
npm test -- src/knowledge/eval/retrievalChallengeCorpus.test.ts
```

PASS evidence must show:

- original and challenge corpus metadata validate through Golden Dataset schema v1;
- raw bytes hash to the recorded canonical SHA-256;
- SourceVersion and ParsedArtifact identities are unique;
- development Evidence exact quotes are absent from the challenge corpus;
- target `fsPromises.cp` / `ref()` passages are absent;
- hard-negative lexical overlap remains present;
- production `canonicalizeParsedArtifact -> chunkParsedArtifact` yields at least 30 challenge chunks total and at least 10 per challenge artifact.

If the inherited P2 stack still lacks the late P1-T02 `better-sqlite3` lockfile propagation, that does not affect this focused parser/chunker test; do not modify unrelated dependency ancestry merely to make this task green.

## 2. Existing Golden Dataset regression

```bash
npm test -- \
  src/knowledge/eval/goldenDataset.test.ts \
  src/knowledge/eval/representativeCorpus.test.ts \
  src/knowledge/eval/queryAnnotations.test.ts \
  src/knowledge/eval/retrievalChallengeCorpus.test.ts
```

The original 50/30 query split, labels, SourceVersion lineage and exact byte-range Evidence must remain unchanged.

## 3. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Classify inherited baseline failures. Fix only failures attributable to P2-T03A.

## 4. Direct-base scope

```bash
git diff --check origin/data/p2-query-annotation...HEAD
git diff --name-status origin/data/p2-query-annotation...HEAD
```

Expected scope:

- three challenge Markdown artifacts;
- three challenge metadata records;
- attribution update;
- one challenge integrity/chunk-pressure test;
- P2-T03A task report and verification guide.

No existing query, Evidence label, original snapshot, retrieval implementation, normalization profile, Dense/vector/RRF code or P3 scope belongs in this task.

## 5. Downstream benchmark acceptance

After this task is verified, P2-T04 must be restacked on P2-T03A and its real FTS benchmark rerun with:

- the original three immutable artifacts;
- all P2-T03A challenge artifacts;
- unchanged development/holdout query and Evidence labels;
- Top-K=10;
- the P1-T13 natural-language FTS query compiler;
- later P1-T18/P1-T19 active-build lease semantics preserved;
- dbstat-based FTS allocation measurement.

P2-T05 lexical tuning may inspect development results only. Holdout remains one-shot acceptance after a configuration is frozen.

## PASS condition

P2-T03A becomes PASS only when the focused production parser/chunker test and task-attributable repository gates are verified and direct-base scope is clean. It does not itself select a retrieval strategy.
