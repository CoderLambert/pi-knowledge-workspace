# P2-T12 verification — Knowledge Domain / Retrieval Boundary ADR

Status: **PASS — ADR-029 ACCEPTED**

## Verification conclusion

P2-T12 verifies that the evidence-backed V1 retrieval choice and Pi-owned canonical Knowledge boundary are now sufficiently specified for ADR acceptance.

This verification does **not** claim that P3 production implementation is complete or green.

## Retrieval evidence — PASS for V1 selection

P2-T04/P2-T05/P2-T06/P2-T09 support:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10 default
```

Frozen development evidence:

```text
Recall@10 = 1.0
MRR = 0.9365079365079365
all-required Evidence coverage = 1.0
```

Expanded evidence:

```text
Recall@10 = 1.0
MRR = 0.928921568627451
all-required Evidence coverage = 1.0
```

One-shot aggregate holdout after profile freeze:

```text
Recall@10 = 1.0
MRR = 0.9166666666666666
coverage = 1.0
```

The tested Dense candidates regressed the frozen FTS comparator. Advanced retrieval remains reopenable only with new frozen evidence showing material product or operational benefit.

`Top-K = 10` is not a canonical-domain invariant.

## P2-T10 direct-file Pi — PASS

Owner-authorized independent semantic review remains:

```text
correct = 48
partial = 0
incorrect = 2
no-answer hallucinations = 2
version/conflict mistakes = 0
material Evidence omissions = 0
```

The remaining failure pattern supports keeping grounded-generation/no-answer policy separate from retrieval-backend selection.

## P2-T11 mature-product evidence — PASS on decision sufficiency

AnythingLLM formal development evidence:

```text
50 records
47 success
3 first-attempt runtime/API failures
39/39 successful answerable responses semantically correct
JSONL SHA-256 d62197426809c28636c8d04d609a901c613237c9be1a448364775c487c4b1cb9
```

Historical citation durability for the tested AnythingLLM path remains **A / PASS** after source replacement + restart + reopen-old-citation.

The full Open WebUI long benchmark is intentionally de-scoped. Partial diagnostics are not a formal comparative score and are not required for ADR acceptance.

## Final architecture review — ACCEPT WITH CHANGES

The final independent Astra review accepted the architecture direction and required four normative contract changes plus ParsedArtifact migration closure.

All are incorporated into ADR-029.

### Gate 1 — capture/publication consistency: PASS at contract level

ADR now requires:

- captured state distinct from published usable state;
- published selection identifies `SourceVersion + ParsedArtifact + publication generation`;
- parse/index failure preserves the previous usable publication;
- repeated-content A -> B -> A does not use timestamp ordering as current selection;
- publication is consistent with the retrieval snapshot for the same generation;
- older asynchronous work cannot publish over newer intent.

Exact table/manifest layout is deferred to P3 Slice A.

### Gate 2 — frozen GenerationRun scope: PASS at contract level

ADR now requires each GenerationRun to acquire before first retrieval and retain:

- host-authoritative workspace scope;
- consistent publication/scope manifest;
- retrieval snapshot/active-build identity;
- versioned retrieval configuration provenance.

Subsequent calls cannot reacquire latest. Snapshot loss is fail-closed. Mid-run parser/publication changes cannot silently alter the run.

`DeliveredEvidence` is recorded per invocation/attempt after application-side trimming/serialization and identifies the ordered canonical spans actually submitted.

### Gate 3 — historical retention closure: PASS at contract level

ADR now separates canonical retention from retrieval-index retention.

Retained Answer/CitationRef and ArtifactRevision history retain the canonical chain:

```text
Answer / ArtifactRevision
-> CitationRef / dependency
-> Evidence
-> ParsedArtifact
-> SourceVersion
```

Archive is distinct from purge. Ordinary index GC cannot destroy retained historical citations. Active runs and backup boundaries protect the objects/snapshots they require.

Persistent Answer/CitationRef ownership is explicitly part of P3 Slice A and cannot be postponed to Slice B.

### Gate 4 — business-commit worker fencing: PASS at contract level

ADR now requires:

> A worker without a valid execution lease cannot publish current selection, active retrieval build or any user-visible result.

Visible publication must validate execution ownership plus expected generation/state at the commit boundary. Handler-return-time lease validation alone is insufficient.

### Gate 5 — ParsedArtifact identity/migration: PASS at contract level

ADR now freezes that:

- a raw SourceVersion may have multiple immutable ParsedArtifacts;
- parser/schema/normalization/config changes that affect interpretation create a new artifact identity;
- old artifact identity is never rewritten;
- the current `UNIQUE(source_version_id, parser_version)` shape is not treated as the final identity contract.

Exact encoding/columns remain a P3 migration decision.

## Canonical boundary — verified

Accepted ownership:

```text
KnowledgeWorkspace / host-authoritative scope
Source
immutable SourceVersion
immutable ParsedArtifact / versioned DocumentIR
Stable Evidence independent of retrieval chunk/index identity
published Knowledge selection / publication generation
GenerationRun / frozen ScopeManifest / retrieval snapshot
DeliveredEvidence
Answer / CitationRef -> Evidence
DerivedArtifact / immutable ArtifactRevision
provenance / dependency policy / freshness state
canonical retention closure
```

Retrieval indexes, chunk/vector IDs and external-product source IDs are not canonical identity.

## Derived Resource contract — verified

V1 contract:

```text
DerivedArtifact
└── immutable ArtifactRevision

policy:
  pinned
  follow-current

freshness:
  current
  needs-review
```

`follow-current` tracks changes in the **published** SourceVersion/ParsedArtifact selection. `current` means freshness-policy satisfied, not semantic correctness proven. Candidate generation/acceptance may not overwrite newer user revisions.

A separate heavyweight canonical `CitationAnchor` aggregate is not required in V1; durable `CitationRef -> Evidence` is sufficient.

## Retrieval boundary — verified

SQLite FTS5 remains the V1 retrieval projection.

The adapter/provider boundary must not own:

- SourceVersion/ParsedArtifact identity;
- Stable Evidence;
- GenerationRun identity;
- DerivedArtifact lineage;
- canonical citation identity.

A future provider may add Dense/Hybrid/Qdrant/rerank/external retrieval only after new evidence and while preserving these contracts.

## Backup / restore contract — verified

Restore must be able to rebuild a **usable** retrieval projection from retained canonical content plus versioned configuration identity.

No byte-for-byte deterministic reproduction of SQLite index files, model outputs or environment-specific storage is required.

## ADR acceptance gate versus P3 implementation gate

Architecture acceptance is separate from implementation readiness.

Accepted now:

- identity and ownership semantics;
- capture/publication semantics;
- frozen run scope and DeliveredEvidence semantics;
- canonical retention closure;
- DerivedArtifact revision/dependency semantics;
- worker fencing principle;
- ParsedArtifact migration identity rules;
- retrieval projection boundary;
- evidence-backed V1 retrieval choice.

Deferred to P3 Slice A implementation/verification:

- production ParsedArtifact store/migration;
- Answer/CitationRef persistence;
- real multi-call GenerationRun runtime;
- production composition root;
- import/worker publication refactor;
- crash/retry closure across bundle/metadata/publication;
- backup/restore wiring;
- dependency/installation verification;
- typecheck/test closure.

P3 Slice B adds the first Derived Resource type and is not an ADR/Slice A blocker.

## Repository reality / current implementation debt

Final review classified the codebase as **natural evolution / bounded refactor**.

Keep/evolve:

- Source/SourceVersion;
- CAS;
- ParsedArtifact canonicalizer;
- Stable Evidence/read validation;
- SQLite FTS5;
- IndexBuild publication/retention;
- durable job lease/fencing core;
- host-authoritative Workspace/worktree boundaries.

Known debt to close in P3 Slice A includes implicit timestamp-based current selection, duplicated import-job state ownership, query-local run identity, production probe/fixture wiring, and incomplete ParsedArtifact interpretation identity.

Final review also reproduced a non-green implementation baseline:

```text
npm run typecheck
exit 2
12 TypeScript errors

npm test -- --run src/knowledge pi-web-plugins/knowledge
exit 1
39 files passed / 4 failed
204 tests passed / 9 failed
```

These are implementation debts, not evidence against the accepted canonical architecture. They must not be described as production green.

## P3 Slice A acceptance scenarios recorded

P3 Slice A must verify at least:

1. one raw SourceVersion can produce a newer immutable ParsedArtifact while old artifacts remain valid;
2. out-of-order update completion cannot publish stale selection over newer intent;
3. after the first retrieval, publication/GC changes do not change the frozen snapshot used by later calls in the same run;
4. a worker that loses its lease cannot publish user-visible results even if its handler later returns;
5. interruption between bundle write, metadata commit and publication recovers without falsely reporting success;
6. reclaimable retrieval-index data can be deleted while retained historical Answer citations still reopen canonical Evidence;
7. restore from retained canonical state rebuilds a usable retrieval projection;
8. host-authoritative workspace/path/worktree behavior remains unchanged.

## ADR state

ADR-029 is **ACCEPTED**.

P2-T12 is **PASS**.

No P3 implementation is performed by this verification update. No automatic merge is authorized.
