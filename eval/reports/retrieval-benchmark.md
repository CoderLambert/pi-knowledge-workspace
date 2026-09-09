# P2-T09 — Retrieval benchmark runner output

Status: **UNRUN / PARTIAL**

This file is a placeholder for a real `runRetrievalBenchmark` + `renderRetrievalBenchmarkMarkdown` output. Do not manually populate numeric metrics from source inspection or unit-test fixtures.

## Required run metadata

Before replacing this placeholder, record:

```text
split: development | holdout
generatedAt: ISO timestamp
dataset revision/hash
variant ids
complete variant configuration records
observation source / retrieval implementation revision
```

Every variant must provide one observation for every query in the selected split and no observation from another split.

## Required metrics per variant

The generated report includes:

- Recall@10;
- MRR;
- all-required-Evidence coverage;
- failure counts by query category;
- median / p95 / max latency;
- peak RSS;
- index/vector resource bytes;
- no-answer query diagnostics.

## Integrity rule

The runner consumes recorded ranked hit locators and the fixed Golden Dataset. It does not run retrieval, tune a configuration, or infer missing observations. Results remain grounded in Stable Evidence SourceVersion + ParsedArtifact UTF-8 range overlap.
