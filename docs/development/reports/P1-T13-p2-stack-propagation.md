# P1-T13 natural-language FTS query fix — P2 stack propagation

Status: **IMPLEMENTED / VERIFICATION PARTIAL**

## Purpose

Propagate the already-proven P1-T13 public SearchQuery boundary fix into the later P2 ancestry without discarding P1-T18/P1-T19 active IndexBuild lease semantics.

The original real P2-T04 run showed that forwarding public natural-language queries directly into SQLite FTS5 `MATCH` caused 78/80 fixed queries to fail on ordinary punctuation, code symbols and FTS operators.

## Change

`SearchQueryApi` now compiles the normalized public query into internal FTS5 syntax by:

1. splitting on Unicode whitespace;
2. quoting every term as an FTS literal;
3. doubling embedded quote characters;
4. joining literals with `OR`.

The stable public query handle continues to hash the original normalized natural-language query. Only the internal FTS expression changes.

## Preserved later semantics

This propagation starts from P2-T03A, so the current `ActiveIndexBuildResolver`, 60-second lease acquisition, and `finally { lease.release(); }` behavior remain unchanged.

## Scope

Only the SearchQuery production boundary, its focused regression test, and this task-owned report/verification record belong here. No P2 lexical normalization, CJK n-grams, code aliases, stemming, Dense/vector/RRF behavior or benchmark-result tuning is introduced.

## Evidence state

The exact behavior was already exercised in the user's Omarchy verification worktree during the original P2-T04 diagnosis, where the corrected 80-query run completed with `queryErrors: 0`. This propagation still requires focused/static/build gates on its own current ancestry before it can be called PASS.
