# P2-T12 — Knowledge Domain / Retrieval Boundary ADR

Status: **PASS — ADR-029 ACCEPTED**

## Outcome

P2 has now closed both parts of the architecture decision:

1. the evidence-backed V1 retrieval choice;
2. the canonical Knowledge ownership/lifecycle boundary Pi must freeze before P3.

ADR-029 is Accepted on the following principle:

> **Pi owns the knowledge truth and long-lived lineage. Files, parsers, indexes, models and external RAG systems are replaceable inputs, projections or adapters.**

P3 implementation is not claimed complete by this task.

## V1 retrieval decision

Measured retrieval evidence supports:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10 default
```

The tested Dense candidates regressed the frozen FTS comparator. Dense / sqlite-vec / Hybrid / Qdrant / rerank remain future options only if new frozen quality or operational evidence demonstrates material net benefit.

`Top-K = 10` is a provider/evaluation default, not a canonical domain invariant.

## P2-T10 — PASS

Direct-file Pi independent semantic review remains:

```text
50 queries
48 correct
0 partial
2 incorrect
0 material version/conflict mistakes
```

The residual mistakes are no-answer / negative-evidence issues, reinforcing that grounded-generation discipline is distinct from retrieval candidate recall.

## P2-T11 — PASS on decision sufficiency

AnythingLLM fixed-version evidence established:

- historical citation durability PASS for the tested source replacement + restart + reopen-old-citation path;
- 47/50 first-attempt formal-run success;
- 39/39 successful answerable responses semantically correct;
- all required Golden documents present in returned top-4 for all successful answerable responses;
- primary weakness concentrated in no-answer / negative-evidence discipline;
- raw API reasoning-tag exposure requiring adapter sanitization if integrated.

The full Open WebUI long benchmark is intentionally de-scoped. Its completion no longer carries enough decision value after the architecture question was separated into Pi-owned canonical semantics versus replaceable retrieval/RAG infrastructure.

## Accepted canonical boundary

Pi owns:

```text
host-authoritative KnowledgeWorkspace scope
Source
immutable SourceVersion
immutable ParsedArtifact carrying versioned DocumentIR
Stable Evidence independent of retrieval chunk/vector identity
published Knowledge selection / publication generation
GenerationRun + frozen ScopeManifest / retrieval snapshot
DeliveredEvidence per model invocation/attempt
Answer / CitationRef -> Evidence
DerivedArtifact + immutable ArtifactRevision
provenance / dependency policy / freshness state
canonical retention closure
```

Retrieval indexes and external-product IDs remain projections/adapters, not canonical identity.

## Final architecture-review changes incorporated

The final Astra review returned **ACCEPT WITH CHANGES** and identified four architecture blockers plus one migration constraint. All are now incorporated into ADR-029 as normative contracts.

### 1. Captured versus published Source selection

`latestCapturedVersionId` and the currently published usable selection are distinct.

The published selection binds at least:

```text
sourceVersionId
parsedArtifactId
publication/selection generation
```

A capture/parse/index failure leaves the previous published generation active. Repeated content such as A -> B -> A must not use timestamp ordering to infer current state.

### 2. Frozen GenerationRun scope

Before first retrieval, a GenerationRun freezes and protects the host-authoritative scope plus a consistent retrieval/publication snapshot.

Subsequent tool/retrieval calls cannot reacquire `latest`. Snapshot loss is fail-closed. Mid-run parser/publication changes cannot silently alter the ParsedArtifact set.

`DeliveredEvidence` records the ordered canonical Evidence spans actually submitted after application-side trimming/serialization for each invocation/attempt.

### 3. Historical retention closure

Retained Answer/CitationRef and ArtifactRevision history retain the canonical chain needed to reopen them:

```text
Answer / ArtifactRevision
-> CitationRef / dependency
-> Evidence
-> ParsedArtifact
-> SourceVersion
```

IndexBuild GC is separate from canonical retention. `archive` does not mean historical purge. Explicit purge may make old history unavailable and must be represented explicitly.

### 4. Worker fencing at business commit

A worker that has lost its valid execution lease cannot publish:

- current/published Source selection;
- active retrieval build;
- Answer;
- accepted artifact candidate;
- any other user-visible state.

Lease/generation ownership is validated at the visible business commit boundary, not only after a handler returns.

### 5. ParsedArtifact identity/migration

One raw SourceVersion may have multiple immutable ParsedArtifacts when parser/schema/normalization/config changes.

The existing SQL uniqueness shape `UNIQUE(source_version_id, parser_version)` is not treated as the final identity contract. P3 migration must include every interpretation-changing input and never rewrite old immutable artifact identity.

## Derived Resource contract

V1 uses:

```text
DerivedArtifact
└── immutable ArtifactRevision
```

Dependency policy:

```text
pinned
follow-current
```

Minimal freshness state:

```text
current
needs-review
```

`follow-current` reacts to changes in the published SourceVersion/ParsedArtifact selection. `current` means freshness-policy satisfied, not semantically proven correct. Candidate acceptance and user edits must preserve immutable revision history and cannot overwrite newer user work.

## Retrieval boundary

Retrieval remains a rebuildable projection over canonical Knowledge.

V1 uses the existing SQLite FTS implementation behind the accepted boundary. The provider/adapter must not own SourceVersion, ParsedArtifact, Evidence, GenerationRun, DerivedArtifact or citation identity.

No large generic provider framework is required in V1. Future Qdrant/Dense/Hybrid/rerank/external-RAG work requires new evidence and must preserve the accepted canonical contracts.

## Backup / restore contract

Canonical backup must retain the content and versioned configuration identity needed to rebuild a **usable** retrieval projection.

The contract does not promise byte-identical SQLite index files or byte-for-byte replay across model/runtime versions.

## Repository reality

The final architecture review classified the current implementation as **natural evolution / bounded refactor**, not a rewrite.

Keep/evolve:

- Source / SourceVersion;
- CAS;
- ParsedArtifact canonicalization;
- Stable Evidence and read validation;
- SQLite FTS5;
- IndexBuild publication/retention;
- durable job lease/fencing core;
- host-authoritative Workspace/Path/worktree scope.

Tighten in P3 Slice A:

- implicit timestamp-based current selection;
- duplicated import-job state ownership;
- query-local `runHandle` used as generation identity;
- fixture/probe-only production paths;
- ParsedArtifact identity that only distinguishes source version + parser version.

The main implementation risk is crash/retry consistency across bundle writes, SQLite metadata, publication, IndexBuild activation, job completion and backup.

## ADR acceptance versus implementation readiness

ADR acceptance freezes architecture contracts. It does not require production wiring to be complete before acceptance.

Correct sequence:

```text
P2 evidence
-> ADR-029 contract freeze
-> ADR-029 Accepted
-> P3 Slice A production closure
-> P3 Slice B first Derived Resource
```

No pre-acceptance P2 implementation slice is required.

## P3 Slice A handoff

Slice A should remain initially bounded to Markdown/TXT and must close the production path for:

- captured versus published Source selection;
- multiple immutable ParsedArtifacts for one raw SourceVersion;
- production Evidence persistence/read path;
- persistent Answer/CitationRef owner;
- frozen GenerationRun/snapshot across multiple retrieval calls;
- DeliveredEvidence provenance;
- SQLite FTS retrieval adapter;
- publication generation and worker fencing;
- crash recovery across bundle/metadata/publication boundaries;
- historical citation reopening after index GC/rebuild;
- backup/restore sufficient to rebuild usable retrieval;
- no regression in host-authoritative workspace/worktree behavior.

Implementation acceptance must also account for the current non-green typecheck/focused-test baseline recorded by final review; architecture acceptance is not production-green evidence.

## P3 Slice B handoff

Slice B should implement one Derived Resource type first: Quiz **or** Interview.

Required behavior:

- immutable ArtifactRevision history;
- candidate -> accept flow;
- user edits preserved as newer revisions;
- pinned/follow-current dependency policy;
- published Source/ParsedArtifact changes -> `needs-review` for follow-current artifacts;
- concurrent regenerate/accept cannot overwrite newer user edits;
- historical revisions remain reopenable.

Slice B is not an ADR or Slice A blocker.

## Final state

P2-T12 is **PASS** and ADR-029 is **ACCEPTED**.

No P3 implementation is performed in this task. No automatic merge is authorized.
