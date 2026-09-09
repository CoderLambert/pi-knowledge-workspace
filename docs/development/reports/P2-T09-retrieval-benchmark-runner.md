# P2-T09 — Retrieval benchmark runner

Status: **PASS**

## Objective

Automate reproducible report generation for the retrieval metrics already defined across P2 without coupling report generation to a specific retriever or tuning loop.

## Corrected direct base

P2-T06 / `experiment/p2-dense-retrieval-adapter` / PR #38.

P2-T06 rejected both fixed Dense profiles on real development evidence. Canonical PR #41 therefore bypasses historical P2-T07 sqlite-vec / #39 and P2-T08 Hybrid/RRF / #40, which are not adopted retrieval ancestry.

## Implemented scope

`src/knowledge/eval/retrievalBenchmarkRunner.ts` is a pure observation-driven runner:

- caller explicitly selects `development` or `holdout`;
- the Golden Dataset is filtered to exactly that split;
- every named variant carries a canonicalized configuration record;
- duplicate variant ids fail closed;
- observations are evaluated through the existing Stable Evidence overlap metrics;
- cross-split observations are rejected;
- output records Recall@10, MRR, all-required-Evidence coverage, category failure counts, latency, resources and no-answer diagnostics;
- deterministic Markdown rendering includes configuration, failures and diagnostics.

The runner does not execute retrieval, tune parameters, fetch models or invent observations.

## Real generated evidence

Support PR #52 executed the frozen FTS production path and fed all 50 development observations into the actual P2-T09 runner.

Initial complete evidence run:

```text
run = 34329322920
artifact = 10095148994
digest = sha256:079dc6b4a46c90136e274395d76ba63219e5c43e2ccb913135d5561364ca3672
```

The committed `eval/reports/retrieval-benchmark.md` is the generated Markdown from that run rather than a hand-authored numeric summary.

Canonical final revalidation after task-owned lint cleanup:

```text
run = 34330083378
artifact = 10095437462
digest = sha256:bf01d27361280a9f1de92b176ead5919cb1c05555a146597fd46f64f8e3d93d1
focused = 8 files / 29 tests PASS
P2-T09 task-owned lint errors = 0
```

Runner environment:

```text
Ubuntu 24.04.4
Node 24.20.0
better-sqlite3 13.0.3
SQLite 3.53.4
FTS5 = true
```

Production evidence path:

```text
openKnowledgeDatabase
→ canonicalizeParsedArtifact
→ chunkParsedArtifact
→ Fts5BaselineIndex
→ IndexBuildPublisher
→ SearchQueryApi
→ runRetrievalBenchmark
→ renderRetrievalBenchmarkMarkdown
```

Frozen configuration:

```text
retriever = sqlite-fts5
tokenizer = unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
topK = 10
corpusChunks = 38
challengeChunks = 35
```

Development quality reproduced exactly in the final run:

```text
queries: 50
answerable: 42
no-answer: 8
Recall@10: 1.0
MRR: 0.9365079365079365
all-required Evidence coverage: 1.0
category failures: none
no-answer queries with any hit: 8 / 8
FTS dbstat allocation: 49,152 bytes
```

Deterministic development-dataset hash:

`949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3`

Final-run performance sample was median `0.411384 ms`, p95 `0.522166 ms`, max `2.587426 ms`, peak RSS `103,907,328 B`. The initial run recorded median `0.794373 ms`, p95 `1.334205 ms`, max `3.400616 ms`, peak RSS `105,443,328 B`. These differences are runner jitter; quality and persistent FTS allocation reproduced exactly. GitHub runner measurements are not Omarchy target-machine claims.

## Retrieval candidate interpretation

P2-T05 froze plain FTS as the least-complex lexical winner. P2-T06 tested two serious fixed multilingual Dense profiles; both regressed Recall, MRR and all-required Evidence coverage.

Therefore the evidence-backed P2-T09 comparison set contains one valid retrieval candidate: **FTS baseline**. Dense/Hybrid rows are intentionally absent rather than fabricated from rejected or unexecuted candidates.

## Holdout discipline

The P2-T09 harness loads development query/label files only. No holdout observation participated in report generation or tuning. P2-T05's earlier one-shot post-freeze FTS holdout remains acceptance-only evidence.

## Gate classification

The four P2-T09-owned style findings discovered by the initial evidence run were repaired without changing benchmark semantics. Full revalidation then showed no `retrievalBenchmarkRunner.ts` or `retrievalBenchmarkRunner.test.ts` lint findings.

The final broad lint reported 308 errors, all outside P2-T09-owned files. Typecheck and knip likewise reproduce inherited/concurrent repository debt. Those failures are not repaired inside this task merely to obtain repository-wide green CI.

## Downstream

P2-T09 evidence is complete. Proceed to P2-T10 direct-file Pi product-value baseline without reopening sqlite-vec/Hybrid.

P3 remains prohibited until ADR-029 is Accepted.

## Acceptance

**PASS.** The runner contract is focused-test green, task-owned lint-clean, and has generated and reproduced a complete real development benchmark with fixed provenance and no holdout contamination.

## Out of scope

- executing or tuning new retrievers;
- embedding provider calls;
- sqlite-vec/Hybrid adoption;
- direct-file Pi execution;
- existing-product hands-on comparison;
- P3 answer generation.
