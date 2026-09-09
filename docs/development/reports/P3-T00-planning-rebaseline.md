# P3-T00 — Planning Rebaseline

Status: **PASS**

Date: 2026-09-10

## Objective

Rebaseline the authoritative development plan after ADR-029 was Accepted so future P3 work follows the accepted canonical Knowledge / replaceable retrieval boundary instead of the pre-ADR “Ask then separate Notes subsystem” task sequence.

This task is documentation/analysis only. It does not modify production code, frozen P2 evidence, retrieval configuration, or ADR-029.

## Audited baseline

Base branch:

```text
experiment/p2-retrieval-adr
81a06a6700c80b63ad796cdfbeee5a49a5c939cd
```

Relevant final P2 state:

- P2-T10: PASS — direct-file Pi baseline;
- P2-T11: PASS — decision-sufficient mature-product evidence;
- P2-T12: PASS — ADR-029 Accepted;
- #54 and #44 were safely restacked onto the latest #43 using ordinary merge commits;
- #54 remains exactly five task-owned files;
- #44 remains exactly three ADR/report/verification files;
- no PR was merged and no P3 production work existed at the start of this task.

## Findings

The previous `DEVELOPMENT-PLAN.md` and `PHASES.md` predated the final ADR decision and were no longer safe as an execution plan.

Material drift included:

1. V1 was still framed primarily as `Source → Evidence → Restricted Ask → Saved Note`.
2. P3 was decomposed into a linear Ask task set followed by a separate Notes revision subsystem.
3. The plan did not make the accepted captured-vs-published Source contract explicit.
4. ParsedArtifact interpretation identity, frozen GenerationRun scope, DeliveredEvidence, canonical retention closure and business-commit fencing were not represented as first-class P3 work.
5. DerivedArtifact / immutable ArtifactRevision / pinned-vs-follow-current semantics were missing from the executable plan.
6. P2-T11 still implied the original two-product comparison contract even though the full Open WebUI long run had been explicitly de-scoped after the architecture question changed.
7. P2-T12 still described only a retrieval choice rather than the accepted canonical-domain ownership boundary.
8. The “current project position” was stale and still pointed to old P1 task progression rather than the actual P2/ADR handoff.

## Changes

### `docs/development/DEVELOPMENT-PLAN.md`

Rewritten as the current forward-looking baseline while preserving historical detail in Git history, reports, verification guides and the changelog.

The new plan freezes the ADR-029 contracts that P3 must implement:

- Pi-owned canonical Knowledge truth/lineage;
- captured vs published Source state;
- explicit `SourceVersion + ParsedArtifact + publication generation`;
- immutable ParsedArtifact interpretation identity;
- Evidence independent of retrieval chunks;
- frozen GenerationRun / ScopeManifest;
- per-invocation DeliveredEvidence;
- persistent Answer / CitationRef;
- canonical retention closure independent of index GC;
- `archive != purge`;
- worker fencing at business commit;
- `DerivedArtifact + immutable ArtifactRevision`;
- `pinned | follow-current` and `current | needs-review`;
- SQLite FTS5 as V1 retrieval; Dense/Hybrid/Qdrant remain evidence-gated future work.

The old P3 task sequence is superseded by:

```text
P3-T01 — Pre-P3 baseline closure
        ↓
P3 Slice A — Production Knowledge Closure
        ↓
P3 Slice B — First Derived Resource
        ↓
Ask/Notes/product UX expansion using shared domain primitives
```

### `docs/development/PHASES.md`

Updated the phase-level gate to match the same P3 structure and clarified that P0/P1 remain PARTIAL acceptance streams while P2's architecture/retrieval decision gate is PASS.

### Verification-debt handling

`VERIFICATION-DEBT.md` was reviewed but intentionally not changed by this task. The current 12 inherited TypeScript errors are autonomous implementation debt, not user-only verification debt. They are assigned to the next implementation task instead of being mislabeled as deferred user acceptance.

## Next task

### P3-T01 — Pre-P3 baseline closure

Known inherited Knowledge typecheck errors currently appear in:

```text
src/knowledge/service/viewerDispatch.ts
src/knowledge/storage/chunker.test.ts
src/knowledge/storage/evidence.test.ts
src/knowledge/storage/sourceEvidenceViewer.test.ts
```

P3-T01 must clean this baseline without mixing product features, frozen evidence changes or ADR changes. The purpose is to make subsequent Slice A regressions attributable.

## Discipline

- docs-only task;
- one branch / one Draft PR;
- no production code changes;
- no P2 evidence mutation;
- no ADR reopening;
- no Open WebUI benchmark restart;
- no force-push/rebase;
- no PR merge;
- no user verification required for this analysis-only task.

## Result

**PASS** — the forward development plan and phase gate are now aligned with ADR-029, and the next dependency-safe implementation task is explicitly P3-T01 baseline closure.
