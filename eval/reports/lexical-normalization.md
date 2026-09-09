# P2-T05 — Chinese / code lexical normalization experiment

Status: **PASS**

## Decision

Freeze **`baseline`**. None of the three more-complex lexical profiles produced a material development-set quality improvement over the corrected expanded FTS baseline. `code-derived` tied baseline aggregate quality while increasing index/build/query cost; both CJK n-gram profiles reduced development MRR. No lexical normalization complexity is carried forward.

The historical corrected expanded 80-query baseline remains:

```text
Recall@10: 1.0
MRR: 0.928921568627451
all-required coverage: 1.0
```

For profile selection, only the fixed development split was used. Its baseline is 42 answerable queries with `37 Rank1 / 4 Rank2 / 1 Rank3 / 0 miss` and MRR `0.9365079365079365`.

## Execution evidence

GitHub Actions `P2 Lexical Evidence` run **34325709633** on head `9c3437fa98de3c306ba5a739925bada959631498` completed successfully after the task-attributable lint cleanup.

Runner/runtime:

```text
Ubuntu 24.04.5
Node 24.20.0
better-sqlite3 13.0.3
SQLite 3.53.4
FTS5: PASS
corpus chunks: 38 total / 35 challenge
Top-K: 10
```

The experiment used the corrected ancestry and real SQLite/FTS retrieval path. Original chunk text remained preserved; derived aliases were retrieval-only material.

Focused verification: **9 files PASS / 35 tests PASS**.

## Development results

All latency/RSS numbers below are GitHub-runner-specific measurements, not Omarchy target-machine claims.

| Profile | Recall@10 | MRR | Coverage | Rank distribution | median / p95 / max ms | Peak RSS | FTS bytes | Build ms |
| --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: |
| `baseline` | 1.0 | **0.9365079365079365** | 1.0 | 37 R1 / 4 R2 / 1 R3 / 0 miss | 0.774 / 1.318 / 2.833 | 83,435,520 | 49,152 | 10.342 |
| `code-derived` | 1.0 | **0.9365079365079365** | 1.0 | 38 R1 / 0 R2 / 4 R3 / 0 miss | 1.009 / 1.462 / 3.087 | 84,668,416 | 57,344 | 16.253 |
| `code-cjk-bigram` | 1.0 | 0.9134920634920635 | 1.0 | 36 R1 / 3 R2 / 2 R3 / 1 R4-10 / 0 miss | 1.132 / 1.641 / 2.582 | 85,188,608 | 77,824 | 17.073 |
| `code-cjk-bigram-trigram` | 1.0 | 0.9293650793650793 | 1.0 | 37 R1 / 3 R2 / 1 R3 / 1 R4-10 / 0 miss | 1.156 / 1.897 / 2.719 | 85,176,320 | 110,592 | 19.994 |

Category failure counts were empty for all profiles because Recall@10 and all-required Evidence coverage stayed at 1.0 with zero answerable misses.

Development-only non-Rank-1 diagnostics:

```text
baseline:
  dev-026 R2
  dev-028 R2
  dev-034 R2
  dev-040 R3
  dev-042 R2

code-derived:
  dev-023 R3
  dev-031 R3
  dev-040 R3
  dev-043 R3

code-cjk-bigram:
  dev-003 R2
  dev-005 R2
  dev-007 R2
  dev-012 R5
  dev-040 R3
  dev-043 R3

code-cjk-bigram-trigram:
  dev-003 R2
  dev-005 R2
  dev-007 R3
  dev-012 R5
  dev-020 R2
```

The development split also contained 8 no-answer queries; all 8 produced lexical hits. This reinforces that `retrieval hit != answerability`.

## Materiality and winner selection

The frozen development materiality thresholds were dataset-sized:

```text
Recall / coverage step: 1 / 42 = 0.023809523809523808
MRR step: one Rank2 → Rank1 equivalent = 0.011904761904761904
```

Comparison against baseline:

```text
code-derived:             ΔRecall 0, ΔMRR  0,                   ΔCoverage 0
code-cjk-bigram:          ΔRecall 0, ΔMRR -0.023015873015873,  ΔCoverage 0
code-cjk-bigram-trigram:  ΔRecall 0, ΔMRR -0.007142857142857,  ΔCoverage 0
```

Therefore the least-complex materially improving rule selects **`baseline`**. No query-specific hardcode or holdout-derived rule was introduced.

## One-shot holdout acceptance

Only after `baseline` was frozen from development evidence, the fixed holdout was executed once. Aggregate-only result:

```text
queries: 30
answerable: 26
query errors: 0
Recall@10: 1.0
MRR: 0.9166666666666666
all-required coverage: 1.0
rank aggregate: 22 R1 / 3 R2 / 1 R3 / 0 miss
```

No holdout per-query diagnostics were used for tuning or published here.

## Evidence integrity

Stable Evidence relevance remains SourceVersion + ParsedArtifact UTF-8 range overlap. Original text is preserved. Derived terms never become SourceVersion authority, ParsedArtifact canonical bytes, or Evidence identity.

Target-machine performance remains separate verification debt; GitHub-runner latency/RSS is sufficient for the P2-T05 quality-selection decision and is not presented as Omarchy performance.
