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

## CI evidence

PR #56 head before this report update:

```text
8ca13266b58e76530f7fac00de03df6b1abea622
```

GitHub Actions CI run:

```text
34391016986
```

### TypeScript gate

**PASS.**

`npm run verify` executed:

```text
npm run typecheck
→ tsc --noEmit
→ exit 0
```

The previous 12 TypeScript errors are no longer present. CI then advanced to ESLint, proving this task removed the original typecheck stop condition.

### Newly exposed inherited lint baseline

CI then failed at ESLint with:

```text
261 errors
0 warnings
```

across a broad pre-existing Knowledge/plugin surface, including many files untouched by P3-T01.

Examples include:

```text
pi-web-plugins/knowledge/*
src/knowledge/eval/*
src/knowledge/storage/*
src/knowledge/service/*
src/knowledge/runtime/*
src/server/knowledgeSelectedMachineFederation.integration.test.ts
```

This is a broader inherited lint baseline that the parent CI could not reveal because the parent stopped earlier at TypeScript. P3-T01 does not expand to a 261-error repository-wide lint rewrite; that would violate this task's narrow scope and make regression attribution worse.

Touched files also contain older lint debt (for example pre-existing non-null assertions/empty fixture methods/void-expression assertions) that existed before this task's minimal TypeScript fixes. Those are not silently folded into this task.

### Other workflow observations

- P2 FTS Evidence workflow completed successfully on the head.
- P2 Lexical Evidence reached the native SQLite runtime probe and failed there after its diagnostic typecheck/lint/knip/build/package steps reported success; the frozen P2 benchmark was not rerun/tuned by this task.

## Current verification status

Achieved:

1. known 12 TypeScript errors removed;
2. `npm run verify` progresses beyond typecheck;
3. task diff remains six files: four narrow code/test fixes plus report/verification docs;
4. no product/ADR/evidence scope expansion.

Still open:

1. repository CI remains red at inherited ESLint baseline;
2. CI therefore has not reached the full `npm test` stage, so touched-area test execution is not yet obtained from the main CI workflow;
3. the broader lint baseline needs its own dependency-safe cleanup plan rather than being hidden inside this task.

## Status decision

**PARTIAL.**

P3-T01 has closed the original TypeScript blocker, but the objective of establishing a trustworthy pre-Slice-A static/test baseline is not fully achieved while the newly exposed inherited lint baseline prevents CI from reaching later gates.

## User verification

No user-local/browser/Fleet/hardware verification is required. This is autonomous repository implementation debt and should continue without requesting immediate user participation.
