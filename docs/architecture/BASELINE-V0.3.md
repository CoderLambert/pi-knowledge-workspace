# Architecture Baseline V0.3

## Status

**Conditional Go.** Architecture discussion is considered sufficiently mature to enter bounded spikes and vertical slices. This document records the current baseline; details may change only when a spike or benchmark provides contrary evidence.

## 1. System boundaries

```text
PI WEB fork
│
├─ existing coding/workspace capabilities
├─ Knowledge UI
└─ later: Course UI
        │
        ▼
pi-knowledge
├─ source lifecycle
├─ parsing
├─ retrieval
├─ evidence/citation
├─ restricted Ask
├─ notes
└─ durable jobs
        │
        ├─ SQLite + blob/artifact storage
        └─ Pi SDK / model providers
```

PI WEB remains responsible for its existing Machine / Project / Workspace / Session / Files / Terminal / Git / remote-workspace behavior. Knowledge processing is not implemented inside PI WEB session infrastructure.

## 2. Thin Fork boundary

We intentionally fork PI WEB because Knowledge and Learning are becoming first-class product surfaces, not optional third-party add-ons.

The fork should remain thin:

- preserve upstream Machine / Workspace / Session / Terminal / Git behavior;
- concentrate custom code under clearly owned Knowledge/Learning modules;
- avoid scattered patches to unrelated upstream files;
- never copy knowledge indexing, model jobs, or databases into PI WEB client/session code;
- synchronize selected stable upstream releases instead of continuously tracking `main`.

## 3. Knowledge data lifecycle

```text
Source
  ↓
SourceVersion             immutable raw snapshot
  ↓
ParsedArtifact            immutable canonical text + mapping
  ├──────────────→ Evidence
  │
  └→ IndexBuild           rebuildable
      ├─ Chunk
      ├─ FTS
      ├─ Embedding
      └─ Vector index
```

### Stable / authoritative

- SourceVersion
- ParsedArtifact while referenced
- Evidence
- AnswerRevision
- NoteRevision
- generation/scope metadata needed to reproduce provenance

### Rebuildable

- Chunk
- FTS index
- embeddings
- vector index
- retrieval intermediate results

A citation must never depend only on the current Chunk ID.

## 4. Evidence protocol

V1 anchors evidence to canonical UTF-8 text using:

```text
artifact hash
+ byte range [start_byte, end_byte)
+ exact quote
+ quote hash
```

Heading / line / page / anchor data are display locators, not the sole stable identity.

Saved answers/notes pin the source snapshot, artifact and evidence they reference. Unreferenced old index builds may be garbage-collected after leases expire.

## 5. Ask scope

Every Knowledge Ask uses an immutable ScopeManifest fixed at submission time. It includes at least:

- knowledge workspace
- selected source-version IDs
- parsed-artifact IDs
- eligible index builds / embedding profile
- retrieval configuration revision
- model / prompt / tool-policy revision

A source update during an AnswerRun does not silently change that run's evidence scope.

## 6. Restricted Knowledge Ask

Knowledge Ask is not the normal coding session.

Allowed model-visible tools:

- `knowledge_sources`
- `knowledge_search`
- `knowledge_read`
- `submit_answer`

Not available:

- shell
- arbitrary file read/write/edit
- arbitrary network tools
- automatic project/global Skills or extensions

The implementation must use a controlled ResourceLoader, in-memory session/settings where practical, explicit tool allowlists, and filtered model credentials/configuration.

This is a model-capability boundary, not an OS sandbox claim.

## 7. Grounding semantics

Grounding is not represented as a single boolean.

```text
integrity: valid | invalid
semantic: unchecked | supported | unsupported | uncertain
review:    unreviewed | user-reviewed
```

V1 may ship with `semantic=unchecked`; deterministic checks validate citation identity, scope, delivered evidence, ranges and quote integrity. An online semantic checker is not required for V1.

## 8. Notes

Saved notes are a first-class V1 product artifact.

- Note edits create immutable NoteRevision records.
- optimistic concurrency prevents silent overwrites;
- changing block text invalidates any previous semantic-support judgement for that block;
- notes are not automatically re-indexed as authoritative source material;
- Markdown export includes human-readable citations and quoted evidence without access tokens.

## 9. Retrieval strategy

Do not assume Hybrid retrieval is automatically best. Compare under a fixed corpus/scope/evidence budget:

1. direct/full-context baseline where applicable;
2. FTS lexical baseline;
3. Dense retrieval;
4. FTS + Dense + RRF.

Special evaluation coverage is required for Chinese text, mixed Chinese/English technical documentation, code symbols, API names, versions and error codes.

Reranking is deferred until recall is sufficient but ranking remains a demonstrated failure mode.

## 10. Storage and jobs

V1 defaults to one local application and SQLite. No Redis/MQ/distributed database is required.

Durable jobs support:

```text
queued → running → succeeded | failed | cancelled
```

with idempotency, attempts, cancellation, crash recovery, leases/fencing where needed, bounded retries and atomic publication of new index builds. Old active indexes remain queryable until replacement builds are complete and validated.

## 11. Workspace ownership

Knowledge maintains its own persistent installation/workspace identity and binds it to PI WEB project/workspace context and canonical real paths.

Worktrees are isolated by default. Cross-worktree/shared libraries are explicit future features, not implicit behavior based on Git remote or directory names.

## 12. V1 / V1.1 split

### V1

```text
Source → Evidence → Retrieval → Restricted Ask → Saved Note
```

### V1.1

```text
Learning Goal
→ editable outline
→ user confirmation
→ chapter generation
→ citation validation
→ candidate/accepted revisions
```

No Course Service, graph DB, workflow DSL or four-agent orchestration framework is planned.
