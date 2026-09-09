# P2-T05 — Chinese / code lexical normalization experiment

Status: **PASS**

## Objective

Evaluate the smallest deterministic lexical changes that could improve the corrected expanded FTS baseline for Chinese, code symbols and version/error-code queries without introducing a tokenizer framework or changing Stable Evidence semantics.

## Stack / ancestry

PR #37 is stacked on support PR #50 (`chore/p2-t05-lexical-evidence-harness`). The corrected ancestry includes the P2 challenge corpus (#46), P1-T13 natural-language FTS query compilation propagation (#47), corrected P2-T04 baseline (#36), expanded evidence harness (#48), and CI-first / branch hygiene policy (#49).

The direct-base diff remains P2-T05-only.

## Implemented scope

Exactly four fixed profiles were evaluated:

1. `baseline`;
2. `code-derived`;
3. `code-cjk-bigram`;
4. `code-cjk-bigram-trigram`.

The original chunk text is always preserved. Derived aliases are retrieval-only material and do not change SourceVersion, ParsedArtifact, Stable Evidence identity, or production FTS defaults.

## Real GitHub Actions evidence

`P2 Lexical Evidence` run **34325709633** on code head `9c3437fa98de3c306ba5a739925bada959631498`:

```text
Ubuntu 24.04.5
Node 24.20.0
better-sqlite3 13.0.3
SQLite 3.53.4
FTS5 PASS
38 chunks total / 35 challenge
Top-K 10
focused: 9 files PASS / 35 tests PASS
```

The real development-set quality results were:

| Profile | Recall@10 | MRR | Coverage | Ranks |
| --- | ---: | ---: | ---: | --- |
| baseline | 1.0 | 0.9365079365079365 | 1.0 | 37 R1 / 4 R2 / 1 R3 / 0 miss |
| code-derived | 1.0 | 0.9365079365079365 | 1.0 | 38 R1 / 0 R2 / 4 R3 / 0 miss |
| code-cjk-bigram | 1.0 | 0.9134920634920635 | 1.0 | 36 R1 / 3 R2 / 2 R3 / 1 R4-10 / 0 miss |
| code-cjk-bigram-trigram | 1.0 | 0.9293650793650793 | 1.0 | 37 R1 / 3 R2 / 1 R3 / 1 R4-10 / 0 miss |

Expanded all-query baseline context remains MRR `0.928921568627451`; profile selection used development evidence only.

Baseline development non-Rank-1 targets were reproduced exactly:

```text
dev-026 R2
dev-028 R2
dev-034 R2
dev-040 R3
dev-042 R2
```

## Decision

Freeze **`baseline`**.

`code-derived` produced no aggregate quality gain while increasing FTS allocation from 49,152 to 57,344 bytes and increasing build/query cost. The two CJK profiles reduced development MRR and used 77,824 and 110,592 FTS bytes respectively. The least-complex materially improving rule therefore retains baseline rather than carrying lexical complexity forward.

No query-specific special cases were added.

## Holdout discipline

Holdout was not used to select the profile. After baseline was frozen, one aggregate-only holdout run produced:

```text
30 queries / 26 answerable
query errors: 0
Recall@10: 1.0
MRR: 0.9166666666666666
all-required coverage: 1.0
22 R1 / 3 R2 / 1 R3 / 0 miss
```

No holdout per-query tuning diagnostics were used or published.

## Gate attribution

The first independent lint diagnostic exposed 3 P2-T05-attributable lint failures. They were fixed without changing experiment semantics. The follow-up run removed all `lexicalNormalization*` files from the lint failure list.

Remaining repository gate failures are inherited from the base ancestry:

- typecheck/build/pack: existing `viewerDispatch`, `chunker`, `evidence`, and `sourceEvidenceViewer` errors;
- lint: 278 inherited errors after the 3 P2-T05 errors were removed;
- knip: inherited `better-sqlite3`, viewer dispatch export, and configuration findings.

Per CI-first policy these inherited failures were not modified for a green check.

## Resource evidence

Runner-specific only; not an Omarchy claim. Latest development run:

```text
baseline median/p95/max: 0.774 / 1.318 / 2.833 ms
baseline peak RSS: 83,435,520 bytes
baseline FTS allocation: 49,152 bytes
baseline build: 10.342 ms
```

Target-machine performance remains independent verification debt and does not block the lexical quality freeze.

## Acceptance

**PASS.** The four fixed profiles were executed on the real corrected retrieval path, development-only selection retained baseline, holdout was run only after freeze, task-attributable lint failures were repaired, direct-base scope remains task-only, and inherited baseline failures were not modified.

P2-T06 may now consume the frozen lexical decision. No P3 work is authorized; ADR-029 remains blocked on later P2 evidence.
