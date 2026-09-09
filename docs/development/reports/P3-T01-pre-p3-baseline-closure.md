# P3-T01 — Pre-P3 Baseline Closure

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Remove the known inherited Knowledge TypeScript/static-test debt from the post-ADR P3 base before Slice A begins, without changing product behavior, ADR-029, frozen P2 evidence or retrieval configuration.

Base:

```text
docs/p3-planning-rebaseline
```

This task is intentionally narrow: it repairs the already-observed TypeScript defects that prevented `npm run verify` from progressing past `tsc --noEmit`.

## Known inherited errors at task start

The accepted P2 base repeatedly reported 12 TypeScript errors in four files:

```text
src/knowledge/service/viewerDispatch.ts
src/knowledge/storage/chunker.test.ts
src/knowledge/storage/evidence.test.ts
src/knowledge/storage/sourceEvidenceViewer.test.ts
```

The same signature existed on the P2-T11/P2-T12 base, so these failures are inherited implementation debt rather than P3 regressions.

## Changes

### `viewerDispatch.ts`

Introduced an explicitly typed `KnowledgeViewerDispatch` object before freezing it. This restores contextual typing for the object-method parameters instead of leaving `scope`, `sourceId` and `input` implicitly `any` through `Object.freeze({...})` inference.

No dispatch operation, authoritative Workspace resolution or viewer behavior was changed.

### `chunker.test.ts`

Fixed a malformed nested `.every()` assertion:

```text
chunks.every((chunk) => chunk.nodeKinds).every(...)
```

became a single boolean predicate over chunks:

```text
chunks.every((chunk) => chunk.nodeKinds.length === 1 && chunk.nodeKinds[0] === "code-block")
```

The test intent is unchanged: every split chunk for the oversized code block must contain only `code-block` node kind metadata.

### `evidence.test.ts`

Changed test mutation access on `Record<string, unknown>` from dot notation to bracket notation to satisfy `noPropertyAccessFromIndexSignature` while preserving the same locator-snapshot immutability test.

### `sourceEvidenceViewer.test.ts`

Made the fixture's Source lookup narrowing explicit (`source === undefined`) before property access. Runtime fixture semantics are unchanged; the change only makes the existing guard statically sound.

## Scope exclusions

This task does not:

- change Source/SourceVersion/ParsedArtifact schema;
- implement captured/published semantics;
- implement GenerationRun or DeliveredEvidence;
- change FTS behavior;
- modify benchmark/evaluation files;
- fix unrelated dependency/audit findings;
- alter P2 evidence;
- enter P3 Slice A feature work.

## Verification status

Repository CI is required to confirm:

1. the 12 known TypeScript errors are removed;
2. focused Knowledge tests for the touched areas pass;
3. `npm run verify` progresses beyond the previous typecheck stop point;
4. any later failure is compared with the inherited base before classification.

Until the new PR CI is observed, this task remains **PARTIAL**.

## User verification

No user-local/browser/Fleet/hardware verification is required for this cleanup task. All acceptance evidence should be obtainable from repository CI.
