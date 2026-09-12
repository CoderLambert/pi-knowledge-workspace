# ADR-030 — Pivot the Knowledge Workspace to Obsidian + Codex

- Status: Accepted
- Date: 2026-09-12
- Supersedes product-level direction in ADR-027; does not invalidate the Knowledge lineage/reliability contracts established by later Knowledge work.

## Context

The repository began as a thin PI WEB fork so it could provide a first-party local Knowledge/Learning workspace. That direction required us to own or integrate a large product surface: workspace UI, source import, note editing, knowledge navigation, search/retrieval UX, agent sessions, plugin composition, persistence, backup/recovery, and eventually learning workflows.

For the target user, Obsidian and Codex now cover most of that product surface with materially less custom infrastructure:

- Obsidian provides the local Markdown vault, editing UI, files, properties, backlinks, graph/navigation, search, templates, plugin ecosystem, and a durable human-facing knowledge workspace.
- Codex provides the agent layer for reading and editing vault files, running scripts and tools, using Git, generating and maintaining structured Markdown, and automating knowledge workflows.
- Git provides diff, history, rollback, branching, review, and a second durable history channel for vault content and automation code.

Continuing to build a complete Knowledge Workspace on top of PI WEB would therefore duplicate mature platform capabilities. The differentiation that remains is not the workspace shell. It is the reliability semantics developed in `pi-knowledge`: immutable source lineage, stable historical Evidence, frozen generation scope, delivered-evidence provenance, deterministic citation integrity, and lifecycle fencing.

## Decision

Stop treating this repository as a product fork whose goal is to become an end-to-end Knowledge Workspace.

Adopt the following product architecture:

```text
Obsidian Vault                 Codex
──────────────                 ─────
Human knowledge UI             Agent / automation runtime
Markdown + properties          Read / edit / refactor vault
Backlinks + navigation         Search / classify / link / summarize
Templates + plugins            Shell / Git / external tools
        │                         │
        └────────────┬────────────┘
                     ▼
                  Git repo
                     │
                     ▼
          optional pi-knowledge core
          ──────────────────────────
          immutable external sources
          SourceVersion lineage
          ParsedArtifact identity
          Stable Evidence
          frozen GenerationRun scope
          DeliveredEvidence
          Answer/Citation provenance
          lifecycle / fencing safety
```

The Obsidian vault becomes the primary system of record for user-authored notes and knowledge organization. Codex becomes the primary automation and agent layer. Git becomes the default history, diff, review, and rollback mechanism.

`pi-knowledge` is no longer the mandatory backing store for the entire workspace. Its remaining justified role is an optional headless evidence/provenance engine for cases where ordinary Markdown + Git cannot provide the required historical citation and generation guarantees.

## Capability disposition

| Existing capability | Decision | Replacement / retained role |
| --- | --- | --- |
| PI WEB browser shell, workspace navigation, file UI | Retire from Knowledge product | Obsidian |
| PI WEB Knowledge panel / Product Preview | Retire | Obsidian notes, views, commands, or a focused Obsidian plugin only if needed |
| Note editor and saved-note UX | Retire | Native Markdown notes + Git |
| Tags/properties/backlinks/navigation | Retire | Obsidian |
| Course/learning UI | Do not build as a custom workspace | Codex workflows + Markdown templates; add focused plugin UI only after proven need |
| Markdown/TXT import for ordinary notes | Replace | Copy/capture into Vault, frontmatter, Git |
| Workspace source picker | Replace | Obsidian file selection / Codex file operations |
| Generic lexical retrieval for Vault content | Replace by default | Obsidian search + Codex file/search tools; benchmark before reintroducing a custom index |
| Dense/Hybrid/vector retrieval | Do not add by default | Evidence-gated optional adapter only |
| Restricted Knowledge Ask UI/runtime | Defer | Codex for normal workflows; retain restricted runtime only where an actual isolation requirement exists |
| PI WEB Machine/Fleet integration for Knowledge | Retire from Knowledge scope | Use the user's chosen Codex/runtime deployment independently of the Vault |
| Source / immutable SourceVersion | Retain as optional core | External/reference-source provenance |
| ParsedArtifact immutable interpretation identity | Retain as optional core | Reproducible evidence derivation |
| Stable Evidence + historical reopening | Retain | Key differentiated capability |
| Frozen GenerationRun / ScopeManifest | Retain where grounded generation requires it | Key differentiated capability |
| DeliveredEvidence provenance | Retain where grounded generation requires it | Key differentiated capability |
| Answer/Citation lineage and deterministic citation integrity | Retain where required | Key differentiated capability |
| Durable jobs, leases, fencing, recovery | Retain only behind the optional evidence engine | Reliability infrastructure, not workspace infrastructure |
| Knowledge DB backup/restore | Retain only with optional evidence engine | Vault itself uses filesystem/Git backup strategy |

## Product boundary

The new project does **not** compete with Obsidian as an editor, file manager, knowledge navigator, graph, note database, or plugin host.

The new project should own only capabilities that remain differentiated after the platform substitution:

1. vault conventions and schemas;
2. Codex operating rules and reusable workflows;
3. scripts/integrations that transform external information into vault-native Markdown;
4. optional evidence/provenance services for immutable external knowledge;
5. narrow Obsidian plugins only when a workflow cannot be expressed cleanly through files, commands, or existing plugins.

## Consequences

### Positive

- Removes the largest source of duplicated product/UI infrastructure.
- Eliminates most PI WEB fork maintenance and upstream-sync burden from the Knowledge product.
- Makes Markdown files the durable interoperability boundary.
- Lets Codex operate directly on the same artifacts users inspect and edit.
- Preserves the strongest custom work instead of discarding it with the workspace shell.
- Makes retrieval infrastructure optional and evidence-driven rather than foundational.

### Negative / trade-offs

- Obsidian becomes a platform dependency for the preferred human UI.
- Codex is a powerful general agent, not automatically a four-tool restricted security boundary.
- Git history does not replace immutable Evidence lineage for every provenance requirement.
- Browser-first multi-user SaaS, RBAC, and fleet-wide collaboration are no longer product goals unless explicitly reintroduced later.

## Migration rule

Do not perform a destructive rewrite or delete the existing Knowledge implementation immediately.

First classify every existing subsystem as one of:

- **Retire** — duplicated by Obsidian/Codex/Git and no longer product-owned;
- **Adapt** — keep the capability but expose it through vault/Codex-friendly boundaries;
- **Extract** — preserve differentiated code as a headless package/service;
- **Archive** — keep only for historical/reference value.

The migration inventory and execution order are defined in `docs/development/OBSIDIAN-CODEX-MIGRATION.md`.

## Non-goals

This ADR does not:

- claim that Obsidian/Codex provide the same security isolation as Restricted Ask;
- claim that Git alone replaces Stable Evidence or DeliveredEvidence;
- delete any existing implementation;
- merge historical stacked branches automatically;
- require a custom Obsidian plugin before a concrete workflow proves that one is necessary.
