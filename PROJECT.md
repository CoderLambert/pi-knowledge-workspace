# Pi Knowledge System

> Local-first knowledge workflows built on Obsidian + Codex + Git, with an optional evidence/provenance core for workflows that require stronger historical guarantees.

## Product direction

The project no longer aims to become a complete Knowledge Workspace inside a PI WEB fork.

The preferred architecture is:

```text
Obsidian
├─ human knowledge UI
├─ Markdown vault
├─ properties / backlinks / navigation
└─ focused plugins only when needed
        │
        ▼
Codex
├─ knowledge workflows
├─ file refactoring / linking / summarization
├─ scripts / tools / Git
└─ automation rules from AGENTS.md
        │
        ▼
Git
├─ diff
├─ history
├─ rollback
└─ review
        │
        ▼
optional pi-knowledge evidence core
├─ immutable SourceVersion
├─ ParsedArtifact identity
├─ Stable Evidence
├─ frozen GenerationRun scope
├─ DeliveredEvidence
├─ Answer / Citation lineage
└─ durable lifecycle safety
```

See:

- `docs/architecture/ADR-030-obsidian-codex-pivot.md`
- `docs/development/OBSIDIAN-CODEX-MIGRATION.md`

## Product promise

For normal knowledge work:

> Capture information as durable Markdown, let Codex organize and transform it through reviewable file changes, and keep the knowledge base directly usable in Obsidian without requiring a custom service.

For provenance-sensitive work:

> Opt into immutable source/evidence tracking so historical citations and model-delivered evidence remain reproducible across source updates and index rebuilds.

## Default workflow

```text
RSS / web / files / manual notes
→ Vault Inbox
→ Codex normalize / classify / link
→ Obsidian knowledge graph / projects / reviews
→ Git history
```

Optional evidence path:

```text
external immutable source
→ SourceVersion
→ ParsedArtifact
→ Stable Evidence
→ frozen generation
→ DeliveredEvidence
→ answer + citation lineage
```

## What the project owns

### First-party

- Vault conventions and templates;
- Codex operating rules and reusable workflows;
- ingestion/normalization/linking/review automation;
- provenance metadata conventions;
- optional headless evidence-core contracts and implementation;
- focused Obsidian plugins only where file/workflow primitives are insufficient.

### Platform responsibilities

- Obsidian owns the primary human workspace UI;
- Codex owns the general agent/automation runtime;
- Git owns normal text history, diff, rollback, and review.

## What is no longer a product goal

- maintaining a full Knowledge Workspace UI in PI WEB;
- duplicating Obsidian editing, files, backlinks, tags, graph, or note navigation;
- building a custom note editor/revision UI;
- making custom retrieval infrastructure mandatory for normal Vault use;
- adding Course UI before file-based learning workflows prove a concrete UI gap;
- Knowledge-specific Machine/Fleet integration;
- multi-user SaaS, RBAC, or multi-tenant hosting unless deliberately reintroduced later.

## Retained differentiated semantics

The existing Knowledge work remains valuable where it guarantees properties not provided by ordinary Markdown + Git:

1. immutable external source versions;
2. versioned ParsedArtifact interpretation identity;
3. Stable Evidence independent of retrieval chunk identity;
4. historical Evidence reopening;
5. atomic publication and stale-candidate rejection;
6. frozen generation scope;
7. DeliveredEvidence provenance;
8. Answer/Citation lineage and deterministic integrity checks;
9. durable worker fencing, recovery, and archive/purge distinction.

These should be extracted behind a headless boundary rather than carried forward as justification for a custom workspace shell.

## Development status

Current state: **Architecture pivot accepted; migration inventory complete; Vault-native baseline is the next implementation target.**

Execution order:

```text
M0 freeze workspace-surface expansion
→ M1 build Vault template + AGENTS.md
→ M2 prove Codex workflows
→ M3 extract optional evidence core
→ M4 archive PI WEB fork maintenance
```

Do not delete or mechanically rewrite existing Knowledge implementation before M3 extraction acceptance. Preserve repository history and verification evidence while the new boundary is proven.
