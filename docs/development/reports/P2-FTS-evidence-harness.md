# P2 FTS evidence harness

Status: **EXECUTED / CI EVIDENCE RECORDED / TARGET PERFORMANCE OPEN**

Branch: `chore/p2-fts-evidence-harness`  
Direct base: `experiment/p2-fts-baseline-report` (P2-T04 / PR #36)

## Purpose

Turn the corrected P2-T03A + P1-T13 propagation + P2-T04 verification sequence into one reproducible command without adding benchmark machinery to the P2-T04 task diff itself.

This is verification support only. It does not change production retrieval behavior, P2 metrics, Golden Evidence, or the retrieval ADR.

## Files

- `scripts/p2-run-fts-baseline.mjs` — real expanded-corpus FTS benchmark runner.
- `scripts/p2-run-fts-evidence.sh` — one-shot dependency/runtime/focused-test/benchmark/repository-gate wrapper.
- `.github/workflows/p2-fts-evidence.yml` — Linux GitHub Actions execution + evidence artifact upload.

The remaining two files are this report and its verification guide.

## Benchmark inputs

The runner freezes exactly six corpus records:

Original:

1. `vue-reactivity-core-zh`
2. `node-fspromises-cp-v16.7.0`
3. `node-fspromises-cp-v22.3.0`

P2-T03A challenge:

4. `challenge-vue-reactivity-neighbors`
5. `challenge-node-fspromises-neighbors-a`
6. `challenge-node-fspromises-neighbors-b`

It uses the unchanged 50 development + 30 holdout queries and existing Stable Evidence labels with Top-K=10.

## Production path

The benchmark composes the real code path:

`openKnowledgeDatabase -> canonicalizeParsedArtifact -> chunkParsedArtifact -> Fts5BaselineIndex -> IndexBuildPublisher -> SearchQueryApi -> evaluateFtsBaseline`

It verifies corpus hashes/parser fingerprints, requires at least 10 chunks per challenge artifact and 30 challenge chunks total, uses the propagated natural-language FTS compiler, and preserves active IndexBuild lease semantics through the normal `SearchQueryApi` implementation.

A source-level audit of the current production chunker confirms that heading-delimited sections become separate chunks when each section is below the 2,400-byte target. The fixed challenge material has 13 / 11 / 11 sections, so its expected production shape is 35 challenge chunks. This prediction was confirmed by the real CI run below.

## Evidence outputs

Default output directory:

`/tmp/pi-knowledge-p2-evidence/p2-t04`

Primary files:

- `fts-expanded-result.json`
- `fts-expanded-result.md`
- `run.log`
- `gates/status.tsv`
- `gates/*.log`
- `git-status.txt`
- `git-log.txt`
- `README.txt`

The JSON contains exact repository/runtime provenance, chunk counts, query-error counts, FTS metrics, rank distribution, development non-rank-1 diagnostics, split-level no-answer hit counts, and SQLite `dbstat` allocation.

Holdout per-query identities/hit lists are deliberately not emitted. The already-produced aggregate holdout values are acceptance-only evidence and must not be used to select P2-T05/P2-T06/P2-T08 configuration. Development diagnostics are the only tuning input.

## Dependency handling

The long P2 ancestry still does not inherit the late P1-T02 package-manifest correction. The wrapper therefore:

1. runs `npm ci`;
2. checks whether `better-sqlite3` resolves;
3. when absent, installs exactly `better-sqlite3@13.0.3` with `--no-save --package-lock=false`;
4. probes real SQLite + FTS5 before the benchmark.

This changes only the execution environment's `node_modules` and does not claim the dependency ancestry debt is solved.

## GitHub Actions evidence

Successful evidence run: GitHub Actions run `34320914371`, job `102367113008`, artifact `10091833384` (`p2-t04-expanded-fts-evidence`).

PR head when triggered: `813a009d51acd7340818b7f88279a681c02c131f`. GitHub checked out the PR merge ref, so the benchmark's recorded repository SHA is merge commit `24798b26c72ff6f67ed7ee3fe79dcf129b084a57`.

Runtime:

- Ubuntu 24.04 GitHub-hosted runner;
- Node `v24.20.0`;
- `better-sqlite3@13.0.3`;
- SQLite `3.53.4`;
- FTS5 probe: PASS.

Focused corrected-ancestry tests: **25/25 PASS across 7 files**.

Real expanded corpus:

- original artifacts: 3;
- challenge artifacts: 3;
- original chunks: 3;
- challenge chunks: 35 (`13 / 11 / 11`);
- total chunks: 38;
- fixed queries executed: 80;
- query errors: 0.

Measured overall acceptance metrics from this frozen baseline run:

- Recall@10: **1.0**;
- MRR: **0.928921568627451**;
- all-required Evidence coverage: **1.0**;
- category failures: **none**;
- answerable queries: 68;
- no-answer queries: 12;
- no-answer queries returning at least one lexical hit: 12;
- rank distribution: 59 rank-1, 7 rank-2, 2 rank-3, 0 rank-4..10, 0 misses.

Development-only rank diagnostics:

- answerable development queries: 42;
- rank-1: 37;
- rank-2: 4;
- rank-3: 1;
- miss: 0;
- non-rank-1 query ids: `dev-026`, `dev-028`, `dev-034`, `dev-040`, `dev-042`.

Runner-specific resource evidence:

- latency median: **0.777354 ms**;
- latency p95: **1.697253 ms**;
- latency max: **11.47536 ms**;
- peak RSS: **106,168,320 bytes**;
- SQLite `dbstat` FTS allocation: **49,152 bytes**.

`dbstat` allocation breakdown:

- `chunk_fts_config`: 4,096 bytes;
- `chunk_fts_content`: 20,480 bytes;
- `chunk_fts_data`: 16,384 bytes;
- `chunk_fts_docsize`: 4,096 bytes;
- `chunk_fts_idx`: 4,096 bytes.

Linux CI evidence is valid for retrieval correctness, real SQLite/FTS behavior, challenge chunk pressure, metric math, query-compiler execution path, lease-preserving `SearchQueryApi` behavior, and reproducibility on the tested runner. These latency/RSS figures are **not** relabeled as target Omarchy performance acceptance.

## Gate behavior and inherited failures

The dedicated evidence workflow intentionally skipped duplicate repository-wide gates and delegated them to the normal CI run on the same PR.

Normal CI run `34320914339` failed first at inherited TypeScript errors outside this support PR's five-file scope, including `viewerDispatch.ts`, `chunker.test.ts`, `evidence.test.ts`, and `sourceEvidenceViewer.test.ts`. Build/package steps were therefore skipped by the normal CI workflow. These failures are not attributable to the evidence-harness diff and are not patched here merely to obtain green.

The support PR's direct-base diff remains exactly five evidence-only files; no production Knowledge code, Golden Dataset query/label content, retrieval profile, Dense/vector/RRF code, ADR, or P3 implementation is changed.

## Current verification classification

**CI retrieval evidence: PASS.**

**Repository-wide normal CI: inherited baseline failure, not P2-T04-attributable.**

**Target Omarchy resource acceptance: OPEN.** The same one-shot command remains the reproducible target-machine path:

```bash
bash scripts/p2-run-fts-evidence.sh
```

The target run is needed only for target-specific resource/operational evidence; it is no longer needed to prove the deterministic FTS retrieval-quality rows already established by GitHub Actions.
