# P3-T01 — Pre-P3 Baseline Closure Verification

Status: **PARTIAL until CI evidence is recorded**

## Purpose

Verify that the inherited Knowledge TypeScript baseline debt is removed without changing product behavior or introducing unrelated fixes.

## Preconditions

Use branch:

```text
chore/p3-baseline-closure
```

Base:

```text
docs/p3-planning-rebaseline
```

Do not run benchmark tuning or mutate P2 evidence.

## Required repository checks

### 1. Diff hygiene

```bash
git diff --check origin/docs/p3-planning-rebaseline...HEAD

git diff --name-only origin/docs/p3-planning-rebaseline...HEAD
```

Expected task-owned implementation files:

```text
src/knowledge/service/viewerDispatch.ts
src/knowledge/storage/chunker.test.ts
src/knowledge/storage/evidence.test.ts
src/knowledge/storage/sourceEvidenceViewer.test.ts
```

plus this task's report/verification/status documentation.

No benchmark corpus/labels/evidence or unrelated production subsystem should change.

### 2. TypeScript

```bash
npm run typecheck
```

Expected:

- none of the previously inherited 12 errors remain;
- command exits 0 unless a distinct, newly surfaced baseline error is documented and compared against the parent branch.

### 3. Focused tests

```bash
npm test -- --run \
  src/knowledge/storage/chunker.test.ts \
  src/knowledge/storage/evidence.test.ts \
  src/knowledge/storage/sourceEvidenceViewer.test.ts
```

Also run the viewer-dispatch test file if one exists in the current repository tree.

Expected: touched-area tests pass.

### 4. Full verify

```bash
npm run verify
```

The important first gate is that verification progresses beyond the former `tsc --noEmit` failure.

If a later lint/knip/test failure appears:

1. compare it against `origin/docs/p3-planning-rebaseline` / accepted P2 base;
2. classify inherited vs task-attributable;
3. do not patch unrelated inherited failures merely to make the task green.

## Behavioral regression checks

The changes are intended to be typing/test-harness cleanup only. Confirm that:

- Knowledge viewer dispatch still derives Workspace identity from host-authoritative scope;
- chunker semantics are unchanged;
- Stable Evidence quote/range semantics are unchanged;
- Source/Evidence Viewer historical and cross-workspace behavior is unchanged.

## User/manual verification

None required.

This task should be fully accepted from repository/static/test evidence. Do not create deferred user verification debt for it.

## PASS condition

P3-T01 becomes PASS when:

- diff scope is clean;
- the inherited 12 TypeScript errors are gone;
- focused touched-area tests pass;
- no new task-attributable failure remains;
- any unrelated inherited failure is explicitly classified rather than silently fixed.
