# Verification — P2 FTS evidence harness

Status: **OPEN / PARTIAL**

Branch: `chore/p2-fts-evidence-harness`  
Direct base: `experiment/p2-fts-baseline-report`

## One-shot execution

From a current checkout of this branch:

```bash
bash scripts/p2-run-fts-evidence.sh
```

Optional output location:

```bash
P2_EVIDENCE_OUT_DIR=/path/to/evidence \
  bash scripts/p2-run-fts-evidence.sh
```

The default bundle is written to:

```text
/tmp/pi-knowledge-p2-evidence/p2-t04
```

## What the wrapper must prove before benchmarking

It must successfully:

1. run `npm ci`;
2. resolve or temporarily install exactly `better-sqlite3@13.0.3` without modifying package/lock files;
3. open real SQLite;
4. create/query an FTS5 virtual table;
5. pass the corrected-ancestry focused tests covering Golden Dataset, representative corpus, P2-T03A challenge corpus, SearchQuery natural-language compilation, FTS5 index, and P2-T04 evaluator.

If any of these fail, do not treat subsequent numbers as valid P2-T04 evidence.

## Expanded benchmark acceptance

`fts-expanded-result.json` must show:

```text
benchmarkValid = true
artifactCount = 6
originalArtifactCount = 3
challengeArtifactCount = 3
challengeChunks >= 30
totalChunks > 10
queryCount = 80
topK = 10
errorCount = 0
```

The exact chunk count is produced by production `canonicalizeParsedArtifact -> chunkParsedArtifact`; do not replace it with a heading-count estimate in final evidence.

The result must also contain:

- Recall@10;
- MRR;
- all-required Evidence coverage;
- category failure counts;
- latency median/p95/max;
- peak RSS bytes;
- FTS `dbstat` bytes;
- overall/development/holdout rank aggregates;
- development non-rank-1 details;
- development misses;
- split-level no-answer hit counts.

## Holdout isolation

The harness may compute aggregate holdout acceptance metrics because P2-T04 evaluates all fixed queries, but it must not publish holdout per-query identities, snippets, or hit lists for tuning.

Only development non-rank-1 details are included in the generated evidence bundle.

## Repository gates

The wrapper records exit status and logs for:

- `npm run typecheck`
- `npm run lint`
- `npm run knip`
- `npm run build`
- `npm run pack:dry`
- `npm test`
- P2-T04 direct-base `git diff --check` / `--name-status`
- harness direct-base `git diff --check` / `--name-status`

A non-zero gate is evidence to classify, not permission to patch unrelated inherited code.

## Expected direct-base scope

```bash
git diff --check origin/experiment/p2-fts-baseline-report...HEAD
git diff --name-status origin/experiment/p2-fts-baseline-report...HEAD
```

Expected support-only files:

- `scripts/p2-run-fts-baseline.mjs`
- `scripts/p2-run-fts-evidence.sh`
- `docs/development/reports/P2-FTS-evidence-harness.md`
- this verification guide.

No production Knowledge code, Golden Dataset content, retrieval implementation, experiment profile, or ADR file belongs in this support PR.

## PASS condition

This support task is PASS only when the one-shot command completes on a supported real environment, produces a valid expanded benchmark bundle, and the harness itself has no task-attributable gate/scope failure. P2-T04 acceptance remains separately governed by PR #36 and its own verification requirements.
