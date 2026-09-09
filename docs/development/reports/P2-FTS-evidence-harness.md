# P2 FTS evidence harness

Status: **IMPLEMENTED / EXECUTION IN CI OR TARGET ENVIRONMENT**

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

A source-level audit of the current production chunker confirms that heading-delimited sections become separate chunks when each section is below the 2,400-byte target. The fixed challenge material has 13 / 11 / 11 sections, so its expected production shape is 35 challenge chunks. This is only an audit prediction; the generated evidence must record the actual runtime chunk count.

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

Holdout per-query identities/hit lists are deliberately not emitted, reducing accidental tuning leakage. Holdout remains aggregate acceptance evidence.

## Dependency handling

The long P2 ancestry still does not inherit the late P1-T02 package-manifest correction. The wrapper therefore:

1. runs `npm ci`;
2. checks whether `better-sqlite3` resolves;
3. when absent, installs exactly `better-sqlite3@13.0.3` with `--no-save --package-lock=false`;
4. probes real SQLite + FTS5 before the benchmark.

This changes only the execution environment's `node_modules` and does not claim the dependency ancestry debt is solved.

## GitHub Actions evidence

`.github/workflows/p2-fts-evidence.yml` runs the same one-shot harness on `ubuntu-latest` with Node 24 and uploads the full evidence directory as `p2-t04-expanded-fts-evidence` even when a later repository gate fails.

Linux CI evidence is valid for retrieval correctness, real SQLite/FTS behavior, chunk pressure, metric math, and reproducibility on the tested runner. Its latency/RSS values are **CI-runner measurements**, not target Omarchy performance acceptance.

## Gate behavior

Focused corrected-ancestry tests are mandatory before the benchmark. Repository-wide gates run afterwards and each exit code/log is preserved even if inherited PI WEB failures remain. The harness does not repair unrelated failures merely to obtain green.

## Verification state

The script sources were syntax-checked when authored:

- benchmark source `node --check`: PASS;
- wrapper source `bash -n`: PASS.

The original automation container cannot resolve `github.com`, so it cannot itself install dependencies. The dedicated GitHub Actions workflow is the autonomous execution path; a target-machine run remains separately useful for Omarchy-specific resource evidence.
