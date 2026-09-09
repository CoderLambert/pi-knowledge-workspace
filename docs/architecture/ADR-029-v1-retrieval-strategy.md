# ADR-029 — Pi-native Knowledge Domain and V1 Retrieval Boundary

Status: **BLOCKED ON ARCHITECTURE CONTRACT FINALIZATION**  
Date opened: **2026-09-09**  
Refocused: **2026-09-10**

## Context

P2 began as a retrieval-stack selection exercise. Measured evidence has now answered the narrow retrieval question, while mature-product evidence and subsequent architecture review exposed a more important boundary:

```text
What Knowledge identity and lifecycle semantics must Pi own,
and which retrieval/RAG capabilities should remain replaceable infrastructure?
```

P3 must not begin until this ADR is Accepted because P3 will make the canonical identity, generation-scope, citation, persistence and DerivedArtifact contracts expensive to change.

## Evidence-backed V1 retrieval result

### SQLite FTS5 baseline

Frozen development configuration:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

Development:

```text
50 queries / 42 answerable / 8 no-answer
Recall@10 = 1.0
MRR = 0.9365079365079365
all-required Evidence coverage = 1.0
```

Expanded baseline:

```text
80 queries / 68 answerable
Recall@10 = 1.0
MRR = 0.928921568627451
all-required Evidence coverage = 1.0
```

One-shot aggregate holdout after profile freeze:

```text
30 queries / 26 answerable
Recall@10 = 1.0
MRR = 0.9166666666666666
coverage = 1.0
```

### Lexical normalization

`baseline` remained the least-complex winner. CJK bigram and bigram+trigram profiles did not produce a material gain and regressed MRR.

### Dense candidates

The tested multilingual Dense candidates regressed the frozen FTS comparator:

```text
multilingual E5 small:
Recall@10 0.9523809523809523
MRR 0.8462301587301588
coverage 0.9523809523809523

multilingual MiniLM:
Recall@10 0.9285714285714286
MRR 0.7633219954648526
coverage 0.9285714285714286
```

Conclusion for V1:

```text
selectedDenseProfile = null
denseWorthCarryingForward = false
```

This rejects the tested Dense candidates for V1. It is not a theorem that every future Dense/Hybrid strategy is permanently invalid; reopening requires new frozen evidence showing material product benefit.

## Direct-file Pi baseline

P2-T10 completed the 50-query direct-file Pi run.

Independent semantic adjudication:

```text
correct = 48
partial = 0
incorrect = 2
no-answer hallucinations = 2
version/conflict mistakes = 0
material Evidence omissions = 0
```

This confirms that no-answer/negative-evidence discipline is a generation/grounding concern distinct from retrieval candidate recall.

## Mature-product evidence — P2-T11 PASS on decision sufficiency

AnythingLLM v1.16.1 provided enough direct evidence to answer the mature-product question:

- historical citation durability probe: **PASS** for the tested Source A -> Source B -> restart -> reopen-old-citation path;
- formal 50-query run: 47/50 first-attempt success;
- successful answerable responses: 39/39 semantically correct under independent review;
- returned sources contained all required Golden documents for all 39 successful answerable queries;
- no material version/conflict mistakes among successful responses;
- primary weakness: no-answer / negative-evidence discipline;
- raw API exposed `<think>...</think>` tags, creating an adapter sanitization concern.

The full Open WebUI 50-query benchmark was intentionally de-scoped on 2026-09-10. It no longer has sufficient decision value to justify completion solely for checklist symmetry after the architecture question was split into canonical-domain ownership versus replaceable retrieval infrastructure. Partial diagnostics are not scored or promoted to formal comparative evidence.

P2-T11 is therefore **PASS — DECISION-SUFFICIENT EVIDENCE** and is no longer the ADR blocker.

## Architecture synthesis

The mature-product evidence weakens any argument that Pi must build custom Knowledge because generic local RAG or historical citation behavior is unavailable elsewhere.

The remaining justification for Pi-owned Knowledge is instead the canonical domain and lifecycle contract required by the product:

```text
Workspace / worktree scope
Source
SourceVersion
ParsedArtifact / versioned DocumentIR
Stable Evidence
GenerationRun / frozen ScopeManifest / DeliveredEvidence
DerivedArtifact / immutable ArtifactRevision
CitationRef / provenance / lifecycle
```

Retrieval is a derived projection over that canonical domain.

## Proposed canonical model

```text
KnowledgeWorkspace
│
├── Source
│    ├── explicit current selection
│    └── immutable SourceVersion snapshots
│           └── immutable ParsedArtifact
│                  ├── versioned DocumentIR
│                  ├── canonical UTF-8 bytes / source map
│                  └── Stable Evidence spans
│
├── GenerationRun
│    ├── frozen ScopeManifest
│    └── DeliveredEvidence
│
└── DerivedArtifact
     └── immutable ArtifactRevision
          ├── typed content
          ├── CitationRef -> Evidence
          └── dependency policy
               ├── pinned
               └── follow-current
```

### ParsedArtifact / DocumentIR

Do not introduce a second canonical DocumentIR identity beside `ParsedArtifact`. The versioned DocumentIR is content carried by an immutable ParsedArtifact with parser/normalization identity.

### Stable Evidence

Evidence must not depend on retrieval chunk/vector identity. The durable anchor is an immutable ParsedArtifact plus canonical span/quote integrity. Retrieval chunks and indexes may be rebuilt without changing historical Evidence.

### Citation

V1 does not require a separate heavyweight persisted `CitationAnchor` aggregate. Answer/Artifact content should use `CitationRef -> Evidence`; viewer/page/bbox details can be resolved from canonical artifact/source-map data as capabilities expand.

### DerivedArtifact lifecycle

Long-lived resources such as Quiz/Interview/Flashcard/Study Guide must not mutate a single row in place. The proposed model uses logical `DerivedArtifact` identity plus immutable `ArtifactRevision` history.

### Frozen generation scope

A multi-step Answer or Artifact generation must not silently mix source/index generations. Each `GenerationRun` freezes the applicable scope and records the Evidence actually delivered to the generator.

## Retrieval boundary

Retrieval is a rebuildable projection, not canonical Knowledge storage.

V1 implementation:

```text
SqliteFts5 retrieval adapter/provider
```

The provider returns scoped candidates from a frozen index snapshot. Pi resolves candidates back to canonical SourceVersion/ParsedArtifact/Evidence before grounded generation.

The provider must not own:

- SourceVersion identity;
- historical Evidence;
- DerivedArtifact lineage;
- canonical citation identity.

Future Qdrant/Dense/Hybrid/external-RAG adapters may replace the candidate-retrieval layer only after new acceptance evidence justifies them.

## Proposed Decision

> **Pi owns Knowledge domain identity, Evidence integrity, generation scope and DerivedArtifact lifecycle; retrieval is a replaceable derived-index capability.**
>
> Canonical Pi storage owns immutable SourceVersion snapshots, versioned ParsedArtifact/DocumentIR, Stable Evidence, and immutable revisions for long-lived generated resources. Citations resolve through Evidence to concrete historical canonical content and do not depend on current chunks, vector IDs or the latest SourceVersion.
>
> Each grounded generation uses a frozen scope and records the Evidence actually delivered to the generator. Long-lived artifacts explicitly distinguish pinned historical dependencies from follow-current dependencies; source changes create deterministic review/freshness work rather than overwriting historical revisions.
>
> V1 uses the measured SQLite FTS5 baseline. Dense, Hybrid, Qdrant, reranking and external RAG products are not V1 production dependencies. They may be reconsidered only when frozen evaluation and operational evidence demonstrates material benefit while preserving Pi's canonical scope, citation and lifecycle contracts.

## Current blockers before Accepted

ADR-029 is **not yet Accepted**. The remaining blockers are architecture-contract closure, not more symmetric mature-product benchmarking.

Before acceptance, confirm and record:

1. exact Source/current-version selection semantics, including A -> B -> A;
2. production ParsedArtifact persistence/read path and historical Evidence closure;
3. minimal frozen `GenerationRun` / `ScopeManifest` / `DeliveredEvidence` contract;
4. minimal `DerivedArtifact` / immutable `ArtifactRevision` / dependency-policy contract;
5. retrieval adapter boundary over existing SQLite FTS5 without leaking provider identity into canonical domain;
6. backup/restore/retention closure for SourceVersion -> ParsedArtifact -> Evidence -> ArtifactRevision;
7. repository reality check showing which contracts already exist, which are fixture-only, and which require production wiring or schema migration.

These items should be resolved by architecture/code review and a bounded vertical slice, not by adding new retrieval products.

## Non-decisions

ADR-029 does not currently select:

- Qdrant;
- a Dense embedding model;
- Hybrid/RRF;
- reranking;
- late interaction / multivector;
- Docling as a mandatory V1 parser;
- MCP as a current integration layer;
- AnythingLLM/Open WebUI as production dependencies.

## Upgrade triggers

Reopen advanced retrieval only when at least one decision-relevant failure exists, for example:

- lexical Recall/complete-span coverage regresses on a new frozen representative corpus;
- target-scale FTS latency/memory/update cost misses a declared SLO;
- multilingual semantic paraphrase/code/version cases show repeatable lexical recall gaps;
- metadata/multimodal requirements exceed an economical SQLite implementation;
- a Dense/Hybrid/Qdrant/external provider passes the same scope, historical Evidence, recovery and end-to-end quality contracts with material net benefit.

## P3 gate

No normal P3 productization is authorized before ADR-029 is formally Accepted.

A bounded architecture-validation vertical slice may be specified as the acceptance mechanism, covering:

```text
Source A
-> SourceVersion A
-> ParsedArtifact A
-> Stable Evidence A
-> SQLite FTS IndexBuild A
-> frozen generation scope
-> grounded answer
-> Quiz/Interview ArtifactRevision A
-> source update B
-> follow-current needs-review / pinned-history behavior
-> restart / GC / backup / restore
```

The slice must prove historical canonical content survives independently of retrieval-index lifecycle.

## Final Decision

**BLOCKED ON ARCHITECTURE CONTRACT FINALIZATION.**

P2-T11 mature-product benchmarking is no longer the blocker. Do not resume long product benchmarks merely to complete a historical checklist. Do not enter normal P3 until this ADR is Accepted. No automatic merge.
