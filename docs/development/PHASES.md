# Development Phases

## Principle

Each phase has an explicit exit condition. Dependencies may be explored in parallel, but a later product gate cannot be declared complete before the previous gate's required evidence exists.

This file defines phase-level goals and gates. The authoritative forward-looking task breakdown is [`DEVELOPMENT-PLAN.md`](./DEVELOPMENT-PLAN.md).

Task reporting is part of the Definition of Done. Every behavior-changing task must add/update a report under `docs/development/reports/` and a reproducible verification guide under `docs/development/verification/`. Analysis-only tasks require a report; a verification guide is optional when no executable behavior changes.

A verification guide documents how to test a feature; it is not itself proof that the feature passed.

---

## P0 — Integration / security / process boundary

Goal: prove Knowledge can exist as a first-class Workspace capability without replacing PI WEB's authoritative Project/Workspace/Machine routing or moving heavy Knowledge work into sessiond.

Accepted foundations include:

- Knowledge Workspace surface;
- host-authoritative Project / Workspace / Path;
- standalone authenticated loopback `pi-knowledge` process boundary;
- thin paired-plugin integration direction.

Current phase status: **PARTIAL**.

Mandatory P0-T04..T08 local/browser/Fleet/runtime verification debt remains recorded in `VERIFICATION-DEBT.md` and must close before release gates that depend on it.

---

## P1 — Stable Evidence Core

Goal: build authoritative immutable Knowledge data and stable Evidence without relying on LLM quality.

Core flow:

```text
Select/import MD/TXT
→ immutable SourceVersion
→ ParsedArtifact
→ Stable Evidence
→ retrieval projection
→ Source/Evidence Viewer
```

Foundations include durable jobs, Source/SourceVersion, content-addressed bytes, canonical MD/TXT parsing, Evidence/viewer work, SQLite FTS5/index publication/retention work and backup work.

Current phase status: **PARTIAL**.

P1 acceptance debt remains real. P3 may reuse implemented contracts where dependency-safe, but must not reinterpret PARTIAL work as fully accepted production evidence.

---

## P2 — Retrieval evaluation + architecture decision

Goal: select retrieval from evidence and determine what Pi should own vs reuse.

Frozen development evidence supports:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10 default
```

Dense candidates did not establish material benefit. Qdrant / Dense / Hybrid / reranking are therefore not V1 dependencies without new frozen evidence.

Mature-product evaluation established that generic local RAG is viable, while not establishing the canonical Knowledge identity/lifecycle contracts Pi needs to own.

Current phase status: **PASS for the P2 decision gate**.

Exit achieved:

- P2-T10 direct-file baseline PASS;
- P2-T11 decision-sufficient mature-product evidence PASS;
- P2-T12 PASS;
- ADR-029 Accepted.

ADR-029 decision principle:

> **Pi owns the knowledge truth and long-lived lineage. Files, parsers, indexes, models and external RAG systems are replaceable inputs, projections or adapters.**

---

## P3 — Production Knowledge Closure + Grounded Generation + first Derived Resource

P3 implements the accepted ADR instead of reopening it.

### P3-T00 — Planning Rebaseline

Docs-only transition task that aligns the development plan and phase gates with ADR-029.

### P3-T01 — Pre-P3 baseline closure

Close the known inherited Knowledge static/test debt so Slice A gets a trustworthy regression signal. Do not mix product features or frozen-evidence changes into this cleanup.

### Slice A — Production Knowledge Closure

Goal:

> Make the canonical Knowledge lineage and grounded generation path production-coherent for Markdown/TXT.

Required contracts:

```text
captured Source state
→ explicit published SourceVersion + ParsedArtifact + publication generation
→ consistent retrieval snapshot
→ frozen GenerationRun / ScopeManifest
→ DeliveredEvidence
→ persistent Answer / CitationRef
→ historical retention closure
```

Must include:

- immutable ParsedArtifact interpretation identity;
- stale/out-of-order publication protection;
- business-commit worker fencing;
- retrieval snapshot protection for active runs;
- CitationRef → Evidence historical reopening;
- archive != purge;
- index GC independent of canonical-history retention;
- crash/retry consistency;
- backup/restore of canonical history plus deterministic rebuild of a usable retrieval index;
- host-authoritative Workspace/worktree regression coverage.

Slice A exit:

```text
Import MD/TXT
→ publish canonical Knowledge
→ FTS retrieval
→ frozen GenerationRun
→ DeliveredEvidence
→ durable Answer/CitationRef
→ update Source/reindex
→ old citation still reopens historical content
→ old index GC
→ backup/restore
→ rebuild usable retrieval index
→ old citation still resolves
```

### Slice B — First Derived Resource

Goal:

> Prove Pi's canonical lineage supports a long-lived generated resource, not only ephemeral chat.

Implement exactly one first type: **Quiz or Interview**.

Required domain:

```text
DerivedArtifact
└── immutable ArtifactRevision

policy: pinned | follow-current
freshness: current | needs-review
```

Must prove:

- candidate → accept without rewriting history;
- user edits survive regeneration;
- stale concurrent candidate cannot overwrite newer user edits;
- Evidence/SourceVersion lineage and generator provenance are retained;
- follow-current marks `needs-review` on published dependency change;
- pinned remains historical until explicitly changed;
- restart/reopen preserves the accepted revision and citations.

P3 exit is not “all future Studio features exist”. P3 exits when the supported Knowledge/grounded-generation path and first Derived Resource are coherent enough to move into product hardening.

---

## P4 — Product hardening / release gate

Goal: make the supported P3 product loop dependable for daily personal use and prove value over direct-file Pi usage.

Required themes:

- explicit operational error UX;
- installation/service lifecycle/update procedure;
- observability without credential/source-body leakage;
- representative performance/resource measurements;
- failure injection;
- schema migration rehearsal;
- backup/restore rehearsal;
- upstream PI WEB sync rehearsal;
- user-value comparison against direct-file Pi;
- closure of mandatory P0/P1 verification debt for release scope.

Release requires no known correctness failure in supported scope and must not claim production readiness while inherited static/test failures or mandatory acceptance debt remain unresolved.

---

## P5 — Broader Derived Resources

Only after P3/P4 prove the core Knowledge model useful and reliable.

Candidate expansion:

```text
Quiz / Interview
→ Flashcards
→ Study Guide
→ Summary / Report
→ Learning/Course resources
→ later Mind Map / Slides if justified
```

All resource types should reuse Pi-owned canonical SourceVersion/Evidence/ArtifactRevision lineage and replaceable parser/retrieval/model adapters.

Do not add a graph database, generic workflow DSL, multi-agent orchestration framework, dedicated resource microservice or Qdrant dependency without concrete evidence establishing a need.
