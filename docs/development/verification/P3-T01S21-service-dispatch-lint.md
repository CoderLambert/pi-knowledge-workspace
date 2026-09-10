# P3-T01S21 Verification — Service Dispatch Validation Lint

Status: **PASS**

## Automated verification

GitHub CI run `34452039976` on code head `ec8e87697186c30d4d8248b75cb121d285b28f59` established:

```text
npm run typecheck → PASS
ESLint 68 → 65
```

`src/knowledge/service/dispatch.ts` is absent from the authoritative ESLint output. The remaining 65 findings are inherited and outside S21 scope.

The repository `verify` job stops at inherited lint before focused tests/build, so those later steps were not reached in this run. No task-owned typecheck or lint failure remains. P2 FTS/Lexical workflows were not path-triggered by this service-only change, and no P2 evaluation/evidence/configuration file changed.

## Semantic regression checks

The dispatch boundary must continue preserving:

1. Viewer request input must be an object, not null/array/scalar.
2. Unsupported authority-bearing fields are rejected.
3. Scope only accepts `projectId`, `workspaceId`, `workspacePath`, and optional `workspaceLabel`.
4. Required string fields are non-empty.
5. Optional `maxBytes` accepts only positive safe integers.
6. Invalid requests retain the existing `INVALID_REQUEST` / HTTP 400 behavior.
7. Historical `parsedArtifactId` / `evidenceId` values pass through without substitution to latest state.

The S21 code change only replaces type assertions with explicit runtime narrowing and does not alter these branches.

## Frozen boundaries

Do not modify:

- ADR-029;
- protocol/operation identifiers;
- host-authoritative Workspace/Machine routing;
- P2 evaluation data/evidence;
- retrieval profile/compiler/Top-K configuration;
- benchmark thresholds.

## User verification debt

None. This static-cleanup slice is repository-verifiable and does not require browser/Fleet/system-service/manual acceptance for its PASS decision.
