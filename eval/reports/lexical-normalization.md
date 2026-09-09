# P2-T05 — Chinese / code lexical normalization experiment

Status: **UNRUN / PARTIAL**

This report is intentionally committed before executing the real retrieval experiment. Numeric retrieval, latency, memory and index-size values must come from the current `better-sqlite3`/FTS5 + SearchQuery path over the fixed P2 Golden Dataset. Do not infer or fabricate values from unit fixtures.

## Question

Can a small amount of deterministic lexical normalization materially improve the current FTS baseline for Chinese text, code symbols and version/error-code queries without adding a tokenizer framework or changing Stable Evidence semantics?

## Fixed candidate matrix

| Profile | Code-derived terms | CJK bigrams | CJK trigrams | Recall@10 | MRR | all-required coverage | p95 latency | index bytes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `baseline` | no | no | no | UNRUN | UNRUN | UNRUN | UNRUN | UNRUN |
| `code-derived` | yes | no | no | UNRUN | UNRUN | UNRUN | UNRUN | UNRUN |
| `code-cjk-bigram` | yes | yes | no | UNRUN | UNRUN | UNRUN | UNRUN | UNRUN |
| `code-cjk-bigram-trigram` | yes | yes | yes | UNRUN | UNRUN | UNRUN | UNRUN | UNRUN |

The matrix is closed for P2-T05. Adding more tokenizers/segmenters requires evidence that these smallest candidates are insufficient; this task must not become a plugin platform.

## Normalization rules under test

All candidates preserve the original text and append deterministic derived terms only.

`code-derived` adds:

- camelCase/PascalCase components and a joined lowercase alias;
- dotted/slash/hash/kebab/snake-style identifier components and a joined lowercase alias;
- stable dotted-version aliases such as `v22x3x0` / `22x3x0`;
- the same identifier splitting naturally covers uppercase error-code shapes such as `ERR_INVALID_ARG_TYPE`.

CJK candidates add overlapping Han-character 2-grams and, for the final profile, 3-grams. No dictionary/ML segmentation dependency is introduced in this task.

## Tuning discipline

1. Build/index/query every profile using the same corpus, chunking, Workspace/SourceVersion scope, Top-K=10 and evaluation labels.
2. Use **development queries only** to decide whether a candidate is worth carrying forward.
3. Publish development failures by category, not only aggregate score.
4. Do not inspect holdout metrics while choosing the normalization profile.
5. After the profile is frozen, run the holdout once and publish it separately.
6. A candidate is not automatically preferred for a tiny Recall/MRR gain if latency, memory or index-size cost is disproportionate.

## Selection rule

No winner is selected yet.

Prefer the least complex profile that produces a material development-set improvement in the failure categories it targets (`chinese`, `chinese-english-mixed`, `code-symbol`, `version-error-code`) without a material regression in overall Recall@10/MRR or unacceptable latency/index-size growth.

If code-derived terms help but CJK n-grams do not, keep `code-derived`. If bigrams provide most Chinese benefit, do not carry trigrams. If none materially improve the baseline, retain the P1 FTS baseline unchanged and record that result.

## Evidence integrity

Relevance remains defined by Stable Evidence SourceVersion + ParsedArtifact UTF-8 range overlap. Normalized terms are retrieval-only derived material and must never become Evidence identity, canonical ParsedArtifact bytes or SourceVersion authority.
