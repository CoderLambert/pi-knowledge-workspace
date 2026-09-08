# Pi Knowledge Learning Workspace

> Thin fork of `jmfederico/pi-web` for a local-first Coding + Knowledge + Learning workspace.

## Product direction

This repository keeps PI WEB as the coding/workspace foundation and adds first-party knowledge capabilities without moving RAG, indexing, or learning workflows into PI WEB core.

```text
PI WEB fork
├─ Coding Chat / Files / Terminal / Git     upstream-first
├─ Knowledge UI                             ours
└─ Course UI                                ours, V1.1+
        │
        ▼
pi-knowledge
├─ Sources / snapshots
├─ Parsing
├─ Retrieval
├─ Stable Evidence
├─ Restricted Knowledge Ask
├─ Notes / revisions
└─ Jobs / recovery
```

## V1 promise

> Import selected technical documents, find evidence, ask questions against fixed source versions, and save traceable answers as editable notes.

```text
Markdown / TXT / selected workspace file
→ immutable source snapshot
→ parsed artifact
→ retrieval
→ stable evidence
→ restricted Knowledge Ask
→ answer revision
→ saved note
→ edit / reopen / Markdown export
```

## V1 scope

### Must

- Markdown / TXT / explicit workspace-file import
- immutable source snapshots and manual update
- stable parsed artifacts and evidence
- retrieval baseline and evaluation
- `knowledge_search`, `knowledge_read`, `knowledge_sources`
- restricted Knowledge Ask session
- deterministic citation integrity checks
- notes with immutable revisions and conflict protection
- jobs, retry/cancel/recovery, atomic index publication
- migrations and backup/restore

### Later

- PDF / URL import
- automatic semantic checker
- reranker
- Course generation
- quiz / flashcards / learning progress
- source watchers
- multi-user / RBAC / cloud sync

## Non-goals

V1 does not promise zero hallucination, absolute truth, automatic complete knowledge coverage, cross-machine aggregated retrieval, or multi-tenant isolation.

## Core architectural rules

1. **Thin Fork** — keep upstream PI WEB behavior intact unless the product requires a first-party integration point.
2. **Knowledge is not Agent memory** — authoritative knowledge state lives outside Pi sessions.
3. **Stable evidence, rebuildable indexes** — citations never depend only on current chunk IDs.
4. **Restricted Ask is separate from Coding Chat** — knowledge Q&A does not inherit shell/write/arbitrary-network capabilities.
5. **Reliability before feature breadth** — retry, recovery, migration, backup, versioning and evaluation are V1 correctness requirements.
6. **Benchmark retrieval** — FTS / Dense / Hybrid are evaluated; Hybrid is not assumed by architecture.
7. **Course waits for V1.1** — first prove reliable evidence and useful grounded Q&A.

## Development status

Current state: **Conditional Go → bounded implementation spike**.

See:

- `docs/architecture/BASELINE-V0.3.md`
- `docs/development/PHASES.md`
- `docs/UPSTREAM.md`
- `docs/architecture/ADR-027-thin-fork.md`
