# P3-T01S17 — Index / Search Publication Production Lint Verification

Status: **PARTIAL — CI EVIDENCE PENDING**

## Automated verification

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/fts5Index.test.ts src/knowledge/storage/searchQuery.test.ts src/knowledge/storage/indexBuildPublication.test.ts src/knowledge/storage/indexBuildRetention.test.ts
```

Expected task-owned delta:

- 8 inherited findings disappear from `fts5Index.ts`;
- 3 inherited findings disappear from `searchQuery.ts`;
- 5 inherited findings disappear from `indexBuildPublication.ts`;
- 10 inherited findings disappear from `indexBuildRetention.ts`;
- typecheck remains green;
- repository ESLint baseline should move from 152 to approximately 126; exact CI output is authoritative.

## Behavioral assertions

Verification must preserve:

- FTS5 lexical query compilation and configured result limits;
- optional allowed-SourceVersion filtering;
- deterministic chunk/query/run identity inputs;
- search metadata must match the leased build, SourceVersion, ParsedArtifact and Workspace;
- only validated non-stale IndexBuilds can publish;
- publication compare-and-swap rejects stale base generation/active build;
- search acquires and releases an active IndexBuild lease;
- durable/unexpired pins protect retained builds;
- GC re-checks eligibility immediately before destructive deletion;
- malformed SQLite rows fail closed rather than being asserted into typed records.

## Baseline classification

Any unrelated remaining lint findings are inherited P3-T01 baseline debt and must not be absorbed into S17.

## User verification

None. This production refactoring is repository/CI-verifiable and adds no user verification debt.
