# P2-T12 — Knowledge Domain / Retrieval Boundary ADR

Status: **BLOCKED ON ARCHITECTURE CONTRACT FINALIZATION**

## Retrieval result — settled for V1

Measured P2 evidence still narrows V1 retrieval to:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

The tested Dense candidates regressed the frozen FTS comparator. sqlite-vec / Hybrid / Qdrant are therefore not V1 additions under current evidence. They remain reopenable only with new frozen quality/operational evidence.

## P2-T10 — PASS

Direct-file Pi evidence remains accepted:

```text
50 queries
48 correct / 0 partial / 2 incorrect under owner-authorized independent review
no material version/conflict mistakes
```

This also reinforces that no-answer/negative-evidence discipline is not automatically a retrieval-backend problem.

## P2-T11 — PASS on decision sufficiency

AnythingLLM fixed-version evidence established:

- one historical citation durability path survives source replacement + restart;
- 47/50 first-attempt formal-run success;
- 39/39 successful answerable responses semantically correct;
- all required Golden documents present in returned top-4 for all successful answerable responses;
- primary weakness concentrated in no-answer / negative-evidence discipline.

The full Open WebUI 50-query benchmark has been intentionally de-scoped. It no longer carries enough decision value to justify completion solely for symmetric coverage after the architecture question was separated into:

```text
Pi-owned canonical Knowledge semantics
vs
replaceable retrieval / generic RAG infrastructure
```

Partial Open WebUI diagnostics are preserved but are not formally scored.

P2-T11 is therefore no longer the ADR blocker.

## Current ADR focus

The remaining decision is the contract Pi must freeze before P3:

```text
Source / explicit current selection
immutable SourceVersion
immutable ParsedArtifact carrying versioned DocumentIR
Stable Evidence independent of retrieval chunk/index identity
GenerationRun + frozen ScopeManifest + DeliveredEvidence
DerivedArtifact + immutable ArtifactRevision
CitationRef -> Evidence
pinned vs follow-current dependency semantics
retrieval as rebuildable projection/provider
```

## Why this matters now

P0/P1/P2 already contain substantial useful implementation and evidence. The project should not restart from scratch. But once normal P3 productization begins, direct coupling between Chat/Artifacts and FTS rows/chunk identity would create expensive migration debt.

Therefore the lowest-cost point to freeze the domain/retrieval boundary is now, before P3.

## Remaining blocker

ADR-029 is blocked until the architecture contract is reconciled with repository reality and the minimum production closure is explicit.

Required before Accepted:

1. Source/current-version semantics, including A -> B -> A;
2. production ParsedArtifact persistence and historical Evidence read closure;
3. frozen generation-scope contract;
4. immutable ArtifactRevision + dependency-policy contract;
5. narrow SQLite FTS retrieval adapter/provider boundary;
6. backup/restore/retention closure across canonical lineage;
7. code reality check identifying existing, partial, fixture-only and production-wired pieces;
8. acceptance vertical slice proving the contract end to end.

These are architecture/code questions, not reasons to resume broad mature-product benchmarking.

## ADR state

ADR-029 remains **BLOCKED**, not Accepted.

P3 remains prohibited until ADR-029 is formally Accepted. A bounded vertical slice may be used as the ADR acceptance proof, but it must not silently expand into ordinary P3 feature work.

No automatic merge.
