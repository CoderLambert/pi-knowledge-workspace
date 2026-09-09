# P2-T04 FTS baseline

Status: **PARTIAL — original-corpus result recorded; expanded-corpus result UNRUN**

This report separates two evidence states:

1. a valid real run over the original three-artifact / three-chunk corpus;
2. the decision-relevant rerun over the corrected P2-T03A challenge corpus, which remains OPEN.

A search hit counts as relevant only when its SourceVersion + ParsedArtifact identity matches a required Stable Evidence label and its UTF-8 byte range overlaps that label. Chunk identity is never ground truth.

## Original-corpus real result — 2026-09-09

Runtime:

```text
OS: Omarchy/Linux
Node: 26.7.0
better-sqlite3: 13.0.3
SQLite: 3.53.4
artifacts: 3
total chunks: 3
Top-K: 10
query errors: 0
```

Metrics:

```text
query count:                    80
scored answerable queries:      68
no-answer queries:              12
no-answer with any lexical hit: 12
Recall@10:                      1.0
MRR:                            0.9779411764705882
all-required-Evidence coverage: 1.0
category failure counts:        {}
latency median:                 0.273482 ms
latency p95:                    0.533295 ms
latency max:                    1.303755 ms
peak RSS bytes:                 94,654,464
FTS dbstat bytes:               20,480
```

The 20,480-byte FTS allocation is measured from SQLite `dbstat`. A previous zero-byte result from database file-size subtraction was invalid because SQLite may reuse already allocated pages.

## Original-corpus rank diagnostics

Answerable queries:

```text
rank 1: 65
rank 2: 3
rank 3+: 0
miss: 0
```

Development answerable queries:

```text
count: 42
rank 1: 41
rank 2: 1
miss: 0
```

`dev-026` is the only development query whose first required Evidence is at rank 2. Two holdout answerable queries also had rank-2 required Evidence; those observations are acceptance-only and must not be used for retrieval tuning.

All 12 no-answer queries produced at least one lexical candidate. This is a diagnostic showing that lexical-hit presence is not equivalent to answerability; it is not scored as no-answer accuracy by this evaluator.

## Interpretation limit

The original result is valid execution evidence but is **not sufficient for retrieval-strategy selection**.

The three original artifacts are smaller than the 2,400-byte chunk target and therefore become only three chunks. Because Top-K=10 exceeds the candidate count, Recall@10 and all-required coverage are structurally saturated.

Do not use the original `Recall@10 = 1.0` result to declare FTS-only the P2 winner.

## Expanded-corpus decision run

P2-T03A / PR #46 adds immutable development-side hard-negative artifacts with independent SourceVersion/ParsedArtifact identities and requires at least 30 challenge chunks through the real parser/chunker path. P1-T13 propagation / PR #47 provides the natural-language FTS query compiler while preserving later active-build lease semantics.

The corrected run must use:

```text
corpus: original 3 artifacts + all P2-T03A challenge artifacts
queries: unchanged 50 development + 30 holdout
labels: unchanged Stable Evidence labels
Top-K: 10
query boundary: PR #47 quoted literal OR compiler
index allocation: SQLite dbstat
```

Current expanded-corpus result:

```text
artifact count:                 UNRUN
total chunks:                   UNRUN
query errors:                   UNRUN
query count:                    UNRUN
scored answerable queries:      UNRUN
no-answer queries:              UNRUN
no-answer with any lexical hit: UNRUN
Recall@10:                      UNRUN
MRR:                            UNRUN
all-required-Evidence coverage: UNRUN
category failure counts:        UNRUN
latency median/p95/max:         UNRUN
peak RSS bytes:                 UNRUN
FTS dbstat bytes:               UNRUN
```

No expanded-corpus number may be inferred from source inspection or from the original three-chunk run.

## Publication rule

When the expanded run executes, publish:

- full aggregate metrics;
- every missed development query and representative top hits;
- development rank distribution;
- no-answer lexical-hit diagnostics;
- exact runtime/repository provenance;
- resource measurements.

Holdout results may be preserved for acceptance, but must not drive P2-T05 lexical-profile selection or later Dense/RRF tuning.
