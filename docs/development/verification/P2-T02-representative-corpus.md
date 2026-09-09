# P2-T02 — Representative Corpus Verification

## Status

**PARTIAL** until executable gates and corpus-integrity checks are recorded.

Branch: `data/p2-representative-corpus`  
Direct base: `experiment/p2-golden-dataset-schema` (P2-T01 / PR #33)

## Focused corpus integrity

```bash
npm test -- src/knowledge/eval/representativeCorpus.test.ts --reporter=verbose
```

Expected:

- all three metadata records pass the P2-T01 validator;
- each committed snapshot SHA-256 equals `canonicalTextSha256`;
- Chinese and English material are both present;
- Vue snapshot contains real TypeScript/API material;
- Node v16.7.0 and v22.3.0 are distinct SourceVersions;
- v16.7.0 contains `Stability: 1 - Experimental`;
- v22.3.0 contains `no longer experimental`;
- neither Node snapshot fabricates a `preserveOwnership` fact.

## Upstream provenance review

Confirm the recorded source versions still identify immutable upstream content:

```text
Vue: vuejs-translations/docs-zh-cn @ dda601fe33187dfd913641d58b6cefe829bf1a0d
Node: nodejs/node @ v16.7.0
Node: nodejs/node @ v22.3.0
```

Review `eval/corpus/ATTRIBUTION.md` and require the committed snapshots to remain short adaptations of the attributed files, not bulk vendored documentation.

## Static/build/package gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Fix only P2-T02-attributable failures. Do not use corpus work to patch inherited PI WEB/P0/P1 baselines.

## Full suite

```bash
npm test
```

Record exact pass/fail/skip counts and compare failures to the verification ledger.

## Direct-base scope

```bash
git diff --check origin/experiment/p2-golden-dataset-schema...HEAD
git diff --name-status origin/experiment/p2-golden-dataset-schema...HEAD
```

Expected scope:

- three fixed corpus snapshots;
- three GoldenCorpusArtifact metadata records;
- third-party attribution;
- corpus-integrity test;
- P2-T02 report/verification and safe bookkeeping.

No P2-T03 query/label annotations or retrieval benchmark implementation belongs on this branch.

## Immutability rule

Once P2-T03 labels reference one of these ParsedArtifact ids, changing snapshot bytes in place is forbidden. A corrected or updated upstream capture must receive a new corpus id, SourceVersion id, ParsedArtifact id and canonical hash.

## PASS criteria

P2-T02 becomes PASS when focused integrity, task-attributable static/build/package/full-suite and direct-base scope checks pass. P2-T03 may proceed while those execution rows remain OPEN because the corpus identity/provenance contract is explicit and machine-checkable.