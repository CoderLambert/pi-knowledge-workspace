# P2-T02 — First Representative Corpus Report

## Status

**PARTIAL**

Branch: `data/p2-representative-corpus`  
Direct base: `experiment/p2-golden-dataset-schema` (P2-T01 / PR #33)

## Objective

Seed P2 with a small, reproducible corpus that is useful for failure analysis rather than a synthetic retrieval demo.

The first corpus deliberately covers all plan requirements with three fixed snapshots:

| Snapshot | Language | Technical shape | Version role |
| --- | --- | --- | --- |
| Vue 3 `ref()` API | Chinese | API + TypeScript code | current fixed commit |
| Node.js `fsPromises.cp` | English | API/options | v16.7.0 |
| Node.js `fsPromises.cp` | English | API/options | v22.3.0 |

## Real source material

### Vue Chinese documentation

- repository: `vuejs-translations/docs-zh-cn`;
- exact capture revision: `dda601fe33187dfd913641d58b6cefe829bf1a0d`;
- source file: `src/api/reactivity-core.md`;
- upstream license: CC BY 4.0 for repository content excluding images;
- committed corpus is a short condensed `ref()` excerpt with code, no images.

### Node.js documentation

- repository: `nodejs/node`;
- exact versions: `v16.7.0` and `v22.3.0`;
- source file: `doc/api/fs.md`;
- upstream license: Node.js MIT-style license;
- committed corpus contains only short condensed `fsPromises.cp` excerpts.

Full attribution is recorded in `eval/corpus/ATTRIBUTION.md`.

## Version conflict and missing-fact cases

The Node pair provides a real historical conflict:

```text
v16.7.0: Stability: 1 - Experimental
v22.3.0: change history says the API is no longer experimental
```

The later snapshot also contains options absent from the initial v16.7.0 surface, including `mode` and `verbatimSymlinks`.

Both snapshots intentionally contain no `preserveOwnership` option. P2-T03 can use that as a real no-answer query without fabricating a source that says “not documented”.

## Capture metadata

Every snapshot has a sibling `*.meta.json` `GoldenCorpusArtifact` record with:

- stable corpus id;
- repository-relative snapshot path;
- language/media type;
- source title/URI;
- capture timestamp;
- exact upstream tag/commit;
- stable eval SourceVersion/ParsedArtifact ids;
- parser and normalization fingerprints;
- SHA-256 of the committed snapshot bytes.

The ids are dataset-local immutable lineage identifiers; they do not claim to be production database ids.

## Integrity coverage

`src/knowledge/eval/representativeCorpus.test.ts`:

- loads every committed metadata record;
- runs the P2-T01 Golden Dataset validator;
- hashes actual snapshot bytes and requires exact metadata match;
- checks Chinese + English coverage;
- checks API/code material exists;
- checks the two Node source versions are distinct;
- checks the Experimental/no-longer-experimental conflict is present;
- checks the planned missing-fact candidate remains absent.

## Scope

P2-T02 adds corpus data, attribution and corpus-integrity coverage only. It does not add query annotations, labels, benchmark metrics or retrieval tuning.

## Verification state

No executable gate is claimed PASS in this automation environment. P2-T03 may annotate against the fixed corpus while T02 remains PARTIAL; any later corpus correction that changes bytes must create a new corpus version/hash rather than silently mutate labelled historical content.