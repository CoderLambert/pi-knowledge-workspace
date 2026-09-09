# ADR-029 — Pi-native Knowledge Domain and V1 Retrieval Boundary

Status: **ACCEPTED**  
Date opened: **2026-09-09**  
Refocused: **2026-09-10**  
Accepted: **2026-09-10**

## Context

P2 began as a retrieval-stack selection exercise. Measured evidence answered the narrow V1 retrieval question, while mature-product evidence and final architecture review exposed the more important product boundary:

```text
What Knowledge identity and lifecycle semantics must Pi own,
and which retrieval/RAG capabilities should remain replaceable infrastructure?
```

The product direction now includes long-lived generated resources such as Quiz, Interview questions, Flashcards and Study Guides. Those resources require stable historical identity, Evidence lineage, generation scope and revision semantics that must remain independent of any particular retrieval engine or mature RAG product.

This ADR freezes that architecture contract. It does **not** claim that P3 production wiring is already complete or green.

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

`baseline` remained the least-complex lexical winner. CJK bigram and bigram+trigram profiles did not produce a material gain and regressed MRR.

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

V1 conclusion:

```text
selectedDenseProfile = null
denseWorthCarryingForward = false
```

This rejects the tested Dense candidates for V1. It does not permanently reject all future Dense/Hybrid strategies; reopening requires new frozen evidence showing material product benefit.

`Top-K = 10` is the current FTS provider/evaluation default, not a canonical Knowledge-domain invariant.

## Direct-file Pi baseline

P2-T10 independent semantic adjudication:

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

AnythingLLM v1.16.1 established that mature local products can provide strong generic RAG/retrieval and meaningful historical citation behavior:

- historical citation durability: **PASS** for the tested Source A -> Source B -> restart -> reopen-old-citation path;
- formal 50-query run: 47/50 first-attempt success;
- successful answerable responses: 39/39 semantically correct under independent review;
- all required Golden documents were present in returned top-4 for all 39 successful answerable responses;
- no material version/conflict mistakes among successful responses;
- primary weakness was no-answer / negative-evidence discipline;
- raw API responses exposed `<think>...</think>` tags, creating an adapter sanitization concern.

The full Open WebUI 50-query benchmark was explicitly de-scoped after the decision was reframed from whole-product substitution to canonical-domain ownership versus replaceable retrieval/RAG infrastructure. Partial diagnostics are not promoted to a formal comparative score.

P2-T11 is therefore **PASS — DECISION-SUFFICIENT EVIDENCE**.

## Decision

> **Pi owns the Knowledge truth and long-lived lineage. Files, parsers, indexes, models and external RAG systems are replaceable inputs, projections or adapters.**
>
> Pi owns canonical Knowledge identity, historical Evidence, frozen generation scope and Derived Resource lifecycle. Retrieval is a replaceable derived-index capability.
>
> V1 uses the measured SQLite FTS5 baseline. Dense, Hybrid, Qdrant, reranking and external RAG products are not V1 production dependencies. They may be reconsidered only when frozen quality and operational evidence demonstrate material net benefit while preserving Pi's canonical scope, citation, retention and lifecycle contracts.

## Canonical ownership boundary

Pi owns the following concepts and invariants:

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

Retrieval indexes, vector IDs, chunk IDs and external-product source IDs are not canonical identity.

## Source capture and publication semantics

### Captured is not published

A `Source` must distinguish the most recently captured content from the currently published usable Knowledge selection.

Conceptually:

```text
Source
├── latestCapturedVersionId
└── published selection resolved through a publication generation
```

A newly captured `SourceVersion` may exist while parsing, validation or indexing is incomplete or failed. Capture must not make unusable content current.

### Published selection binds version and parsed artifact

The published Knowledge selection must identify at least:

```text
sourceVersionId
parsedArtifactId
selection/publication generation
```

`currentVersionId` alone is insufficient because one immutable raw `SourceVersion` may legitimately produce multiple immutable `ParsedArtifact` objects after parser, schema, normalization or parser-config changes.

The exact physical schema is a P3 implementation choice. The architecture requires one atomic/consistent publication boundary, which may be implemented as a SQLite transaction or a publication manifest.

### Publication consistency with retrieval

A published Knowledge generation must expose a SourceVersion/ParsedArtifact selection that is consistent with the active retrieval snapshot for that same generation.

If parse/index publication fails, the previous published generation remains usable. An older asynchronous task must never overwrite a newer publication intent.

A repeated-content sequence such as A -> B -> A must not rely on `createdAt` sorting to infer current selection. Content-hash reuse may reuse immutable SourceVersion content, but current publication is explicit and generation-controlled.

## ParsedArtifact / versioned DocumentIR

Do not introduce a second canonical DocumentIR identity beside `ParsedArtifact`. The versioned DocumentIR is content carried by an immutable ParsedArtifact.

A `SourceVersion` may have multiple immutable ParsedArtifacts. ParsedArtifact identity must account for every interpretation-changing input, including conceptually:

```text
sourceVersionId
parser identity/version
DocumentIR/schema version
normalization identity/version
parser/normalization configuration digest
```

The current SQL uniqueness shape `UNIQUE(source_version_id, parser_version)` is not sufficient as the permanent identity contract if schema, normalization or parser configuration can change interpretation.

P3 migration must preserve old artifact identity; a parser/schema/config upgrade creates a new ParsedArtifact rather than mutating historical content in place. Exact hashes/columns remain an implementation decision.

## Stable Evidence

Evidence is independent of retrieval chunk/vector identity.

The durable anchor is an immutable ParsedArtifact plus canonical UTF-8 span/quote integrity. Retrieval chunks and indexes may be rebuilt without changing historical Evidence.

V1 does not require a separate heavyweight persisted `CitationAnchor` aggregate. `CitationRef -> Evidence` is the durable citation contract. Page/bbox/viewer coordinates can be resolved from ParsedArtifact/source-map data as richer parsers are introduced.

Historical citations must not silently redirect to newer content. Explicit purge may make historical content unavailable; ordinary index GC, archive or source update must not.

## Knowledge publication and retrieval snapshot

The architecture separates canonical selection from retrieval implementation while requiring consistent publication.

Conceptually a publication generation binds:

```text
selected SourceVersion / ParsedArtifact set
retrieval snapshot or active IndexBuild compatible with that selection
generation identity
```

This may be represented by a `PublicationManifest`, equivalent transactionally published state, or another implementation with the same invariants. The ADR freezes the semantics, not the table name.

Retrieval index data is a rebuildable projection. It may be reclaimed after no active run/backup requires it. Historical audit may retain build/config provenance without retaining old FTS rows forever.

## Frozen GenerationRun scope

A grounded multi-step generation must never silently mix Knowledge generations.

Before the first retrieval, each `GenerationRun` must freeze and protect:

```text
host-authoritative workspace scope
publication/scope manifest
retrieval snapshot / active build identity
relevant versioned retrieval configuration
```

The scope and retrieval snapshot must be acquired consistently and remain protected for the run lifetime.

Subsequent retrieval/tool calls in the same run:

- use the same frozen scope/snapshot;
- may not reacquire `latest` after publication changes;
- may not switch ParsedArtifact because a parser upgrade occurred mid-run;
- continue to enforce host-authoritative workspace/path/worktree validation at every entry boundary.

If the frozen snapshot becomes unavailable, the run fails explicitly. It must not silently continue against a newer publication.

The existing query-level `runHandle` is not sufficient by itself to represent the GenerationRun lifecycle if each `SearchQueryApi` call independently acquires/releases the current active build.

## DeliveredEvidence

`DeliveredEvidence` records what the application actually submitted to a model invocation after retrieval, filtering, deduplication, neighbor expansion, budget trimming and serialization.

It is recorded per model invocation/attempt and includes enough information to reconstruct the submitted context, including conceptually:

```text
GenerationRun / invocation / attempt identity
ordered Evidence spans actually delivered
rendering/serialization version or equivalent provenance
```

A set of Evidence IDs alone is insufficient when multiple invocations receive different ordered/truncated contexts.

`DeliveredEvidence` proves what Pi submitted; it does not prove what the model semantically attended to or used.

Final `CitationRef` values must resolve to Evidence that was available through the corresponding generation process. Citation existence validation is not itself proof of semantic support; semantic citation quality remains an evaluation concern.

## Historical retention closure

Canonical history and index retention are separate concerns.

Persistent Answer/CitationRef and retained ArtifactRevision objects own a retention closure through:

```text
Answer / ArtifactRevision
-> CitationRef / dependency
-> Evidence
-> ParsedArtifact
-> SourceVersion
```

As long as the owner is retained, ordinary GC must not remove the canonical objects required to reopen that history.

Additional invariants:

- active GenerationRuns protect their frozen scope/snapshot while running;
- backup/restore operations protect the canonical objects required for the backup boundary;
- `archive` removes content from normal/current use but does not mean historical purge;
- explicit `purge` may make historical content unavailable and must be represented as such rather than silently redirecting citations;
- IndexBuild retention is not canonical SourceVersion/Evidence retention.

P3 Slice A must include a persistent Answer/CitationRef owner. This cannot be deferred until DerivedArtifact Slice B.

## Worker fencing and visible publication

Durable jobs use lease/fencing semantics, but the architecture requires fencing at **business commit**, not only after a handler returns.

Invariant:

> A worker that no longer owns a valid execution lease may not publish current selection, active retrieval build, Answer, Artifact candidate acceptance, or any other user-visible state.

Retries may produce deduplicated immutable intermediate objects. Any visible publication/commit must validate the current execution right and the expected generation/state in the same transactional or conditional commit boundary.

A stale worker completing after lease loss must be fenced out even if its business function returns successfully.

## DerivedArtifact lifecycle

Long-lived generated resources are first-class domain objects, not mutable Chat-message side effects.

V1 uses:

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

Rules:

- policy changes are traceable and do not rewrite historical revisions silently;
- `follow-current` reacts to changes in the **published** selection, including ParsedArtifact changes for the same SourceVersion;
- `current` means the revision satisfies the declared freshness policy, not that its content has been proven semantically correct;
- candidate generation and acceptance are separate from immutable historical revisions;
- concurrent regenerate/accept must not overwrite a newer user edit or accepted revision.

More elaborate states such as `historical-valid`, `invalid` or semantic automatic invalidation are not V1 requirements.

## Retrieval boundary

Retrieval is a rebuildable projection over canonical Knowledge.

V1 implementation:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10 default
```

The retrieval adapter/provider returns scoped candidates from the frozen snapshot and maps them back to canonical SourceVersion/ParsedArtifact/Evidence identities before grounded generation.

The provider must not own:

- SourceVersion identity;
- ParsedArtifact identity;
- historical Evidence;
- GenerationRun identity;
- DerivedArtifact lineage;
- canonical citation identity.

A future implementation may split indexing/retrieval/reranking internally; ADR-029 does not require a large generic provider framework in V1.

Future Qdrant/Dense/Hybrid/rerank/external-RAG adapters may replace or augment candidate retrieval only after new acceptance evidence justifies them.

## Backup / restore contract

Canonical backup owns the source/content and versioned configuration required to rebuild a **usable** retrieval projection.

Restore guarantees:

```text
retained canonical SourceVersion / ParsedArtifact / Evidence lineage survives
versioned parser/retrieval configuration identity is available
an operationally equivalent usable index can be rebuilt
```

ADR-029 does not require byte-for-byte deterministic reproduction of SQLite index files, model outputs or environment-specific storage layouts.

## Repository reality and migration boundary

The final architecture review classified the current repository as **natural evolution / bounded refactor**, not a rewrite.

Keep and evolve:

- Source / SourceVersion;
- CAS;
- ParsedArtifact canonicalization;
- Stable Evidence and read validation;
- SQLite FTS5;
- IndexBuild publication/retention;
- durable job lease/fencing core;
- host-authoritative Project/Workspace/Path and Git worktree scope.

Replace or tighten during P3 Slice A:

- time-ordering as an implicit current-selection mechanism;
- duplicated job-state ownership such as `MdTextImportJobs` transitions outside the shared durable-job contract;
- query-local `runHandle` as a substitute for GenerationRun lifetime;
- fixture/probe wiring where a production composition path is required;
- ParsedArtifact identity rules that only distinguish `(source_version_id, parser_version)`.

The main implementation risk is crash/retry consistency across file bundles, SQLite metadata, published selection, IndexBuild activation, job completion and backup boundaries.

## ADR acceptance versus P3 implementation

ADR acceptance freezes architecture contracts; it does not require their production implementation to be complete first.

The correct sequence is:

```text
P2 evidence complete
-> ADR contracts frozen
-> ADR-029 Accepted
-> P3 Slice A implements production closure
-> P3 Slice B implements first Derived Resource capability
```

No pre-acceptance P2 implementation slice is required.

## P3 Slice A implementation gate

P3 Slice A should implement the production closure for the accepted contracts while keeping the initial input scope bounded to Markdown/TXT.

It must cover at least:

- production Source captured/published selection semantics;
- multiple immutable ParsedArtifacts for one raw SourceVersion after parser/normalization/schema/config change;
- production Evidence persistence/read path;
- persistent Answer/CitationRef owner;
- frozen GenerationRun/scope/snapshot across multiple retrieval calls;
- DeliveredEvidence provenance;
- SQLite FTS retrieval adapter over the accepted canonical boundary;
- publication generation and stale-worker fencing at business commit;
- crash recovery across bundle write, metadata commit and publication;
- historical citation reopening after index GC/rebuild;
- canonical backup/restore sufficient to rebuild usable retrieval;
- no regression in host-authoritative workspace/worktree behavior.

Acceptance scenarios include:

1. same raw SourceVersion parsed under a newer parser/normalization identity creates a new immutable ParsedArtifact while the old artifact remains valid;
2. out-of-order update tasks cannot publish an older selection over a newer intent;
3. a run performs retrieval, publication/GC occurs, and a later retrieval in the same run still uses the original protected snapshot;
4. a worker loses its lease and cannot publish a visible result even if its handler later returns successfully;
5. interruption between bundle write, metadata commit and publication recovers without falsely reporting success;
6. reclaimable old retrieval index data can be removed while retained historical Answer citations still reopen canonical Evidence;
7. restore from retained canonical state rebuilds a usable retrieval projection.

Current repository typecheck/test debt is an implementation baseline concern, not evidence that this canonical architecture is rejected. P3 Slice A must not claim production green until its declared verification gates pass.

## P3 Slice B implementation gate

Slice B adds one Derived Resource type first: **Quiz or Interview**.

It must cover:

- immutable ArtifactRevision history;
- candidate -> accept flow;
- user edits preserved as newer revisions;
- pinned/follow-current dependency policy;
- published Source/ParsedArtifact change -> `needs-review` for follow-current artifacts;
- concurrent regenerate/accept cannot overwrite a newer user edit;
- historical revisions remain reopenable.

Slice B is not a blocker for Slice A or ADR acceptance.

## Non-decisions

ADR-029 does not select:

- Qdrant;
- a Dense embedding model;
- Hybrid/RRF;
- reranking;
- late interaction / multivector;
- Docling as a mandatory V1 parser;
- MCP as a current integration layer;
- AnythingLLM/Open WebUI as production dependencies;
- a general workflow engine;
- a second canonical DocumentIR identity.

## Upgrade triggers

Reopen advanced retrieval only when at least one decision-relevant failure exists, for example:

- lexical Recall/complete-span coverage regresses on a new frozen representative corpus;
- target-scale FTS latency/memory/update cost misses a declared SLO;
- multilingual semantic paraphrase/code/version cases show repeatable lexical recall gaps;
- metadata/multimodal requirements exceed an economical SQLite implementation;
- a Dense/Hybrid/Qdrant/external provider passes the same scope, historical Evidence, recovery and end-to-end quality contracts with material net benefit.

## Acceptance record

ADR-029 is Accepted because the remaining architecture blockers identified by final independent review are now frozen as normative contracts:

1. captured versus published Source selection, including explicit SourceVersion + ParsedArtifact + publication generation;
2. frozen GenerationRun scope/retrieval snapshot with fail-closed behavior and DeliveredEvidence provenance;
3. historical canonical retention closure independent of retrieval-index GC, with archive distinct from purge;
4. worker fencing at business commit so stale workers cannot publish user-visible state;
5. ParsedArtifact migration/identity rules that preserve old immutable artifacts when parser/schema/normalization/config changes.

Implementation of these contracts is assigned to P3 Slice A/B acceptance gates and is not claimed complete by this ADR.

## Final Decision

**ACCEPTED — Pi owns canonical Knowledge truth and long-lived lineage; SQLite FTS5 is the V1 retrieval projection behind the accepted boundary.**

P3 is not started by this ADR change. No automatic merge is authorized.
