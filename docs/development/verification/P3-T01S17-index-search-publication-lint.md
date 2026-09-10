# P3-T01S17 — Index / Search Publication Production Lint Verification

Status: **PASS**

## Automated verification

Final code head: `d80a2ea9c9e79e7f8c844f791192c22bac04d5a9`

GitHub CI run `34440910038` confirmed:

```text
npm run typecheck → PASS
npm run lint → 126 inherited errors remain
```

Verified task-owned delta:

- 8 inherited findings removed from `fts5Index.ts`;
- 3 inherited findings removed from `searchQuery.ts`;
- 5 inherited findings removed from `indexBuildPublication.ts`;
- 10 inherited findings removed from `indexBuildRetention.ts`;
- repository ESLint baseline moved from 152 to 126;
- no finding remains in the four touched production files.

P2 FTS Evidence run `34440909994` and P2 Lexical Evidence run `34440910007` both passed on the final code head.

An earlier P2 FTS run `34440515211` correctly caught a task-owned search metadata error-message regression. The follow-up restored the prior fail-closed error contract. A subsequent CI run exposed type-only `no-unsafe-assignment` findings, which were removed with an explicit record type guard. Neither repair changed FTS query compilation, limits, publication semantics, evidence, or benchmark configuration.

## Behavioral assertions verified by focused gates

- FTS5 lexical query compilation and configured result limits remain intact;
- optional allowed-SourceVersion filtering remains intact;
- deterministic chunk/query/run identity inputs are unchanged;
- search metadata must match the leased build, SourceVersion, ParsedArtifact and Workspace;
- metadata failure still releases the acquired IndexBuild lease and preserves the established error contract;
- only validated non-stale IndexBuilds can publish;
- publication compare-and-swap rejects stale base generation/active build;
- durable/unexpired pins protect retained builds;
- GC re-checks eligibility immediately before destructive deletion;
- malformed SQLite rows fail closed rather than being asserted into typed records.

## Baseline classification

The repository verify workflow remains globally red because 126 unrelated inherited P3-T01 lint findings remain. This is inherited baseline debt, not an S17 regression.

## User verification

None. This production refactoring is repository/CI-verifiable and adds no user verification debt.
