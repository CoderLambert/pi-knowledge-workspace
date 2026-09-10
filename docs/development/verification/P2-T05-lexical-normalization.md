# P2-T05 verification — Chinese / code lexical normalization experiment

Status: **PASS**

## 1. CI-first evidence source

Canonical execution: GitHub Actions `P2 Lexical Evidence` run **34325709633** on code head `9c3437fa98de3c306ba5a739925bada959631498`.

Environment:

```text
Ubuntu 24.04.5
Node 24.20.0
better-sqlite3 13.0.3
SQLite 3.53.4
FTS5 PASS
38 chunks total / 35 challenge
Top-K 10
```

## 2. Focused deterministic / corrected-ancestry tests

Result:

```text
9 files PASS
35 tests PASS
```

Coverage includes fixed corpus/annotation ancestry, SearchQuery/FTS behavior, P2-T04 evaluator semantics, lexical profile derivation, development-only comparison, and holdout rejection during tuning.

## 3. Four-profile development experiment

Real development-set results:

| Profile | Recall@10 | MRR | Coverage | Rank aggregate |
| --- | ---: | ---: | ---: | --- |
| baseline | 1.0 | 0.9365079365079365 | 1.0 | 37 R1 / 4 R2 / 1 R3 / 0 miss |
| code-derived | 1.0 | 0.9365079365079365 | 1.0 | 38 R1 / 0 R2 / 4 R3 / 0 miss |
| code-cjk-bigram | 1.0 | 0.9134920634920635 | 1.0 | 36 R1 / 3 R2 / 2 R3 / 1 R4-10 / 0 miss |
| code-cjk-bigram-trigram | 1.0 | 0.9293650793650793 | 1.0 | 37 R1 / 3 R2 / 1 R3 / 1 R4-10 / 0 miss |

Category failure counts were empty because all answerable development queries remained within Top-10 and all-required Evidence coverage stayed 1.0.

Baseline development non-Rank-1 IDs:

```text
dev-026 R2
dev-028 R2
dev-034 R2
dev-040 R3
dev-042 R2
```

Only development per-query diagnostics were used for profile selection.

## 4. Selection

Materiality thresholds were frozen from the development dataset size:

```text
Recall / coverage: 1 / 42 = 0.023809523809523808
MRR: one Rank2 → Rank1 equivalent = 0.011904761904761904
```

No more-complex profile cleared a material quality improvement over baseline. Winner: **`baseline`**.

This preserves the expanded baseline rather than introducing derived aliases or CJK n-gram complexity.

## 5. One-shot holdout

Holdout was run only after the winner was frozen. Aggregate-only acceptance:

```text
queries: 30
answerable: 26
errors: 0
Recall@10: 1.0
MRR: 0.9166666666666666
all-required coverage: 1.0
22 R1 / 3 R2 / 1 R3 / 0 miss
```

No holdout per-query tuning diagnostics were used or published.

## 6. Repository gate attribution

The evidence workflow intentionally ran Level-1 commands independently so inherited failures could not hide later gates.

Observed:

- `typecheck`: inherited failures only;
- `lint`: initial run exposed 3 task-attributable P2-T05 errors; after the minimal fix, follow-up output contained 278 inherited errors and **zero `lexicalNormalization*` errors**;
- `knip`: inherited findings only;
- `build`: inherited `viewerDispatch` type errors only;
- `pack:dry`: blocked by the same inherited build errors;
- focused suite: PASS;
- evidence benchmark: PASS.

The ordinary CI failure is therefore not treated as P2-T05 failure and no inherited baseline code was changed merely to obtain green.

## 7. Resource measurements

GitHub-runner-specific, not Omarchy target-machine evidence. Latest development run:

```text
baseline:              median 0.774 ms, p95 1.318 ms, max 2.833 ms, RSS 83,435,520 B, FTS 49,152 B, build 10.342 ms
code-derived:          median 1.009 ms, p95 1.462 ms, max 3.087 ms, RSS 84,668,416 B, FTS 57,344 B, build 16.253 ms
code-cjk-bigram:       median 1.132 ms, p95 1.641 ms, max 2.582 ms, RSS 85,188,608 B, FTS 77,824 B, build 17.073 ms
code-cjk-bigram-trigram: median 1.156 ms, p95 1.897 ms, max 2.719 ms, RSS 85,176,320 B, FTS 110,592 B, build 19.994 ms
```

Target-machine performance is separate debt and does not block this quality-selection acceptance.

## 8. Direct-base scope

PR #37 is stacked on support PR #50. Direct-base scope remains exactly the seven P2-T05 task-owned files: normalization code/tests, development evaluator/tests, eval report, task report, and verification guide. The support workflow/runner live in #50 rather than being mixed into #37.

No production FTS default, Dense/vector/sqlite-vec/RRF, P2-T09 generic runner, or P3 work is included.

## PASS condition

All P2-T05 acceptance conditions are satisfied. **PASS.**
