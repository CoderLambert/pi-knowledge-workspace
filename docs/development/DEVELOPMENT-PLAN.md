# Pi Knowledge Workspace — Product Roadmap

Status: **Active Development Baseline**  
Repository: `CoderLambert/pi-knowledge-workspace`  
Strategy: **Thin Fork + standalone pi-knowledge process**  
Architecture baseline: **ADR-029 Accepted**  
Current development base: `feat/p3-regression-gate`, from `686bf747`

This document is the authoritative forward-looking product roadmap. It records product order, milestone gates, dependencies and durable correctness contracts. It is not an execution ledger for Agent Work Units, lint slices or frequent commits.

Historical detail remains in Git history, existing reports, verification guides and `CHANGELOG.md`. Current execution policy lives in:

- [`AUTONOMOUS-EXECUTION.md`](./AUTONOMOUS-EXECUTION.md) — Product Slice First and Agent Work Units;
- [`BRANCH-HYGIENE.md`](./BRANCH-HYGIENE.md) — isolated worktrees and Product Slice branches;
- [`REPORTING.md`](./REPORTING.md) — work-unit handoff, slice PR and milestone reporting;
- [`VERIFICATION.md`](./VERIFICATION.md) — Fast, Slice and Full gates;
- [`CI-FIRST-VERIFICATION.md`](./CI-FIRST-VERIFICATION.md) — evidence environment selection.

## 1. Product Slice First

```text
Product Milestone
└── Product Slice                 default branch / Draft PR / CI / review unit
    ├── Agent Work Unit
    ├── Agent Work Unit
    └── Agent Work Unit
```

Each independently reviewable Product Slice normally gets one branch and one Draft PR. Multiple Agent Work Units may contribute to the same slice through isolated worktrees. Work units normally receive only a concise handoff and do not create permanent repository reports, verification guides, changelog entries or roadmap updates.

The Lead/Integrator owns the coherent slice diff, resolves integration overlap, runs the Slice Gate and maintains the PR description. A Product Slice can use a small number of PRs when genuine review risk or dependency order warrants it; PR-per-layer and PR-per-Agent are not defaults.

## 2. Current baseline

As of 2026-09-10:

| Area | Status | Current fact |
| --- | --- | --- |
| P0 | PARTIAL | Core integration boundary exists; required local/Fleet/runtime debt remains. |
| P1 | PARTIAL | Evidence/storage/index/job foundations exist; production lifecycle acceptance remains incomplete. |
| P2 FTS Evidence | PASS | Frozen executable FTS evidence is accepted. |
| P2 Lexical Evidence | PASS | Frozen lexical decision evidence is accepted. |
| P2 / ADR-029 | PASS | Canonical ownership and V1 retrieval decisions are accepted. |
| TypeScript | PASS | The current baseline is green. |
| ESLint | MAINTENANCE DEBT | 77 inherited findings remain; they are not a P3 critical-path zero target. |
| P3-T01 | PASS | `npm run verify:p3` provides the typecheck, scoped critical lint, focused Knowledge tests and build gate. |

P3-T01 does **not** require historical lint to reach zero. The goal is a trustworthy Product Slice regression signal that keeps new/touched/P3-critical code clean while inherited findings remain explicitly distinguishable.

Do not plan P3-T01S20/P3-T01S21 or continue general lint cleanup. The next step is:

```text
P3 regression gate / P3-T01 exit
→ Reliable Knowledge
```

## 3. Accepted architecture baseline — ADR-029

ADR-029 remains authoritative. Product Slice First changes delivery granularity, not domain correctness.

### Canonical ownership

Pi owns the long-lived Knowledge truth and lineage:

```text
Workspace
Source
SourceVersion
ParsedArtifact / canonical Document IR
Evidence
GenerationRun / ScopeManifest
DeliveredEvidence
Answer / CitationRef
DerivedArtifact / immutable ArtifactRevision
Provenance
freshness / retention semantics
```

Files, parser implementations, retrieval indexes, models and external RAG systems are replaceable inputs, projections or adapters.

### Publication and immutable identity

- Captured content is not published Knowledge.
- A published selection identifies the concrete SourceVersion, ParsedArtifact and publication generation.
- SourceVersion and ParsedArtifact are immutable.
- Parser/schema/normalization/material configuration changes create a new ParsedArtifact identity.
- Parsing or indexing failure preserves the last valid publication.
- A→B→A and out-of-order completion must not use timestamps to override publication intent.

### Evidence, generation and historical citations

- `CitationRef -> Evidence` is the V1 citation identity.
- Evidence anchors to immutable canonical content, independent of retrieval chunks/index rebuilds.
- Historical citations reopen historical content and never silently redirect to latest.
- A GenerationRun freezes its canonical scope/publication/retrieval snapshot before first retrieval; snapshot loss fails closed.
- DeliveredEvidence records the ordered canonical spans actually sent for each invocation/attempt after application-side shaping.

### Retention, fencing and retrieval

- Retained Answers and ArtifactRevisions keep the canonical closure required to reopen citations.
- Retrieval index retention is separate because the index is a projection, not canonical identity.
- `archive != purge`.
- A stale worker cannot publish user-visible state after losing lease/fencing authority.
- P2 frozen evidence must not be mutated or retuned.
- V1 retrieval remains SQLite FTS5 / `unicode61` / `quoted-literal-or` / Top-K 10.

## 4. P3 product route

```text
P3-T01 Exit
    ↓
Reliable Knowledge
    ↓
Grounded Ask Backend
    ↓
Grounded Ask UI
    ↓
PRODUCT PREVIEW
    ↓
Lifecycle Safety
    ↓
Production E2E / Backup Restore
    ↓
SLICE A PASS
    ↓
Quiz Generate
    ↓
Quiz Lifecycle
    ↓
Quiz E2E
    ↓
P3 PASS
```

The labels above are product outcomes and review boundaries. The Lead/Integrator may decompose each into multiple Agent Work Units without adding those work units to this roadmap.

## 5. P3-T01 Exit — trustworthy regression signal

Goal:

> Exit cleanup mode with a deterministic gate for new P3 Product Slices while retaining the 77 historical ESLint findings as classified maintenance debt.

The executable Product Slice gate is:

```bash
npm run verify:p3
```

It runs, in order:

1. `npm run typecheck`;
2. `npm run lint:p3` over the twelve P3-critical Knowledge storage production files;
3. `npm run test:p3` over the focused Source/ParsedArtifact/Evidence/FTS5/search/publication/retention/worker/import contract tests;
4. `npm run build`.

The existing `npm run lint` and `npm run verify` command definitions remain unchanged. CI runs `verify:p3` as the blocking Product Slice check and reports full-repository lint and Knip independently as non-blocking inherited-debt telemetry. The scoped gate does not change ESLint rules, suppress findings or mutate P2 evidence.

Required exit:

- TypeScript baseline remains green;
- touched and P3-critical paths have a scoped lint signal that detects new findings;
- focused tests for critical Knowledge contracts are runnable and attributable;
- the build and relevant test failures can be classified as Product Slice-owned, inherited or infrastructure/transient;
- the regression gate does not disable or lower any existing ESLint rule;
- P2 FTS and Lexical frozen evidence remain PASS and unchanged.

Historical lint may be fixed only when touched by the current Product Slice, when it masks a slice regression, when it blocks required compilation/test/build, or when it is an actual correctness defect. Numeric cleanup alone is not P3-T01 work.

P3-T01 Exit is **PASS**. The milestone evidence is recorded in [`reports/P3-T01-regression-gate.md`](./reports/P3-T01-regression-gate.md). The next Product Slice is:

```text
feat/p3-reliable-knowledge
→ Captured → Parsed → Indexed → Published
```

## 6. Reliable Knowledge

Goal:

> Make MD/TXT capture, interpretation and publication trustworthy enough to support Grounded Ask.

Expected Agent Work Units may include schema/migration design, publication transaction/CAS, ParsedArtifact identity, runtime validation, service API wiring and focused integration tests. These are not separate roadmap tasks or default PRs.

Required outcome:

- captured and published Source state are explicit;
- publication binds SourceVersion + ParsedArtifact + monotonic generation;
- multiple immutable ParsedArtifacts for one SourceVersion can coexist;
- failed parse/index leaves the previous publication usable;
- stale/out-of-order candidate publication is rejected;
- canonical selection and retrieval snapshot are consistently consumable;
- retrieval index remains rebuildable projection state;
- host-authoritative Workspace/worktree isolation remains covered.

This slice must include migration safety and focused failure-path tests. It must not broaden V1 parser scope beyond Markdown/TXT.

## 7. Grounded Ask Backend

Goal:

> Produce a durable grounded answer from one frozen Knowledge scope with auditable evidence delivery.

A normal Product Slice may combine Agent Work Units for:

```text
GenerationRun
ScopeManifest
Retrieval
DeliveredEvidence
Answer
CitationRef
Provider integration
Service API
tests
```

Required outcome:

- GenerationRun freezes workspace, publications/artifacts, retrieval snapshot, retrieval configuration and provider/model revision before first retrieval;
- later retrieval/read calls stay on the frozen scope;
- snapshot loss fails closed rather than reacquiring latest;
- DeliveredEvidence records ordered canonical spans per invocation/attempt after trimming/dedup/serialization;
- Answer history is durable;
- CitationRef resolves to Evidence delivered by the corresponding generation process;
- missing or purged history is explicit;
- citation integrity is not misrepresented as proof of semantic support;
- provider credentials and connection authority remain server-side.

## 8. Grounded Ask UI

Goal:

> Let a user ask against selected Knowledge, understand progress/limits, and open trustworthy citations.

Required outcome:

- source/version selection follows host-authoritative Workspace state;
- provider/model and data-disclosure information is visible where required;
- progress, insufficient-evidence and failure states are explicit;
- answers render durable citations;
- a citation opens its historical SourceVersion/ParsedArtifact rather than latest content;
- client paths follow PI WEB application-relative URL conventions;
- reconnects or UI/API autoreload do not terminate the separately owned long-lived session runtime.

## 9. PRODUCT PREVIEW

Product Preview is the first end-to-end Grounded Ask milestone.

Minimum journey:

```text
select Workspace Knowledge
→ ask a question
→ retrieve from frozen publication scope
→ call provider
→ persist Answer/CitationRef
→ inspect citation and historical content
```

The milestone requires an integrated slice verification guide, automated evidence from the applicable Slice Gate, explicit known limitations and any remaining target-machine/provider/manual debt. It must not claim Lifecycle Safety or Slice A PASS yet.

## 10. Lifecycle Safety

Goal:

> Make publication, generation, answer and retention state safe under concurrency, cancellation, retry and destructive lifecycle operations.

Required outcome:

- business commits verify current lease/fencing authority;
- a worker that loses authority cannot publish Source state, active retrieval build, Answer, accepted ArtifactRevision or equivalent current pointers;
- stale candidates and optimistic-concurrency conflicts fail closed;
- active GenerationRuns protect required canonical/retrieval state;
- retained answers preserve `CitationRef -> Evidence -> ParsedArtifact -> SourceVersion`;
- archive removes default/current use without destroying retained history;
- purge is explicit destructive intent;
- index GC remains independent from canonical-history retention;
- crash/retry boundaries never report success for half-published state.

Complex identity, transaction, CAS, fencing, concurrency and retention work units should be owned/reviewed by a stronger Agent. Mechanical validation, fixtures and focused tests may run in parallel in isolated worktrees after the contracts are fixed.

## 11. Production E2E / Backup Restore

Goal:

> Prove the supported production lifecycle, recovery and historical citation closure.

Required journey:

```text
Import MD/TXT
→ SourceVersion + ParsedArtifact
→ publish
→ FTS retrieval
→ frozen GenerationRun
→ DeliveredEvidence
→ Answer/CitationRef
→ Source update/reindex
→ old citation reopens historical content
→ index GC
→ backup
→ restore canonical history
→ rebuild usable retrieval index
→ old citation still resolves
```

Restore guarantees canonical history/integrity and a rebuildable usable index; it does not promise byte-identical reproduction of all SQLite/index/runtime details. Include failure injection around blob/artifact write, SQLite metadata, publication, IndexBuild, job completion and Answer commit where relevant.

## 12. SLICE A PASS

Slice A PASS is a Product Milestone. It requires:

- Reliable Knowledge, Grounded Ask Backend/UI and Lifecycle Safety outcomes;
- the complete Production E2E / Backup Restore journey;
- host-authoritative Workspace/worktree regression evidence;
- all mandatory verification debt for this gate resolved or explicitly removed by an intentional architecture/plan decision;
- milestone report, roadmap/changelog update and verification status.

## 13. Quiz Generate

Goal:

> Generate the first long-lived derived resource from canonical Knowledge.

Minimum domain:

```text
DerivedArtifact
└── immutable ArtifactRevision
```

Generation creates a candidate Quiz revision with Evidence dependencies and sufficient SourceVersion/ParsedArtifact, generator, model/provider and configuration provenance. It must reuse the canonical GenerationRun/evidence primitives rather than create a parallel Knowledge stack.

Quiz Preview may be recorded when a user can generate and inspect a candidate with its evidence, before the full lifecycle is accepted.

## 14. Quiz Lifecycle

Goal:

> Preserve user intent and history through acceptance, editing, regeneration and source change.

Required semantics:

```text
dependency policy: pinned | follow-current
freshness: current | needs-review
```

- accepting a candidate advances accepted state without rewriting historical revisions;
- user edits remain immutable history;
- stale candidate acceptance cannot overwrite newer edits;
- regeneration never silently replaces accepted content;
- `follow-current` marks `needs-review` after a published dependency change;
- `pinned` remains bound to historical dependencies until explicitly changed.

## 15. Quiz E2E and P3 PASS

Required journey:

```text
published Knowledge
→ generate Quiz candidate
→ inspect Evidence
→ accept
→ user edit
→ Source publication changes
→ needs-review
→ regenerate candidate
→ compare
→ accept or discard without overwriting history
→ restart/reopen same accepted revision and citations
```

P3 PASS requires the Quiz journey, cross-slice integration, relevant historical verification debt and a formal milestone report/roadmap/changelog update. P3 PASS does not require every future Studio resource type.

## 16. Later roadmap

### P4 — Product hardening / release

- explicit operational error-state UX;
- systemd/user-service packaging and supported install/update/rollback guidance;
- structured observability without source-body or credential leakage;
- representative performance/resource measurement;
- failure injection and schema migration rehearsal;
- upstream PI WEB sync rehearsal;
- closure of mandatory P0/P1 verification debt for release scope;
- product-value comparison against direct-file Pi.

### P5 — Broader derived resources

Reuse the canonical SourceVersion/Evidence/ArtifactRevision lineage and replaceable adapters for Interview, Flashcards, Study Guide, Summary/Report and later justified formats. Do not add a graph database, generic workflow DSL, multi-agent orchestration framework, dedicated resource microservice or Qdrant dependency without concrete evidence.

## 17. Parallelization and Git authority

Safe parallelism follows stable contracts:

- use one isolated worktree per Agent; never concurrently edit one working tree;
- UI work may overlap backend work after API/domain contracts are stable;
- fixtures, API types, UI components, runtime validation, migration tests, small wiring, touched-file lint and verification execution may proceed as independent work units;
- do not let parallel Agents independently redefine publication identity, migration semantics, transaction boundaries, fencing or retention;
- integrate work units through the Product Slice Lead using a safe non-destructive Git method;
- keep Product Slice Draft PRs unmerged until the owner authorizes merge order.

No autonomous PR merge, force-push, destructive reset or unsafe history rewrite is allowed.

## NEXT

```text
Reliable Knowledge
→ Grounded Ask Backend
```
