# Pi Knowledge Workspace — Complete Development Plan

Status: **Active Development Baseline**  
Repository: `CoderLambert/pi-knowledge-workspace`  
Rebased: **2026-09-10 after ADR-029 acceptance**  
Strategy: **Thin Fork + standalone pi-knowledge process + Pi-owned canonical Knowledge domain**  
V1 product loop: **Source → Published Knowledge → Frozen Grounded Generation → Answer/Citation → First Derived Resource**

This document is the authoritative task-level development plan.

`PHASES.md` defines phase goals and gates. This document defines the current execution order, task boundaries, verification expectations, and the accepted architecture constraints that later work must preserve.

Historical implementation detail belongs in `docs/development/reports/`. Deferred user/environment verification belongs in `docs/development/VERIFICATION-DEBT.md`. When this plan conflicts with an Accepted ADR, the ADR wins and this plan must be corrected before further implementation.

---

# 1. Global execution rules

## 1.1 Task lifecycle

```text
Plan task
→ inspect current code and current stacked base
→ implement minimal scope
→ automated tests
→ static/build verification available to the execution environment
→ development report
→ human verification guide for behavior-changing work
→ record unavailable local/manual checks as explicit verification debt
→ continue dependency-safe work
→ update plan/changelog/debt when reality changes
→ PASS / PARTIAL / BLOCKED
```

## 1.2 Status vocabulary

Only use:

- **PASS** — required implementation and acceptance evidence for the task are complete.
- **PARTIAL** — implementation/evidence exists but required acceptance debt remains.
- **BLOCKED** — the task cannot safely proceed under the current architecture/dependency state.

Do not invent substitute status labels for task acceptance.

## 1.3 Autonomous development policy

1. Complete everything that can be verified automatically without user involvement.
2. Local browser, Fleet/multi-instance, hardware, OS-service, credentials, or genuinely human semantic checks are recorded in `VERIFICATION-DEBT.md` instead of interrupting the user.
3. Deferred verification does not lower PASS standards.
4. Dependency-safe later work may continue while earlier tasks remain PARTIAL, but later tasks must not claim unverified assumptions as accepted evidence.
5. Phase/release gates remain strict.

## 1.4 Branch / PR discipline

- one task / one branch / one Draft PR;
- stacked PRs for unmerged dependencies;
- no automatic merge;
- no force-push;
- no casual rebase/history rewrite;
- no unrelated cleanup mixed into task scope;
- preserve frozen P2 evidence and holdout discipline;
- inherited baseline failures are classified, not silently repaired inside unrelated tasks.

## 1.5 Accepted architecture constraints

ADR-029 is **ACCEPTED** and is normative for P3+.

Pi owns:

```text
KnowledgeWorkspace / host-authoritative workspace scope
Source
immutable SourceVersion
immutable ParsedArtifact carrying versioned DocumentIR
Stable Evidence anchored to immutable ParsedArtifact content
Knowledge publication / published selection generation
GenerationRun / frozen ScopeManifest / retrieval snapshot
DeliveredEvidence per model invocation/attempt
Answer / CitationRef -> Evidence
DerivedArtifact / immutable ArtifactRevision
provenance / dependency policy / freshness state
canonical retention closure
```

Retrieval is a rebuildable projection. V1 retrieval remains:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10 default
```

Dense / Hybrid / Qdrant / reranking / external RAG are not V1 production dependencies unless new frozen evidence justifies reopening the decision.

---

# 2. Phase overview

```text
P0  Integration / security / process boundary
 ↓
P1  Stable Evidence Core
 ↓
P2  Retrieval Evaluation + architecture decision
 ↓
P3  Production Knowledge Closure + Grounded Generation + First Derived Resource
 ↓
P4  Product hardening / release validation
 ↓
P5  Broader derived-resource product expansion
```

Current handoff:

```text
P2-T11 PASS
P2-T12 PASS
ADR-029 ACCEPTED
stack ancestry clean
→ Planning Rebaseline
→ P3-T00 baseline closure
→ P3 Slice A
→ P3 Slice B
```

---

# 3. P0 — Integration Boundary

Goal:

> Prove Knowledge can be a first-class Workspace capability while reusing PI WEB's existing plugin, Machine, Workspace and federation infrastructure and keeping heavy Knowledge work outside sessiond.

Historical task set:

```text
P0-T01 Integration Seam Analysis                         PASS
P0-T02 Knowledge bundled paired-plugin skeleton        PASS
P0-T03 standalone pi-knowledge process/contract        PASS
P0-T04 thin server-plugin adapter                      PARTIAL
P0-T05 local integration E2E                           PARTIAL
P0-T06 selected-Machine/Fleet routing verification     PARTIAL
P0-T07 restricted Pi runtime probe                     PARTIAL
P0-T08 P0 gate review                                  PARTIAL
```

The remaining P0 PARTIAL states are acceptance/verification debt, not permission to redesign the integration boundary. Exact outstanding checks remain in `VERIFICATION-DEBT.md`.

Locked P0 invariants:

- host-authoritative Project / Workspace / Path;
- browser cannot spoof authoritative scope;
- selected Machine owns Knowledge execution;
- no gateway-local fallback when target Knowledge is unavailable;
- existing Files / Terminal / Git / Chat behavior remains upstream-first;
- heavy parsing/retrieval/model work stays outside sessiond;
- restricted generation runtime must not acquire shell/filesystem/network authority beyond its explicit Knowledge contract.

---

# 4. P1 — Stable Evidence Core

Goal:

> Preserve canonical historical Knowledge and Evidence independently of retrieval indexes and model quality.

Existing implementation foundation includes Source/SourceVersion, CAS, MD/TXT ParsedArtifact canonicalization, Stable Evidence/range validation, SQLite FTS5, Source/Evidence Viewer, durable jobs, IndexBuild publication/retention, and backup work. These remain valuable and are evolved rather than replaced.

Historical task family:

```text
P1-T01..T20  implementation/evidence exists in repository reports;
             multiple tasks remain PARTIAL because native/runtime/browser/Fleet/
             backup/restore acceptance debt is still open.

P1-T21       restore closure remains part of the production recovery path.
P1-T22       end-to-end Evidence durability remains a release-quality gate.
```

Do not use stale task text from older revisions to infer missing architecture. The authoritative current architecture is ADR-029.

P1 capabilities that P3 must preserve or tighten:

- immutable SourceVersion bytes and content hashes;
- immutable ParsedArtifact history;
- Evidence independent of retrieval chunk identity;
- explicit IndexBuild publication and retained-query protection;
- durable job lease/fencing core;
- backup based on canonical state, not mutable live paths;
- historical viewer never redirects old Evidence to latest content.

Known P1 implementation gaps now assigned to P3 Slice A include:

- implicit current selection/time ordering;
- incomplete ParsedArtifact interpretation identity;
- production durable ParsedArtifact wiring;
- query-local lifecycle instead of frozen GenerationRun lifetime;
- business-commit fencing beyond terminal job completion;
- full canonical retention/backup/restore closure.

---

# 5. P2 — Retrieval Evaluation and Architecture Decision

Goal:

> Select V1 retrieval from evidence and freeze the ownership boundary before product generation work.

## P2-T01..T09 — Retrieval evidence foundation

**Status:** PASS where recorded by their task evidence; frozen evidence must not be retuned retrospectively.

Key result:

```text
SQLite FTS5 development
Recall@10 = 1.0
MRR = 0.9365079365079365
all-required Evidence coverage = 1.0
```

Expanded and one-shot holdout evidence also preserved Recall@10/coverage = 1.0.

Tested Dense E5/MiniLM candidates regressed the FTS comparator and are not justified for V1.

## P2-T10 — Direct-file Pi baseline

**Status:** PASS

Independent semantic adjudication:

```text
48 correct
0 partial
2 incorrect
0 material version/conflict mistakes
0 material Evidence omissions
```

The remaining failures are primarily no-answer/negative-evidence grounding issues, not evidence that retrieval recall is inadequate.

## P2-T11 — Existing product comparison

**Status:** PASS — decision-sufficient evidence

AnythingLLM fixed-version evidence established strong generic local RAG viability and one durable historical citation path. Formal run: 47/50 first-attempt success; all 39 successful answerable responses were semantically correct under independent review. No-answer discipline and raw reasoning-tag sanitization remain weaknesses.

The full Open WebUI 50-query benchmark is intentionally de-scoped. Partial diagnostics are preserved but are not scored, retried, tuned, or required for the architecture decision.

Architecture consequence:

> Mature products demonstrate that Pi does not need to reinvent generic RAG merely because existing products are weak. They do not establish Pi's canonical SourceVersion/Evidence/DerivedArtifact lifecycle semantics.

## P2-T12 — ADR-029

**Status:** PASS — ADR-029 ACCEPTED

Final decision:

> **Pi owns the knowledge truth and long-lived lineage. Files, parsers, indexes, models and external RAG systems are replaceable inputs, projections or adapters.**

P2 is closed for architecture decision purposes. Do not restart retrieval selection during P3 unless a declared ADR-029 upgrade trigger is actually met.

---

# 6. P3 — Production Knowledge Closure and Grounded Generation

Goal:

> Turn ADR-029's accepted canonical contracts into a reliable production path before broadening product features.

Initial input scope remains **Markdown/TXT**. Do not add Docling/PDF/Qdrant/Dense/Hybrid/reranking/MCP/external-RAG production dependencies during Slice A.

## P3-T00 — Baseline closure

**Status:** TODO

### Objective

Restore a trustworthy regression signal before Slice A by closing the currently inherited Knowledge-specific static/test debt without changing architecture or adding product scope.

Known baseline failures include TypeScript/test issues in:

```text
src/knowledge/service/viewerDispatch.ts
src/knowledge/storage/chunker.test.ts
src/knowledge/storage/evidence.test.ts
src/knowledge/storage/sourceEvidenceViewer.test.ts
```

### Requirements

- fix only the known task-attributable baseline defects;
- no architecture changes;
- no retrieval retuning;
- no dependency upgrades unless strictly required for the exact failures;
- preserve P2 results and ADR-029 contracts;
- record any remaining unrelated/inherited failures separately.

### Exit

At minimum:

```text
npm run typecheck
focused Knowledge tests covering the touched files
```

must pass. Broader CI failures must be classified by actual signature rather than assumed inherited.

---

# 7. P3 Slice A — Canonical Production Closure

Slice A may be implemented as multiple ordered Draft PRs. Slice A is not PASS until the end-to-end production closure is complete.

## P3-A01 — Captured / Published Source semantics

**Status:** TODO

Implement explicit separation between:

```text
latest captured content
published usable Knowledge selection
```

Published selection must bind explicit SourceVersion + ParsedArtifact + publication generation. Capture/parse/index failure keeps the previous publication usable. A→B→A must not rely on timestamp ordering.

Acceptance includes out-of-order asynchronous completion that cannot overwrite newer publication intent.

## P3-A02 — ParsedArtifact interpretation identity migration

**Status:** TODO

Allow multiple immutable ParsedArtifacts for one SourceVersion when parser/schema/normalization/config changes interpretation.

Identity must account for conceptually:

```text
sourceVersionId
parser identity/version
DocumentIR/schema version
normalization identity/version
parser/normalization config digest
```

Old artifact identity/content remains immutable and historically reopenable.

## P3-A03 — Publication generation + retrieval snapshot boundary

**Status:** TODO

Publish canonical SourceVersion/ParsedArtifact selection consistently with the active retrieval snapshot for the same generation.

The physical representation may be a transaction, manifest, or equivalent state. Do not make retrieval IDs canonical domain identity.

Failure keeps the previous published generation active.

## P3-A04 — Business-commit worker fencing

**Status:** TODO

Extend durable job fencing so a worker that lost lease/execution ownership cannot publish:

- Source current/published selection;
- active IndexBuild/retrieval snapshot;
- Answer;
- accepted Artifact candidate;
- any other user-visible state.

Lease validation must be part of the conditional/transactional business commit, not only a post-handler check.

## P3-A05 — GenerationRun + frozen ScopeManifest

**Status:** TODO

Create a durable GenerationRun lifecycle. Before first retrieval freeze and protect:

```text
host-authoritative Workspace scope
publication/scope manifest
retrieval snapshot / active build
versioned retrieval configuration
```

Every later retrieval/tool call in the same run uses the same snapshot. Publication/parser changes during a run cannot silently switch scope. Snapshot loss fails closed.

## P3-A06 — DeliveredEvidence provenance

**Status:** TODO

Record per model invocation/attempt the ordered canonical Evidence spans actually submitted after filtering, dedupe, expansion, budget trimming and serialization.

DeliveredEvidence records what Pi sent, not what the model semantically used.

## P3-A07 — Persistent Answer / CitationRef

**Status:** TODO

Add a persistent Answer owner and immutable revision semantics sufficient for historical reopening.

Citation contract:

```text
CitationRef -> Evidence -> ParsedArtifact -> SourceVersion
```

Final citations must resolve to Evidence available through the corresponding generation process. Citation existence/integrity is distinct from semantic support.

## P3-A08 — Canonical retention + archive/purge

**Status:** TODO

Implement retention closure so retained Answer/CitationRef objects protect the canonical history needed to reopen them independent of IndexBuild GC.

Rules:

- archive removes from normal/current use but does not purge history;
- explicit purge may make old content unavailable and must be represented explicitly;
- ordinary index GC/source update cannot break retained historical citations;
- active GenerationRuns and backup operations protect required snapshots/objects during their lifetime.

## P3-A09 — Crash/retry consistency

**Status:** TODO

Close crash/retry boundaries across:

```text
immutable bundle write
SQLite metadata commit
published selection
IndexBuild activation
job completion
backup boundary
```

Recovery must never leave a half-published state falsely represented as success.

## P3-A10 — Backup/restore + production E2E

**Status:** TODO

Complete canonical backup/restore sufficient to rebuild a usable retrieval projection.

Required end-to-end scenarios:

1. same raw SourceVersion under new parser/normalization identity creates a new immutable ParsedArtifact while old history remains valid;
2. out-of-order update tasks cannot publish stale selection;
3. retrieval → publication/GC → second retrieval in same run still uses frozen snapshot;
4. lease-lost worker cannot publish visible result;
5. crash between bundle/metadata/publication recovers without false success;
6. old retrieval index can be reclaimed while retained Answer citation still reopens Evidence;
7. restore retained canonical state and rebuild usable SQLite FTS retrieval;
8. host-authoritative Workspace/Path/worktree behavior remains intact.

### Slice A exit

Slice A is PASS only when the declared production path is implemented and its automated/available verification gates pass. User-only verification may remain explicitly PARTIAL at individual task level, but Slice A must not be described as production green while required gate debt remains open.

---

# 8. P3 Slice B — First Derived Resource

Goal:

> Prove long-lived generated resources are first-class canonical objects rather than disposable Chat output.

Implement exactly one first type: **Quiz or Interview**. Choose one at task start and do not broaden the PR to both.

## P3-B01 — DerivedArtifact / ArtifactRevision core

**Status:** TODO

Model:

```text
DerivedArtifact          logical identity
└── immutable ArtifactRevision
```

Minimal dependency policy:

```text
pinned
follow-current
```

Minimal freshness state:

```text
current
needs-review
```

## P3-B02 — Candidate → accept → edit lifecycle

**Status:** TODO

- generated candidate does not automatically overwrite accepted content;
- acceptance creates/advances immutable revision history;
- user edit creates a newer revision;
- concurrent regenerate/accept cannot overwrite a newer user edit.

## P3-B03 — Source publication change / freshness

**Status:** TODO

`follow-current` reacts to published SourceVersion or ParsedArtifact selection change and moves the relevant artifact to `needs-review` without rewriting historical revisions.

`current` means freshness policy satisfied, not semantic truth proven.

## P3-B04 — Derived Resource E2E

**Status:** TODO

Required flow:

```text
Source/Evidence
→ generate Quiz or Interview candidate
→ accept
→ user edit
→ Source publication changes
→ artifact needs-review
→ regenerate candidate
→ preserve historical revisions and newer user edit
→ citation/evidence history remains reopenable
```

---

# 9. Grounded Ask and user-facing Knowledge workflows after Slice A

The old P3-T01..T20 Ask/Notes plan is superseded by this rebaseline where it conflicts with ADR-029.

After Slice A is stable, implement user-facing grounded Ask by reusing the canonical contracts rather than creating parallel identity/revision systems.

Required capabilities remain:

- restricted credential/model configuration;
- restricted Pi session factory;
- run-scoped `knowledge_sources`, `knowledge_search`, `knowledge_read`, `submit_answer` tools;
- evidence-insufficient behavior;
- citation integrity validation;
- semantic support status represented separately from integrity;
- source/version selection UI;
- citation → exact historical viewer.

Saved Notes must be re-evaluated against the unified revision/provenance model before implementation. Do not create unrelated `answer_revisions`, `note_revisions`, and `artifact_revisions` systems when a shared immutable revision primitive can satisfy the actual domain semantics.

A Note may become a `DerivedArtifact(type=note)` or a distinct user-authored aggregate that reuses the same revision/provenance substrate; choose only after the first Derived Resource slice proves the reusable contract.

---

# 10. P4 — Product hardening / release gate

Goal:

> Make the supported Knowledge loop dependable for daily use and prove it provides value over direct-file Pi.

Required release concerns include:

- complete operational error-state UX;
- service packaging/lifecycle;
- installation/update/rollback procedure;
- backup/restore and migration rehearsal;
- supported-machine/Fleet regression closure;
- citation/history recovery suite;
- provider/data-disclosure UX;
- performance/resource report on reference hardware;
- dependency/security review;
- product-value comparison against direct-file baseline.

No P4 PASS while mandatory P0/P1/P3 verification debt required by the supported release scope remains open.

---

# 11. P5 — Broader derived-resource expansion

Only after the canonical DerivedArtifact lifecycle is validated in real use should the product broaden to additional resource types such as:

```text
Flashcard
Study Guide
Summary / Report
Mind Map
Slides
Course / Learning Path
```

Potential future parser/retrieval upgrades remain adapter/projection decisions:

```text
Docling or other rich-document parser adapters
PDF/DOCX/PPTX/Image/OCR/layout/table/formula support
Qdrant / Dense / Hybrid / reranking only after evidence-triggered reopening
external mature-product retrieval adapters only for concrete provider value
```

Do not introduce a graph database, generic workflow DSL, general multi-agent framework, or second canonical DocumentIR identity without a concrete evidence-backed need.

---

# 12. Immediate execution order

The current autonomous execution order is:

```text
1. Planning rebaseline (this document + PHASES alignment)
2. P3-T00 — inherited Knowledge baseline closure
3. P3-A01 — captured/published semantics
4. P3-A02 — ParsedArtifact identity migration
5. P3-A03 — publication/retrieval snapshot boundary
6. P3-A04 — business-commit fencing
7. P3-A05 — frozen GenerationRun
8. P3-A06 — DeliveredEvidence
9. P3-A07 — persistent Answer/CitationRef
10. P3-A08 — retention/archive/purge
11. P3-A09 — crash/retry consistency
12. P3-A10 — backup/restore + Slice A E2E
13. P3 Slice B — first Quiz or Interview Derived Resource
14. Grounded Ask/product UX slices built on the same canonical contracts
```

Every run must re-check repository reality before blindly taking the next numbered task. If a previous PR moved, CI introduces a new task-attributable failure, or an Accepted ADR changes, rebaseline before proceeding.

---

# 13. Stop conditions

Stop autonomous mutation and report instead of improvising if any task requires:

- changing an Accepted architecture decision without new evidence;
- destructive Git/history rewrite;
- merging PRs;
- secrets/high-privilege credentials unavailable to the execution environment;
- unsafe deletion/purge of historical canonical data;
- ambiguous ownership that could invalidate SourceVersion/Evidence/Artifact history;
- a user-only acceptance action that is genuinely required before a dependency can safely proceed.

Otherwise, record user-only verification debt and continue the next dependency-safe task.
