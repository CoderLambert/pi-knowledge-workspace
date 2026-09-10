# P3-T01S21 Verification — Service Dispatch Validation Lint

Status: **PARTIAL**

## Automated verification

Required repository checks:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/service/viewerDispatch.test.ts
```

Required result for task PASS:

- typecheck remains PASS;
- viewer dispatch focused tests pass when reached;
- `src/knowledge/service/dispatch.ts` disappears from authoritative ESLint output;
- repository lint moves from the verified 68-error baseline to 65 unless CI exposes a directly task-owned interaction corrected within S21;
- unrelated remaining failures stay classified as inherited baseline.

Frozen P2 regression workflows must remain PASS:

- P2 FTS Evidence;
- P2 Lexical Evidence.

## Semantic regression checks

The dispatch boundary must continue proving/preserving:

1. Viewer request input must be an object, not null/array/scalar.
2. Unsupported authority-bearing fields are rejected.
3. Scope only accepts `projectId`, `workspaceId`, `workspacePath`, and optional `workspaceLabel`.
4. Required string fields are non-empty.
5. Optional `maxBytes` accepts only positive safe integers.
6. Invalid requests retain the existing `INVALID_REQUEST` / HTTP 400 behavior.
7. Historical `parsedArtifactId` / `evidenceId` values pass through without substitution to latest state.

## Frozen boundaries

Do not modify:

- ADR-029;
- protocol/operation identifiers;
- host-authoritative Workspace/Machine routing;
- P2 evaluation data/evidence;
- retrieval profile/compiler/Top-K configuration;
- benchmark thresholds.

## User verification debt

None expected. This production static-cleanup slice is repository-verifiable and does not require browser/Fleet/system-service/manual acceptance for its PASS decision.
