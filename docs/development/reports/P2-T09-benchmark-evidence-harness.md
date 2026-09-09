# P2-T09 support — Retrieval benchmark evidence harness

Status: **IMPLEMENTED / EXECUTION PENDING**

## Purpose

Provide one narrow CI-only harness that executes the frozen FTS baseline on the corrected expanded development corpus and feeds the resulting complete observations into P2-T09's real `runRetrievalBenchmark()` + `renderRetrievalBenchmarkMarkdown()` implementation.

## Stack

Base: canonical P2-T09 / `feat/p2-retrieval-benchmark-runner` / PR #41.

This is a support layer only. It does not change retrieval behavior or P2-T09 report-runner semantics.

## Frozen input

- 3 original immutable corpus snapshots;
- 3 development-only challenge artifacts;
- expected production chunk pressure: 38 total / 35 challenge chunks;
- existing development queries and Stable Evidence labels unchanged;
- Top-K = 10;
- P2-T05 selected lexical profile = `baseline`;
- P1-T13 natural-language compiler = quoted literal terms joined with OR;
- active IndexBuild publication/search lease semantics inherited from the corrected ancestry.

No holdout file is loaded by this harness.

## Production path

`openKnowledgeDatabase -> canonicalizeParsedArtifact -> chunkParsedArtifact -> Fts5BaselineIndex -> IndexBuildPublisher -> SearchQueryApi -> runRetrievalBenchmark`

The script stores all 50 real development observations in the evidence artifact, then renders the benchmark through the P2-T09 runner rather than manually copying aggregate metrics.

## Evidence outputs

The workflow uploads:

- `retrieval-benchmark-development.md` — generated runner output;
- `retrieval-benchmark-development.json` — provenance + generated report;
- `observations-development.json` — complete development observations.

Provenance includes repository SHA, a deterministic hash across the frozen development dataset files, configuration, SQLite version, Node version, chunk counts, dbstat FTS bytes and runner-specific peak RSS.

## Boundaries

- No Dense/Hybrid variant is generated because P2-T06 rejected both fixed Dense candidates on development quality.
- No holdout is consumed or exposed.
- GitHub latency/RSS remain runner-specific evidence.
- No production code is changed.
- No P3 work is included.
