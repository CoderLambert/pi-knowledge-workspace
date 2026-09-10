# Development Phases

## Principle

Each phase has an explicit exit condition. Dependencies may be explored in parallel, but a later product gate cannot be declared complete before the previous gate's required evidence exists.

This file defines phase-level goals and gates. The authoritative forward-looking task breakdown is [`DEVELOPMENT-PLAN.md`](./DEVELOPMENT-PLAN.md).

Product Milestone reporting is part of the Definition of Done. Product Slice PRs carry integrated implementation and verification context; standalone reports and verification guides are created at milestone or Product Slice/user-journey boundaries when they provide durable value. Agent Work Units normally require only the concise handoff defined in [`REPORTING.md`](./REPORTING.md).

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

### P3-T01 — Regression gate / exit

TypeScript is green and 77 inherited ESLint findings remain. Historical lint is maintenance debt, not a zero target. P3-T01 exits when touched/P3-critical lint, focused tests, typecheck and build provide a trustworthy Product Slice regression signal without disabling rules or mutating frozen P2 evidence.

### Slice A — Reliable Knowledge through production lifecycle

Build and verify these Product Slices in order:

```text
Reliable Knowledge
→ Grounded Ask Backend
→ Grounded Ask UI
→ PRODUCT PREVIEW
→ Lifecycle Safety
→ Production E2E / Backup Restore
→ SLICE A PASS
```

Required contracts include captured-vs-published Source state, immutable SourceVersion/ParsedArtifact identity, consistent retrieval snapshot publication, frozen GenerationRun scope, DeliveredEvidence, durable Answer/CitationRef, historical citation reopening, business-commit fencing, `archive != purge`, canonical retention independent of index GC, crash/retry consistency, backup/restore and host-authoritative Workspace/worktree coverage.

### Quiz — First Derived Resource

After Slice A PASS:

```text
Quiz Generate
→ Quiz Lifecycle
→ Quiz E2E
→ P3 PASS
```

Quiz uses `DerivedArtifact` with immutable `ArtifactRevision`, `pinned | follow-current` dependency policy and `current | needs-review` freshness. It must preserve candidate/accept/edit history, reject stale overwrites, retain canonical Evidence/SourceVersion lineage and generator provenance, and reopen the same accepted revision/citations after restart.

P3 PASS does not require every future Studio resource. It requires the supported Reliable Knowledge/Grounded Ask lifecycle and first Quiz resource to pass their integrated milestone gates.

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

Release requires no known correctness failure in supported scope and must not claim production readiness while mandatory acceptance debt remains unresolved. Inherited static/lint findings remain maintenance debt unless they mask release regressions, block required gates or represent correctness defects.

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
