# P2-T09 support verification — Retrieval benchmark evidence harness

Status: **OPEN / CI EXECUTION REQUIRED**

## Required GitHub evidence

Run `.github/workflows/p2-retrieval-benchmark-evidence.yml` on the support PR.

PASS requires:

1. clean dependency install;
2. focused Golden Dataset/challenge/FTS/SearchQuery/P2-T09 runner tests PASS;
3. production parser/chunker yields exactly 38 total chunks and 35 challenge chunks;
4. all 50 development queries produce exactly one real observation each with no cross-split data;
5. `runRetrievalBenchmark(..., "development", ...)` executes with the frozen `fts-baseline` variant;
6. generated Markdown/JSON are uploaded as an Actions artifact;
7. provenance records repository SHA, deterministic development-dataset hash, configuration, runtime versions and dbstat allocation;
8. no holdout query/label files are loaded.

## Expected configuration

```text
retriever = sqlite-fts5
tokenizer = unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
topK = 10
corpusChunks = 38
challengeChunks = 35
```

## Gate classification

Repository-wide diagnostics may expose inherited typecheck/lint/knip debt. Classify those failures against the direct base; do not patch unrelated ancestry in this support PR.

Task-attributable failures in the support script/workflow or P2-T09 runner must be corrected before using the artifact as ADR evidence.

## Direct-base scope

Expected support-only diff against `feat/p2-retrieval-benchmark-runner`:

- `.github/workflows/p2-retrieval-benchmark-evidence.yml`;
- `scripts/p2-run-retrieval-benchmark.mjs`;
- this verification guide;
- support report.

No retriever implementation, dataset mutation, Dense/vector/RRF code, provider/model call, direct-file baseline or P3 implementation belongs here.
