# Pi Knowledge Workspace — Complete Development Plan

Status: **Active Development Baseline**  
Repository: `CoderLambert/pi-knowledge-workspace`  
Strategy: **Thin Fork + standalone pi-knowledge process**  
Architecture baseline: **ADR-029 Accepted**  
Current architecture base: `experiment/p2-retrieval-adr`

This document is the authoritative forward-looking task plan. Historical implementation detail remains in Git history, task reports, verification guides and `CHANGELOG.md`. `PHASES.md` defines phase gates; this file defines current task order, dependencies and acceptance expectations.

Every behavior-changing task follows `REPORTING.md`, `VERIFICATION.md`, `AUTONOMOUS-EXECUTION.md` and `BRANCH-HYGIENE.md`.

---

# 1. Global execution rules

## 1.1 Status vocabulary

Only these statuses are used:

- **PASS** — required implementation and available acceptance evidence are complete.
- **PARTIAL** — implementation exists but required evidence or bounded closure remains open.
- **BLOCKED** — the task cannot safely continue without changing a dependency/architecture assumption or requiring unavailable authority.

## 1.2 Task lifecycle

```text
inspect latest branch / PR / CI / accepted ADRs
→ verify plan against repository reality
→ select one dependency-safe task
→ one branch + Draft PR for one concern
→ implement minimal scope
→ run available automated/static checks
→ report + verification guide for behavior changes
→ record only external-only user verification debt
→ classify PASS / PARTIAL / BLOCKED
→ update plan/changelog when project state changes
```

## 1.3 Development discipline

1. Keep Project / Workspace / Path / Machine routing host-authoritative.
2. Keep Knowledge processing outside sessiond; PI WEB remains a thin adapter.
3. Prefer upstream/public PI WEB seams over core patches.
4. One task per branch and Draft PR; stacked PRs are allowed.
5. No automatic merge.
6. No force-push or casual rebase/history rewrite.
7. Do not mutate frozen P2 evidence to improve scores.
8. Do not retune against holdout or mature-product evidence.
9. Do not add framework abstractions without a concrete need.
10. Architecture changes require ADR review; implementation must not silently redefine ADR-029.
11. Repository CI/static failures that automation can fix are implementation debt, not user verification debt.

---

# 2. Accepted architecture baseline — ADR-029

The following contracts remain frozen for P3 unless new evidence explicitly reopens the ADR.

## 2.1 Canonical ownership

Pi owns long-lived Knowledge truth and lineage:

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

## 2.2 Publication semantics

Captured content and published Knowledge are separate states. A published selection identifies:

```text
SourceVersion
+ ParsedArtifact
+ publication generation
```

Parsing/indexing failure keeps the prior publication usable. A→B→A must not depend on timestamp ordering.

## 2.3 ParsedArtifact identity

ParsedArtifact is immutable. Material parser/schema/normalization/config changes create a new artifact identity; old interpretations remain readable. V1 production closure remains MD/TXT.

## 2.4 Evidence, citations and retention

Evidence anchors canonical immutable content and is independent of retrieval chunks/index rebuilds. Historical citations reopen historical content.

```text
CitationRef
→ Evidence
→ ParsedArtifact
→ SourceVersion
```

Retained Answers / ArtifactRevisions preserve that canonical closure. Retrieval-index retention is separate. `archive != purge`.

## 2.5 Frozen generation scope

A GenerationRun freezes canonical scope/publication/retrieval snapshot before first retrieval. Later calls in the run do not silently reacquire latest; snapshot loss fails closed.

`DeliveredEvidence` records ordered canonical spans actually delivered to each model invocation/attempt after application-side shaping.

## 2.6 Worker fencing

Loss of lease/fencing authority prevents stale workers from publishing Source publication, active IndexBuild, Answer, accepted ArtifactRevision or equivalent user-visible state.

## 2.7 V1 retrieval

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10 default
```

Dense / sqlite-vec / Hybrid / RRF / Qdrant / reranking / late interaction remain outside V1 without new frozen evidence of material net benefit.

---

# 3. Phase status

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

P0/P1 acceptance debt remains real and must close before release gates that require it, but it does not invalidate ADR-029 or block dependency-safe P3 implementation.

---

# 4. Historical phase summary

## P0 — PARTIAL

Core Knowledge Workspace/process boundary is implemented. Mandatory local/browser/Fleet/runtime verification debt remains in `VERIFICATION-DEBT.md`. P3 must reuse PI WEB's existing host-authoritative Machine/Workspace/federation seams.

## P1 — PARTIAL

Implemented foundations include durable jobs, Source/SourceVersion, content-addressed bytes, safe capture, canonical MD/TXT ParsedArtifact, Evidence/viewer, FTS/index publication/retention and backup work.

ADR-029 promotes these remaining production gaps into P3:

- captured vs published Source selection;
- durable ParsedArtifact interpretation identity;
- canonical publication + retrieval snapshot consistency;
- run-level frozen scope;
- persistent Answer/CitationRef;
- business-commit fencing;
- complete canonical backup/restore closure.

## P2 — PASS decision gate

- **P2-T10 PASS** — direct-file Pi baseline accepted.
- **P2-T11 PASS** — mature-product evidence decision-sufficient; full Open WebUI long run intentionally de-scoped with audit trail.
- **P2-T12 PASS** — ADR-029 Accepted.

---

# 5. P3 execution order

## P3-T00 — Planning Rebaseline

**Status: PASS.**

The stale pre-ADR “Ask then separate Notes subsystem” sequence is superseded by baseline closure → production canonical closure → first Derived Resource.

## P3-T01 — Pre-P3 baseline closure

**Status: PARTIAL — TypeScript blocker closed; inherited ESLint baseline remains.**

Objective:

> Remove inherited Knowledge static/test debt enough to give Slice A a trustworthy regression signal, using bounded subsystem-scoped support slices rather than a repository-wide cleanup.

Current verified progression:

```text
P3-T01   TypeScript blocker:             12 → 0
P3-T01S1 plugin-test lint:              261 → 254
P3-T01S2 runtime-contract lint:         254 → 252
P3-T01S3 core-storage-test lint:        252 → 247
P3-T01S4 storage-harness lint:          247 → 242
P3-T01S5 storage-test-harness lint:     242 → 233
```

Current inherited ESLint baseline: **233 errors**.

Scope rules:

- keep `npm run typecheck` green;
- fix only known baseline findings/directly exposed equivalents;
- prefer test/harness-only slices before production lint changes when dependency-safe;
- no product features, ADR changes, retrieval changes, benchmark retuning or P2 evidence mutation;
- compare new failures against the parent baseline before classification;
- add report + verification guide for each behavior-changing support slice.

P3-T01 exit requires a trustworthy static/test signal for Slice A. It does not authorize unrelated repository cleanup.

---

# 6. P3 Slice A — Production Knowledge Closure

Goal:

> Make ADR-029's canonical Knowledge contracts real in the Markdown/TXT production path before broad new product features.

## P3-A01 — Captured vs published Source state

Implement explicit publication semantics:

- latest captured content may exist without becoming published;
- publication binds SourceVersion + ParsedArtifact + monotonic generation;
- failed parse/index preserves prior publication;
- A→B→A is generation-authoritative, not timestamp-authoritative;
- stale/out-of-order completion cannot overwrite newer publication intent;
- Workspace isolation remains host-authoritative.

## P3-A02 — ParsedArtifact durable identity migration

Material parser/schema/normalization/config differences create distinct immutable ParsedArtifacts for the same SourceVersion. Historical Evidence remains anchored to the original artifact. Migration must be backward-safe/fail-closed.

## P3-A03 — Publication manifest / retrieval snapshot consistency

Publish canonical selection and usable retrieval snapshot through one consistent boundary. Candidate builds validate before publication; stale candidates cannot replace newer generation; half-new state is never visible. Index remains rebuildable projection.

## P3-A04 — Business-commit worker fencing

A worker that loses lease/fencing authority cannot commit any user-visible current pointer even if its handler later returns success.

## P3-A05 — GenerationRun + frozen ScopeManifest

Persist and freeze at least:

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

Later Source publication does not mutate the run. Snapshot loss fails closed.

## P3-A06 — DeliveredEvidence provenance

Record ordered Evidence actually submitted after trimming/dedup/context shaping, associated with invocation/attempt and relevant rendering/config revision.

## P3-A07 — Persistent Answer / CitationRef

Persist grounded Answer history and CitationRef → Evidence. Historical click must reopen original SourceVersion/ParsedArtifact; missing/purged history is explicit, never redirected.

## P3-A08 — Canonical retention + archive/purge

Retained Answer/ArtifactRevision preserves citation closure independently of index GC. Archive removes default/current use without destroying retained history. Purge is explicit destructive intent.

## P3-A09 — Crash/retry consistency

Exercise interruption boundaries across artifact/blob writes, SQLite metadata, Source publication, IndexBuild publication, job completion and Answer commit. Never report success for half-published state.

## P3-A10 — Backup/restore + production E2E

Required closure path:

```text
Import MD/TXT
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

Slice A PASS also requires host-authoritative Workspace/worktree regression coverage.

---

# 7. P3 Slice B — First Derived Resource

Goal:

> Prove canonical lineage supports a long-lived generated resource, not only ephemeral chat.

Implement exactly one initial type: **Quiz or Interview**.

## P3-B01 — DerivedArtifact + immutable ArtifactRevision

Required semantics:

```text
dependency policy: pinned | follow-current
freshness: current | needs-review
```

`current` means freshness policy satisfied, not semantic correctness proven.

## P3-B02 — Candidate / accept / user edit

Generation creates candidate revision; acceptance advances accepted state without overwriting history. User edits are immutable history. Stale candidate acceptance cannot overwrite newer edits.

## P3-B03 — Evidence/provenance binding

Retain Evidence dependencies, canonical lineage and generator/model/config provenance sufficient for auditability.

## P3-B04 — Source update review behavior

`follow-current` becomes `needs-review` when published dependencies change; it does not silently regenerate. `pinned` stays historical until explicitly changed.

## P3-B05 — First Derived Resource E2E

```text
published Knowledge
→ generate candidate
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

---

# 8. Ask / Notes after Slice A/B

Reuse shared primitives:

```text
GenerationRun
DeliveredEvidence
Answer/CitationRef
DerivedArtifact/ArtifactRevision where appropriate
shared revision/concurrency semantics
```

Do not independently invent incompatible `note_revisions`, `answer_revisions` and `artifact_revisions` systems. Decide whether Notes are a DerivedArtifact type or a distinct user-authored entity only when concrete UI/edit/export requirements justify it.

---

# 9. P4 — Product hardening / release

Required themes include error-state UX, service lifecycle/install/update, safe observability, representative performance/resource measurement, failure injection, migration/backup/restore rehearsal, upstream PI WEB sync rehearsal, direct-file Pi value comparison and closure of mandatory P0/P1 verification debt for release scope.

Release gate remains strict: no known correctness failure in supported scope; historical citations survive supported lifecycle operations; backup/restore works; product demonstrates value beyond direct-file Pi.

---

# 10. P5 — Broader derived resources

Candidate expansion after P3/P4 validation:

```text
Quiz / Interview
→ Flashcards
→ Study Guide
→ Summary / Report
→ Learning/Course resources
→ later Mind Map / Slides if justified
```

Reuse Pi-owned canonical lineage and replaceable parser/retrieval/model adapters. Do not add graph DB, generic workflow DSL, multi-agent framework, dedicated resource microservice or Qdrant without concrete evidence.

---

# 11. Critical path

```text
ADR-029 Accepted
→ P3-T00 PASS
→ P3-T01 baseline closure (current: PARTIAL, ESLint 233)
→ P3-A01..A10 Slice A
→ Slice A PASS
→ P3-B01..B05 first Derived Resource
→ Slice B PASS
→ Ask/Notes/product expansion
→ P4 release hardening
→ P5 broader resources
```

P0/P1 verification debt remains a parallel closure stream and must be resolved before release gates that depend on it.

---

# 12. Current project position — 2026-09-10

| Area | Status | Current fact |
|---|---|---|
| P0 | PARTIAL | Core boundary viable; local/Fleet/runtime acceptance debt remains. |
| P1 | PARTIAL | Stable Evidence/storage/index/job foundations exist; lifecycle acceptance remains incomplete. |
| P2 | PASS | ADR-029 Accepted; FTS V1 retrieval decision frozen. |
| P3-T00 | PASS | Post-ADR plan rebaseline complete. |
| P3-T01 | PARTIAL | TypeScript 12→0; ESLint 261→233 through S1..S5. |
| P3 Slice A | NOT STARTED | Starts only after P3-T01 gives a trustworthy regression signal. |

Next dependency-safe work: continue bounded P3-T01 lint/static support slices, then enter **P3-A01 — Captured vs published Source state**.
