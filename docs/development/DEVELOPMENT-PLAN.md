# Pi Knowledge Workspace — Complete Development Plan

Status: **Active Development Baseline**  
Repository: `CoderLambert/pi-knowledge-workspace`  
Strategy: **Thin Fork + standalone pi-knowledge process**  
Architecture baseline: **ADR-029 Accepted**  
Current base branch: `experiment/p2-retrieval-adr`

This document is the authoritative forward-looking task plan. Historical implementation detail remains available in Git history, task reports, verification guides and `CHANGELOG.md`; this file is intentionally rebaselined after ADR-029 so future development follows the accepted canonical-domain boundary rather than the pre-ADR task decomposition.

`PHASES.md` defines phase goals and gates. This document defines the current task order, dependencies, deliverables and acceptance expectations.

Every behavior-changing task must also follow:

- [`REPORTING.md`](./REPORTING.md) — repository implementation report;
- [`VERIFICATION.md`](./VERIFICATION.md) — human/user verification guide;
- [`AUTONOMOUS-EXECUTION.md`](./AUTONOMOUS-EXECUTION.md) — deferred user verification policy;
- [`BRANCH-HYGIENE.md`](./BRANCH-HYGIENE.md) — stacked-PR and branch discipline.

A task is not complete merely because code exists.

---

# 1. Global execution rules

## 1.1 Status vocabulary

Only these task statuses are used:

- **PASS** — required implementation/evidence for the task is complete.
- **PARTIAL** — implementation exists, but required acceptance evidence remains open.
- **BLOCKED** — the task cannot safely continue without changing a dependency/architecture assumption or requiring unavailable authority.

Do not use “implementation complete” as a synonym for PASS.

## 1.2 Task lifecycle

```text
inspect latest branch / PR / CI / accepted ADRs
→ verify the plan still matches repository reality
→ select one dependency-safe task
→ create one branch + Draft PR for one concern
→ implement minimal scope
→ run available automated/static checks
→ write/update development report
→ write/update verification guide for behavior changes
→ record external-only user verification debt without demanding immediate participation
→ classify PASS / PARTIAL / BLOCKED
→ update plan/changelog when the project state changes
```

## 1.3 Deferred user verification

When remaining checks require the user's local machine, browser, Fleet/multi-instance environment, hardware, system services or manual acceptance:

1. keep the task PARTIAL when those checks are required for PASS;
2. record exact steps in `VERIFICATION-DEBT.md` and the task verification guide;
3. continue later work only when dependency-safe;
4. never fabricate acceptance evidence;
5. batch user verification later when convenient.

Repository CI/typecheck/test failures that can be fixed autonomously are **implementation debt**, not user verification debt.

## 1.4 Development discipline

1. Keep Project / Workspace / Path / Machine routing host-authoritative.
2. Keep Knowledge processing outside sessiond; the PI WEB plugin remains a thin adapter.
3. Prefer upstream/public PI WEB seams over core patches.
4. One task per branch and Draft PR; stacked PRs are allowed for unmerged dependencies.
5. No automatic merge.
6. No force-push or casual history rewrite; restacks use ordinary merge commits unless a later explicit exception is approved.
7. Do not mutate frozen P2 evidence to improve scores.
8. Holdout remains one-shot aggregate evidence; no holdout tuning or per-query diagnostics for optimization.
9. Do not add framework abstractions without a concrete need.
10. Architecture changes require ADR review; implementation tasks must not silently redefine ADR-029.

---

# 2. Accepted architecture baseline — ADR-029

The following contracts are frozen for P3 unless new evidence explicitly reopens the ADR.

## 2.1 Canonical ownership

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

## 2.2 Source publication semantics

Captured content and published Knowledge are separate states.

A published selection must identify the concrete interpretation used by Knowledge:

```text
SourceVersion
+ ParsedArtifact
+ publication generation
```

Parsing/indexing failure keeps the previous publication usable. A→B→A must not depend on `createdAt` ordering.

## 2.3 ParsedArtifact identity

ParsedArtifact is immutable. Changes to parser/schema/normalization/material parser configuration create a new artifact identity rather than mutating an old interpretation.

V1 remains Markdown/TXT. PDF/DOCX/PPTX/OCR/layout work is future parser-adapter scope, not required for the P3 production closure.

## 2.4 Evidence and citations

Evidence is anchored to canonical immutable content and is independent of retrieval chunks/index rebuilds.

Historical citations must reopen historical content. Ordinary index GC, reparse or Source update must not silently redirect a retained citation to newer content.

`CitationRef -> Evidence` is the V1 citation identity. Do not create a second competing citation aggregate unless a real UI/provider requirement proves necessary.

## 2.5 Frozen generation scope

A GenerationRun freezes its canonical scope/publication/retrieval snapshot before first retrieval. Later tool calls in the same run must not silently reacquire “latest”. Snapshot loss fails closed.

`DeliveredEvidence` records the ordered canonical spans actually submitted to each model invocation/attempt after application-side trimming/dedup/serialization.

## 2.6 Retention

Retained Answers / ArtifactRevisions keep the canonical closure required to reopen their citations:

```text
CitationRef
→ Evidence
→ ParsedArtifact
→ SourceVersion
```

Retrieval-index retention is separate and disposable after active run/build protection permits GC.

`archive != purge`.

## 2.7 Worker fencing

Losing a lease/fencing right must prevent the stale worker from publishing any user-visible state, including Source publication, active IndexBuild, Answer or accepted ArtifactRevision.

A handler returning successfully after losing ownership is not sufficient authority to commit business state.

## 2.8 V1 retrieval

Accepted V1 retrieval configuration:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10 default
```

Top-K is a provider/evaluation default, not a canonical-domain invariant.

Do not adopt Dense / sqlite-vec / Hybrid / RRF / Qdrant / reranking / late interaction in V1 without new frozen evidence showing material net benefit.

---

# 3. Phase overview after rebaseline

```text
P0  Integration / security / process boundary       PARTIAL acceptance debt
 ↓
P1  Stable Evidence Core                            PARTIAL acceptance debt
 ↓
P2  Retrieval Evaluation + ADR-029                 PASS decision gate
 ↓
P3  Production Knowledge Closure + Grounded Generation + first Derived Resource
 ↓
P4  Product hardening / release validation
 ↓
P5  Broader derived-resource/product expansion
```

P0/P1 historical acceptance debt remains real and must be closed before release gates that depend on it, but it does not invalidate the accepted P2 architecture decision or block dependency-safe P3 implementation.

---

# 4. Historical phase status summary

## P0 — Integration Boundary

Current phase status: **PARTIAL**.

Accepted foundations include the Knowledge workspace surface and standalone `pi-knowledge` process contract. P0-T04..T08 still have mandatory executable/local/Fleet/runtime verification debt recorded in `VERIFICATION-DEBT.md`.

Do not duplicate Machine/Workspace/federation infrastructure in P3.

## P1 — Stable Evidence Core

Current phase status: **PARTIAL**.

Implementation progressed through the durable Source/SourceVersion, safe capture, ParsedArtifact, Evidence/viewer, FTS/index publication, durable-job and backup work. Individual tasks retain their recorded PARTIAL/PASS status in task reports/changelog/verification debt. P3 must reuse these foundations instead of rebuilding them as a second domain stack.

Known production gaps that ADR-029 explicitly promotes into P3 include:

- captured vs published Source selection;
- durable ParsedArtifact identity beyond `(source_version_id, parser_version)`;
- production publication consistency across canonical selection and retrieval snapshot;
- run-level frozen scope rather than per-query latest-build acquisition;
- persistent Answer/CitationRef owner;
- business-commit fencing;
- complete canonical backup/restore closure.

## P2 — Retrieval Evaluation

Current phase status: **PASS for the architecture/retrieval decision gate**.

### P2-T10 — Direct-file Pi baseline

**Status: PASS**.

The direct-file baseline established high answer quality when correct context is available and exposed the no-answer/negative-evidence boundary separately from retrieval quality.

### P2-T11 — Existing product comparison

**Status: PASS — DECISION-SUFFICIENT EVIDENCE**.

AnythingLLM fixed-version evidence established mature generic local RAG viability, including the tested historical-citation durability path and formal development run. The full Open WebUI long benchmark was intentionally de-scoped after the architecture question split into Pi-owned canonical Knowledge semantics vs replaceable retrieval/RAG infrastructure. Partial Open WebUI diagnostics are preserved and are not tuned/retried/scored for the P2 decision.

### P2-T12 — Retrieval ADR

**Status: PASS — ADR-029 ACCEPTED**.

Decision:

> Pi owns the knowledge truth and long-lived lineage. Files, parsers, indexes, models and external RAG systems are replaceable inputs, projections or adapters.

P3 is now authorized against this contract.

---

# 5. P3 — execution order

P3 is no longer the old linear “Ask then separate Notes subsystem” plan. It is organized as a production-closure slice followed by the first long-lived derived resource.

## P3-T00 — Planning Rebaseline

**Status: PASS.**

Objective:

- align `DEVELOPMENT-PLAN.md`, `PHASES.md` and `CHANGELOG.md` with ADR-029;
- retire the stale pre-ADR P3 task order;
- define P3-T01, Slice A and Slice B without production changes.

This task is analysis/documentation only; no verification guide is required.

---

## P3-T01 — Pre-P3 baseline closure

**Status: PARTIAL — TypeScript blocker closed; inherited ESLint baseline remains.**

Objective:

> Remove the inherited Knowledge static/test debt from the P3 base so new regressions have a trustworthy signal.

Current verified baseline:

```text
P3-T01 typecheck blocker: 12 errors → 0
P3-T01S1 plugin-test lint slice: 261 ESLint errors → 254
P3-T01S2 runtime-contract lint slice: 254 ESLint errors → 252
P3-T01S3 core-storage-test lint slice: 252 ESLint errors → 247
P3-T01S4 storage-harness lint slice: 247 ESLint errors → 242
P3-T01S5 storage-test-harness lint slice: 242 ESLint errors → 233
P3-T01S6 UTF-8-range-test lint slice: 233 ESLint errors → 227
P3-T01S7 Workspace-identity-test lint slice: 227 ESLint errors → 222
P3-T01S8 selected-Machine-federation-test lint slice: 222 ESLint errors → 219
```

The remaining ESLint findings are inherited across pre-existing Knowledge/plugin code. They must be closed in bounded, subsystem-scoped support slices; do not turn P3-T01 into one repository-wide rewrite.

Scope rules:

- fix only the known baseline defects or directly exposed equivalents;
- do not change ADR semantics;
- do not mix product features;
- compare failures against the accepted P2 base before classifying regressions;
- do not “fix CI” by changing unrelated tests or frozen evidence.

Required exit:

- `npm run typecheck` remains green;
- inherited lint/static debt is reduced through reviewable support slices until Slice A gets a trustworthy regression signal;
- focused Knowledge tests covering touched areas pass when reachable;
- any remaining full-suite failure is classified against baseline;
- report + verification guide are present for behavior-changing support work.

---

# 6. P3 Slice A — Production Knowledge Closure

Goal:

> Make the accepted canonical Knowledge contracts real in the production path for Markdown/TXT before adding broad new product features.

Slice A may be multiple sequential stacked PRs. Each task remains independently reviewable.

## P3-A01 — Captured vs published Source state

Implement explicit publication semantics.

Requirements:

- latest captured content may exist without becoming published;
- published selection binds concrete SourceVersion + ParsedArtifact + monotonic publication generation;
- parse/index failure preserves the previous published selection;
- byte-identical A→B→A reuse cannot make timestamp ordering define current state;
- host-authoritative Workspace isolation remains enforced.

Acceptance scenarios:

- successful A→B publication;
- failed B leaves A published;
- A→B→A chooses the intended publication generation;
- out-of-order completion cannot overwrite newer intent.

## P3-A02 — ParsedArtifact durable identity migration

Replace the temporary identity assumption that `(source_version_id, parser_version)` fully describes an artifact.

Identity must distinguish material interpretation changes, including parser/schema/normalization/config revisions as required by the accepted contract.

Requirements:

- old ParsedArtifacts remain immutable and readable;
- multiple artifacts for one SourceVersion can coexist;
- migration is backward-safe/fail-closed;
- historical Evidence remains anchored to its original artifact.

## P3-A03 — Publication manifest / retrieval snapshot consistency

Create the production publication boundary that makes the canonical selection and active retrieval snapshot consistently consumable.

The implementation may use a SQLite transaction, manifest/pointer model, or an equivalent repository-native mechanism; the ADR does not require one particular table layout.

Requirements:

- candidate build validates before publication;
- stale candidate cannot publish over a newer generation;
- failed publication cannot expose half-new canonical state;
- retrieval index remains a rebuildable projection, not canonical identity.

## P3-A04 — Business-commit worker fencing

Extend the durable job lease/fencing model to user-visible commits.

A stale worker must be unable to publish:

- Source current publication;
- active retrieval build;
- Answer;
- accepted ArtifactRevision;
- any equivalent user-visible current pointer.

Acceptance must include a worker losing its lease while the handler continues and later returns success; the final business commit must still be rejected.

## P3-A05 — GenerationRun + frozen ScopeManifest

Persist a GenerationRun that freezes scope before first retrieval.

At minimum bind:

```text
knowledgeWorkspaceId
publication/scope generation
selected SourceVersion ids
selected ParsedArtifact ids
retrieval snapshot/build identity
retrieval config revision
model/provider revision
prompt/tool-policy revision where applicable
```

Rules:

- later Source publication does not mutate the run;
- subsequent search/read calls use the same frozen snapshot;
- snapshot loss fails closed rather than reacquiring latest;
- active run retention protects what the run needs.

## P3-A06 — DeliveredEvidence provenance

Record per model invocation/attempt the canonical Evidence spans actually delivered after application-side context shaping.

Store enough deterministic provenance to explain:

- ordered Evidence;
- trimming/dedup result;
- rendered/serialized context revision where material;
- invocation/attempt association.

Do not claim DeliveredEvidence proves what the model semantically used.

## P3-A07 — Persistent Answer / CitationRef

Add the first production Grounded Answer owner.

Requirements:

- immutable answer revisions or equivalent durable history;
- CitationRef resolves to Evidence used within the corresponding delivered generation process;
- historical click opens the original SourceVersion/ParsedArtifact;
- missing/purged history is explicit, never silently redirected;
- citation integrity and semantic support remain separate concepts.

## P3-A08 — Canonical retention + archive/purge

Implement retention closure independently of index GC.

A retained Answer/ArtifactRevision must keep the canonical chain needed for historical citation reopening.

Rules:

- archive removes default/current use without destroying retained history;
- purge is explicit destructive intent;
- old unreferenced indexes may be GC'd independently;
- active GenerationRuns and backup operations protect required objects while in progress.

## P3-A09 — Crash/retry consistency

Exercise interruption boundaries across:

```text
blob/artifact bundle write
SQLite metadata
Source publication
IndexBuild publication
job completion
Answer commit
```

The system must recover to an explicit valid state and never report success for a half-published fact.

Retries may create/dedupe immutable objects, but current/user-visible state transitions require valid fencing/generation authority.

## P3-A10 — Backup/restore + production E2E

Close the Markdown/TXT production path:

```text
Import
→ SourceVersion
→ ParsedArtifact
→ publish
→ FTS retrieval
→ frozen GenerationRun
→ DeliveredEvidence
→ Answer/CitationRef
→ Source update/reindex
→ old citation reopen
→ index GC
→ backup
→ restore
→ rebuild usable retrieval index
→ old citation still resolves
```

Restore means canonical history/integrity is restored and a usable index can be rebuilt from versioned canonical content/config. It does not promise byte-identical reproduction of every SQLite/index/runtime detail.

Slice A PASS requires this real path to close, plus regression gates for host-authoritative Workspace/worktree behavior.

---

# 7. P3 Slice B — First Derived Resource

Goal:

> Prove the canonical lineage model supports a long-lived generated resource, not merely ephemeral chat.

Implement exactly one first resource type: **Quiz or Interview**. Do not build a broad Studio catalog in the first slice.

## P3-B01 — DerivedArtifact + immutable ArtifactRevision

Minimum domain:

```text
DerivedArtifact
└── immutable ArtifactRevision
```

Required semantics:

```text
dependency policy: pinned | follow-current
freshness: current | needs-review
```

`current` means freshness policy satisfied, not “semantically proven correct”.

## P3-B02 — Candidate / accept / user edit

Generation creates a candidate revision. Accepting it creates/advances the accepted revision without overwriting historical revisions.

Requirements:

- user edits are preserved as immutable history;
- stale concurrent candidate acceptance cannot overwrite newer user edits;
- regeneration never silently replaces accepted content.

## P3-B03 — Evidence/provenance binding

The accepted/candidate revision records the canonical lineage required to audit the generated resource:

- Evidence dependencies;
- SourceVersion / ParsedArtifact lineage where required;
- generator identity/version;
- model/provider/config provenance sufficient for reproducibility analysis.

Do not require every future artifact field to have a separate citation relation until a real product need proves it.

## P3-B04 — Source update → review behavior

For `follow-current`, a change in the published SourceVersion/ParsedArtifact selection marks the resource `needs-review`; it does not silently regenerate or overwrite the accepted revision.

For `pinned`, the resource remains bound to its historical dependency until the user explicitly changes policy/dependencies.

## P3-B05 — First Derived Resource E2E

Required path:

```text
published Knowledge
→ generate Quiz OR Interview candidate
→ inspect Evidence
→ accept
→ user edit
→ Source publication changes
→ needs-review
→ regenerate candidate
→ compare
→ accept/discard without overwriting history
→ restart/reopen same accepted revision and citations
```

Slice B PASS is the first proof that Pi's canonical-domain ownership provides product value beyond generic RAG chat.

---

# 8. Grounded Ask / Notes after Slice A/B

The old P3-T01..T20 plan treated Ask and Notes as separate revision systems. That decomposition is superseded.

After Slice A and the first Derived Resource validate the canonical model, continue product work by reusing shared primitives:

```text
GenerationRun
DeliveredEvidence
Answer/CitationRef
DerivedArtifact/ArtifactRevision where appropriate
shared optimistic-concurrency/revision semantics
```

Do not automatically introduce separate `note_revisions`, `answer_revisions` and `artifact_revisions` models with incompatible lifecycle semantics. Decide whether Notes are a DerivedArtifact type or a distinct user-authored entity only when the concrete UI/edit/export requirements demand the distinction.

Future Ask UI still needs:

- source/version selection;
- provider/model/data-disclosure information;
- progress and insufficient-evidence state;
- citations;
- historical source reopening;
- explicit distinction between citation integrity and semantic support.

---

# 9. P4 — Product Hardening / Release

P4 begins only after the supported P3 product loop is coherent.

Required themes:

- explicit operational error-state UX;
- systemd/user-service packaging where appropriate;
- installation/update/rollback documentation;
- structured observability without source-body/credential leakage;
- representative performance/resource benchmark;
- failure injection;
- schema migration rehearsal;
- backup/restore rehearsal;
- upstream PI WEB sync rehearsal;
- real task comparison against the direct-file Pi baseline;
- closure of mandatory P0/P1 verification debt for release scope.

Release gates remain strict: no known correctness failure in supported scope, historical citations survive supported lifecycle operations, backup/restore works, and the product demonstrates value beyond handing files directly to Pi.

---

# 10. P5 — Broader Derived Resources

After the first Derived Resource and core Knowledge usage are validated, expand through the same ArtifactGenerator/domain contracts rather than separate service stacks.

Candidate resource types include:

- Quiz;
- Interview questions;
- Flashcards;
- Study Guide;
- Summary / Report;
- course/learning resources;
- later Mind Map / Slides when product value and rendering requirements justify them.

Do not add a graph database, generic workflow DSL, multi-agent orchestration framework or dedicated resource microservice without concrete evidence.

Parser expansion (Docling or alternatives) remains adapter work behind Pi-owned Document/ParsedArtifact semantics.

---

# 11. Critical path

```text
P2-T12 ADR-029 Accepted
        ↓
P3-T00 Planning Rebaseline
        ↓
P3-T01 Baseline Closure
        ↓
P3-A01 Captured/Published
→ P3-A02 ParsedArtifact Identity
→ P3-A03 Publication/Snapshot Consistency
→ P3-A04 Business Fencing
→ P3-A05 Frozen GenerationRun
→ P3-A06 DeliveredEvidence
→ P3-A07 Answer/CitationRef
→ P3-A08 Canonical Retention
→ P3-A09 Crash/Retry Consistency
→ P3-A10 Backup/Restore Production E2E
        ↓
P3 Slice A PASS
        ↓
P3-B01..B05 First Derived Resource
        ↓
P3 Slice B PASS
        ↓
Ask/Notes/product UX expansion using shared domain primitives
        ↓
P4 release hardening
        ↓
P5 broader resources
```

P0/P1 acceptance debt remains a parallel closure stream and must be resolved before any release gate that requires it.

---

# 12. Parallelization rules

Safe parallelism is limited by shared durable contracts.

- UI/read-only work may overlap after its backing API/schema is stable.
- Tests/verification for an already frozen interface may be stacked independently.
- Do not parallelize two tasks that both redefine Source publication, ParsedArtifact identity or run-retention semantics.
- Do not begin Slice B before Slice A has a stable persisted canonical lineage path sufficient for ArtifactRevision dependencies.
- User-local verification debt may be batched later and does not require the user to stay involved in each development task.

---

# 13. PR guidance

Recommended naming:

```text
docs/p3-...
chore/p3-...
feat/p3-...
test/p3-...
chore/p4-...
feat/p5-...
```

One concern per PR. Keep Draft PRs unmerged until the owner explicitly chooses merge order.

Do not delete open-PR branches.

---

# 14. Current project position

As of 2026-09-10:

| Area | Status | Current fact |
|---|---|---|
| P0 | PARTIAL | Core boundary viable; mandatory local/Fleet/runtime verification debt remains. |
| P1 | PARTIAL | Evidence/storage/index/job foundations exist; production closure and historical lifecycle acceptance remain incomplete. |
| P2-T10 | PASS | Direct-file Pi baseline accepted. |
| P2-T11 | PASS | Mature-product evidence is decision-sufficient; full Open WebUI long run de-scoped with audit trail. |
| P2-T12 | PASS | ADR-029 Accepted. |
| P2 stack | PASS | Final ancestry restack is clean; #54 and #44 include latest #43 with task-only scopes. |
| P3-T00 | PASS | Rebaseline plan to ADR-029. |
| P3-T01 | PARTIAL | Typecheck is green; inherited ESLint baseline reduced from 261 to 219 through bounded support slices. |

Current architecture/development base:

```text
experiment/p2-retrieval-adr
81a06a6700c80b63ad796cdfbeee5a49a5c939cd
```

Current next implementation task:

# **Continue P3-T01 bounded inherited lint closure**

No P3 production feature should bypass this task's regression-signal cleanup unless a new blocker/evidence requires the plan to be re-reviewed.