# P2-T12 verification — Knowledge Domain / Retrieval Boundary ADR

Status: **BLOCKED ON ARCHITECTURE CONTRACT FINALIZATION**

## Retrieval evidence — PASS for V1 selection

P2-T04/P2-T05/P2-T06/P2-T09 continue to support:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

The tested Dense candidates are not justified for V1. Advanced retrieval remains reopenable only with new frozen evidence demonstrating material benefit.

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

## P2-T11 mature-product gate — PASS on decision sufficiency

Decision-critical mature-product evidence is complete enough to establish:

- generic mature local RAG/retrieval can perform strongly on answerable frozen queries;
- AnythingLLM v1.16.1 preserves one directly observed historical citation path after source replacement + restart;
- mature-product capability does not establish Pi's stronger canonical SourceVersion/ParsedArtifact/Evidence/generation/artifact lifecycle semantics.

AnythingLLM formal development evidence:

```text
50 records
47 success
3 first-attempt runtime/API failures
39/39 successful answerable responses semantically correct
JSONL SHA-256 d62197426809c28636c8d04d609a901c613237c9be1a448364775c487c4b1cb9
```

The full Open WebUI long benchmark is intentionally de-scoped and is not an ADR acceptance requirement. Partial diagnostics must not be promoted to a formal score or tuned/retried for symmetry.

## Current ADR acceptance gate

ADR-029 is no longer blocked on additional mature-product benchmarking.

It remains blocked until the following contracts are frozen and reconciled with the current repository implementation:

1. `Source` selection/current-version semantics, including repeated historical content A -> B -> A;
2. immutable `SourceVersion` raw snapshot contract;
3. immutable versioned `ParsedArtifact` carrying DocumentIR/canonical content/parser identity;
4. Stable Evidence anchored to historical canonical content, not retrieval chunk/vector identity;
5. frozen `GenerationRun` / `ScopeManifest` and recorded `DeliveredEvidence`;
6. `DerivedArtifact` with immutable `ArtifactRevision` history and pinned/follow-current dependency policy;
7. `CitationRef -> Evidence` historical reopening contract;
8. SQLite FTS retrieval adapter/provider as a rebuildable projection;
9. production persistence / backup / restore / retention closure;
10. repository reality check distinguishing production-wired, partial and fixture-only implementation.

## Acceptance proof

A bounded end-to-end vertical slice is the preferred acceptance proof:

```text
Source A
-> SourceVersion A
-> ParsedArtifact A
-> Evidence A
-> SQLite FTS IndexBuild A
-> frozen generation scope
-> grounded answer
-> Quiz/Interview ArtifactRevision A
-> Source B update
-> pinned history preserved / follow-current needs-review
-> restart
-> index GC
-> backup / restore
-> historical A still resolves
```

Required properties:

- new-version parse/index failure does not destroy the old usable version;
- retrieval index identity is not a long-lived citation/artifact identity;
- source/index changes during a GenerationRun cannot silently mix generations;
- historical Evidence and ArtifactRevision survive restart/index rebuild/retention operations;
- canonical backup/restore is sufficient even if retrieval indexes are rebuilt.

## ADR state

ADR-029 remains **BLOCKED**, not Accepted.

Do not enter normal P3 before formal acceptance. Do not restart Open WebUI or other broad product benchmarking merely to satisfy the superseded comparison checklist.

No automatic merge.
