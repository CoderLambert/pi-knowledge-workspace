# P2-T06 — Dense retrieval adapter spike

Status: **UNRUN / PARTIAL**

## Purpose

Determine whether one or two serious multilingual embedding profiles can retrieve the fixed P2 Stable Evidence labels well enough to justify carrying dense retrieval forward.

This task does not select a vector database and does not add a provider/model framework.

## Adapter contract

Each evaluated profile must record explicitly:

```text
profile id
model id
model version/revision
dimensions
preprocessing id
query prefix
document prefix
whitespace normalization
```

The adapter must return one finite, non-zero vector per input with exactly the declared dimension.

## Candidate limit

Maximum profiles for the initial spike: **2**.

| Profile | Model | Version/revision | Dimensions | Preprocessing | Recall@10 | MRR | p95 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | UNSET | UNSET | UNSET | UNSET | UNRUN | UNRUN | UNRUN | candidate to be fixed before execution |
| B | UNSET | UNSET | UNSET | UNSET | UNRUN | UNRUN | UNRUN | optional second serious multilingual profile |

Do not add a third profile inside P2-T06. If both candidates are inadequate, record the failure and make a new explicit experiment decision rather than expanding this spike indefinitely.

## Evaluation index

Before P2-T07 decides sqlite-vec deployment, P2-T06 uses a brute-force in-memory cosine index only for evaluation. It preserves:

- chunk SourceVersion / ParsedArtifact / UTF-8 locator metadata;
- explicit SourceVersion allowlist filtering **before ranking and Top-K**;
- deterministic score ordering.

This is not a production vector store.

## Tuning discipline

- use the fixed P2 development split for profile comparison;
- preserve P2 Stable Evidence byte-range relevance;
- use the same chunk corpus per profile;
- record embedding/build time, query latency, peak RSS and vector bytes;
- do not inspect holdout while selecting a profile;
- freeze one profile before one-shot holdout confirmation.

## Decision state

No model/profile is selected yet. No Recall/MRR/resource number is claimed without a real embedding run.

P2-T07 may proceed against the adapter metadata/search contract under the autonomous-development policy, but it must not interpret dense retrieval as proven usable until a real profile run is recorded.
