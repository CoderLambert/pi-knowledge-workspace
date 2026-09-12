# Obsidian + Codex Migration Inventory

This document turns ADR-030 into an executable migration plan. It intentionally separates **workspace commodity** from **differentiated reliability semantics** so the project can stop maintaining a full PI WEB product without throwing away the strongest Knowledge work.

## Target

The target is not another monolithic application.

```text
pi knowledge system
│
├─ Obsidian Vault
│  ├─ notes / projects / sources
│  ├─ frontmatter conventions
│  ├─ backlinks / MOCs / dashboards
│  └─ optional focused plugins
│
├─ Codex layer
│  ├─ AGENTS.md
│  ├─ reusable workflows
│  ├─ scripts / commands
│  └─ external-tool adapters
│
├─ Git
│  ├─ diff / history / rollback
│  └─ reviewable automation changes
│
└─ optional evidence core
   ├─ immutable SourceVersion
   ├─ ParsedArtifact identity
   ├─ Stable Evidence
   ├─ GenerationRun / DeliveredEvidence
   ├─ Answer / Citation lineage
   └─ durable lifecycle safety
```

The default workflow must remain useful when the optional evidence core is not running.

## Disposition matrix

### A. Retire — no longer product-owned

| Area | Existing responsibility | Why retire | Replacement |
| --- | --- | --- | --- |
| PI WEB fork shell | Browser application shell, workspace navigation, panels | Commodity for the Knowledge use case | Obsidian |
| Knowledge Product Preview | Import/Publish/Ask/Citation UI | Duplicates note/editor/workspace surface | Obsidian + Codex command/workflow |
| Knowledge Sources UI | Source list/version/detail navigation | Most normal sources can be represented as vault files + metadata | Obsidian views/properties; evidence viewer only for immutable provenance cases |
| Saved-note editor | Editable answer/note surface | Native Markdown is the desired durable format | Obsidian |
| Workspace file browser | Selection and browsing | Native platform capability | Obsidian / Codex filesystem tools |
| Note revision UI | User-edit history | Git already provides reviewable text history for vault notes | Git |
| Custom course application UI | Outline/chapter/quiz presentation | Premature product surface | Markdown templates + Codex workflow |
| Knowledge-specific Fleet routing | Gateway/target Knowledge transport | Not part of the new local-first vault product | External runtime/deployment choice |
| PI WEB upstream synchronization for Knowledge | Maintaining a product fork | High maintenance with little differentiated value | Stop after extraction |

### B. Replace by default — keep only if benchmarks later justify custom infrastructure

| Area | Current approach | New default | Reintroduce only when |
| --- | --- | --- | --- |
| Vault lexical search | SQLite FTS5 custom index | Obsidian search + Codex file/search tools | Measured retrieval failures materially affect target workflows |
| Dense/vector retrieval | Candidate/future adapters | None | Frozen evaluation shows material net benefit over direct/lexical workflows |
| Hybrid/RRF/rerank | Candidate/future adapters | None | Same evidence gate as above |
| Ordinary MD/TXT import | Capture into Knowledge service | Create/copy normalized Markdown into Vault | Immutable external-source guarantees are required |
| Generic Ask | Restricted Pi runtime | Codex operating directly on Vault | Strong tool isolation is a real requirement, not a theoretical one |
| Workspace backup | Service DB backup tooling | Filesystem/Vault backup + Git | Evidence-core state is enabled |

### C. Adapt — preserve the capability, change the integration boundary

| Capability | New boundary |
| --- | --- |
| Source metadata | Vault frontmatter for ordinary sources; optional evidence-core identifiers for immutable/reference sources |
| Import pipelines | Codex/scripts produce vault-native Markdown and attachments first; provenance capture is optional |
| RSS/web ingestion | Feed/read tool → Inbox Markdown → Codex normalize/classify/link → Git |
| Knowledge workflows | Codex commands/skills rather than browser-only product actions |
| MOC/dashboard generation | Generated/maintained Markdown or Obsidian query/plugin surfaces |
| Course/learning workflows | Codex generates revisions into Markdown; UI comes later only if repeated use proves a gap |
| Evidence viewer | Prefer direct vault links; provide a narrow viewer only for historical immutable evidence not representable by the current file |

### D. Extract — differentiated assets worth preserving

These are the strongest parts of the existing work and should not be rewritten as Obsidian features.

| Asset | Keep because |
| --- | --- |
| canonical `Source` / immutable `SourceVersion` | Git history is not a substitute for explicit external-source identity in every workflow |
| content-addressed raw bytes | Supports reproducible external-source provenance |
| immutable `ParsedArtifact` interpretation identity | Parser/normalization/schema changes remain explicit instead of silently mutating evidence |
| Stable Evidence | Historical citation identity survives rechunk/reindex/retrieval changes |
| exact/context/section Evidence read | Provides bounded, reproducible historical reopening |
| publication generation / CAS | Prevents stale asynchronous work from becoming current |
| frozen `GenerationRun` / scope | Prevents one answer from silently mixing different publication generations |
| `DeliveredEvidence` | Records what the model actually received, not merely what retrieval found |
| Answer / CitationRef lineage | Enables deterministic citation reopening and integrity checks |
| IndexBuild pin/lease/GC semantics | Needed when a generation depends on a rebuildable index projection |
| durable job fencing | Prevents stale workers from committing user-visible state |
| recovery / archive-vs-purge semantics | Reliability property independent of workspace UI |
| evidence-core backup/restore | Needed if the optional provenance engine remains enabled |
| retrieval evaluation harness | Useful for deciding whether custom retrieval is justified; not itself the product |

## Proposed extracted shape

Do not extract all old code mechanically. Extract by contract.

```text
packages/
└─ evidence-core/
   ├─ domain/
   │  ├─ source
   │  ├─ parsed-artifact
   │  ├─ evidence
   │  └─ generation
   ├─ storage/
   │  ├─ sqlite
   │  ├─ blob-store
   │  └─ backup-restore
   ├─ retrieval/
   │  └─ fts5          # optional projection, not canonical truth
   └─ service/         # optional local/headless boundary

vault-template/
├─ 00 Inbox/
├─ 10 Projects/
├─ 20 Areas/
├─ 30 Knowledge/
├─ 40 Sources/
├─ 90 Reviews/
└─ 99 System/
   ├─ Templates/
   └─ MOCs/

workflows/
├─ process-inbox.md
├─ process-rss.md
├─ link-notes.md
├─ build-moc.md
├─ weekly-review.md
└─ research-with-evidence.md

AGENTS.md
```

The final repository may be a new repository instead of this fork. That decision should happen **after** extraction boundaries are proven, so history remains available while assets are moved.

## Vault contract v0

Use ordinary Markdown as the primary protocol.

Recommended minimum frontmatter:

```yaml
---
type: note
created: 2026-09-12
updated: 2026-09-12
status: active
tags: []
---
```

Source notes may additionally carry:

```yaml
source:
  kind: rss | web | file | manual
  url: null
  captured_at: null
  evidence_source_id: null
  evidence_source_version_id: null
```

`evidence_*` fields are optional. Ordinary vault content must not depend on the evidence service.

## Codex operating contract v0

The future root `AGENTS.md` for the vault/system should enforce at least:

1. Markdown is the durable user-facing format.
2. Never require a database merely to open or edit a note.
3. Preserve user text unless the requested workflow explicitly rewrites it.
4. Prefer wikilinks for internal vault references.
5. Keep tags controlled and low-cardinality.
6. Add provenance fields when content is imported from an external source.
7. Use Git for reviewable bulk changes.
8. For changes touching many files, generate a plan/diff before destructive moves or deletions.
9. Use the evidence core only when immutable citation/provenance semantics are requested or required by the workflow.
10. Never represent an ordinary Obsidian backlink as if it were a verified Evidence citation.

## Migration phases

### M0 — Freeze product-surface expansion

Immediately stop new work on:

- Knowledge browser UI expansion;
- custom note editor/revision UI;
- Course UI;
- generic retrieval expansion;
- new PI WEB/Fleet integration specific to Knowledge.

Allowed work during M0:

- extraction support;
- regression fixes needed to preserve already-developed differentiated assets;
- migration documentation/tests;
- vault workflow prototypes.

**Exit:** no new roadmap item depends on extending the PI WEB Knowledge UI.

### M1 — Build the vault-native baseline

Deliver a real Obsidian Vault template with:

- folder convention;
- frontmatter schemas;
- note/source/research/project templates;
- Inbox workflow;
- RSS workflow;
- linking/MOC workflow;
- weekly review workflow;
- root Codex `AGENTS.md`.

Acceptance must be based on real daily tasks, not feature count.

**Exit:** a user can capture, organize, search, link, review, and refactor normal knowledge without running PI WEB or `pi-knowledge`.

### M2 — Prove Codex workflows

Implement reusable Codex workflows for:

```text
/process-inbox
/process-rss
/link-notes
/build-moc
/research
/weekly-review
```

Each workflow should operate on files and produce inspectable diffs.

**Exit:** the common knowledge-management loop is faster and simpler than the old Product Preview path.

### M3 — Extract evidence core

Extract only the contracts required for immutable/reference-source workflows.

First target vertical slice:

```text
external source bytes
→ SourceVersion
→ ParsedArtifact
→ Stable Evidence
→ bounded Evidence read
→ frozen generation record
→ DeliveredEvidence
→ answer + citation lineage
```

Do not extract PI WEB UI, Machine/Fleet routing, or browser plugin code with it.

**Exit:** the evidence core can run headlessly against a vault workflow and historical citations survive source updates and index rebuilds.

### M4 — Archive the fork

Once M1–M3 acceptance is met:

- stop treating this repository as an actively developed PI WEB fork;
- preserve tags/branches/PR history;
- move active development to the vault/workflow/evidence-core repository shape;
- mark superseded UI/integration code as archived rather than carrying it forward;
- document where historical implementation and evaluation evidence remain available.

**Exit:** no active roadmap task requires maintaining the PI WEB fork.

## First implementation backlog

The first concrete implementation sequence after this inventory is:

1. create the vault template and vault-level `AGENTS.md`;
2. implement `process-inbox` and `process-rss` workflows;
3. implement automatic related-note/wikilink suggestions with diff-first behavior;
4. implement weekly review/MOC generation;
5. run several real workflows without `pi-knowledge` and record gaps;
6. define the smallest evidence-core API from those gaps;
7. extract the existing canonical lineage implementation behind that API;
8. remove the Knowledge product UI from the active roadmap;
9. archive the fork only after extraction acceptance.

## Decision gates

Do **not** preserve a component merely because it has already been implemented. Preserve it only if at least one of these is true:

- it guarantees a property Obsidian + Codex + Git do not provide;
- it materially improves a measured target workflow;
- removing it would break historical evidence/provenance guarantees that remain product requirements.

Conversely, do **not** discard a component merely because Obsidian has superficially similar UI. Stable Evidence, frozen scope, DeliveredEvidence, and stale-worker fencing are semantic guarantees, not UI features.

## Success criteria

The pivot is successful when:

- normal daily knowledge work requires only Obsidian + Codex + Git;
- the repository owns far less UI/platform infrastructure;
- Markdown remains readable and useful without any service;
- provenance-sensitive workflows can opt into the evidence core;
- old citations remain historically resolvable when that mode is enabled;
- custom retrieval remains optional and benchmark-driven;
- the system is easier to inspect, automate, version, and maintain than the PI WEB fork.
