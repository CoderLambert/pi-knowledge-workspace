# P1-T15 — Source / Evidence Viewer

Status: **PARTIAL**

Branch: `feat/p1-source-evidence-viewer`

Direct base: `feat/p1-evidence-read-api`

## Scope implemented

P1-T15 adds a read-only Knowledge viewer contract and PI WEB panel for:

- Workspace-scoped Source listing;
- Source detail and SourceVersion history;
- ParsedArtifact lineage per SourceVersion;
- bounded canonical ParsedArtifact rendering;
- optional Evidence highlighting using canonical UTF-8 byte offsets;
- explicit latest-vs-historical SourceVersion labels.

The critical historical-citation invariant is enforced at the read-model boundary:

> A historical Evidence opens the Evidence's recorded ParsedArtifact / SourceVersion. The viewer never resolves that citation through the Source's latest version.

## Authority and transport

The browser does not receive or author Machine/Workspace authority. It calls only the PI WEB `pairedBackend` operations:

- `knowledge.viewer.sources.list`;
- `knowledge.viewer.source.get`;
- `knowledge.viewer.artifact.open`.

The server plugin injects the host-authoritative Project/Workspace scope before dispatching to local `pi-knowledge`. Browser attempts to submit Workspace path/scope or proxy-shaped fields are rejected before the service is contacted.

Inside `pi-knowledge`, the host Workspace path is resolved through the separate P1-T03 Knowledge Workspace identity contract rather than treating PI WEB `workspace.id` as Knowledge storage identity.

## Historical read model

`SourceEvidenceViewer` requires both:

- a `KnowledgeDatabase` for durable Source/SourceVersion/ParsedArtifact/Evidence lineage;
- the narrow P1-T14 `ParsedArtifactReadStore` for authoritative immutable canonical bytes.

Artifact opening validates:

1. requested ParsedArtifact belongs to the requested Knowledge Workspace through `ParsedArtifact -> SourceVersion -> Source` lineage;
2. the artifact store returns the same Knowledge Workspace, ParsedArtifact id and SourceVersion id;
3. when Evidence is supplied, that Evidence belongs to the same historical ParsedArtifact;
4. P1-T14 revalidates the persisted exact quote/hash against authoritative canonical bytes before context is rendered.

No fallback to latest SourceVersion or current Workspace file contents exists.

## Bounded rendering

Normal artifact previews are bounded and move a byte-budget cut backward to a valid UTF-8 boundary before fatal UTF-8 decoding. Evidence views reuse P1-T14's bounded UTF-8-safe context window so the highlighted range remains exact.

The browser also interprets highlight offsets as UTF-8 bytes rather than JavaScript UTF-16 indices.

## Tests added

Contract coverage includes:

- Source list with explicit latest-version metadata while preserving history;
- SourceVersion / ParsedArtifact lineage;
- a Source updated to a newer version while an old Evidence still opens the old ParsedArtifact and old text;
- cross-Workspace Source/artifact rejection;
- Evidence/artifact mismatch rejection;
- bounded preview cutting through a Chinese UTF-8 code point without replacement characters;
- PI WEB server-plugin scope injection and browser scope/proxy-field rejection;
- standalone dispatch capability advertisement only when a viewer runtime is injected;
- viewer Source/artifact dispatch preserving explicit historical ids.

## Known dependency / why status is PARTIAL

P1-T08 did not yet provide a repository-owned durable production `ParsedArtifactReadStore` materialization/read implementation. P1-T14 intentionally isolated that gap behind a narrow contract; P1-T15 continues to use the same contract.

Therefore `src/knowledge/service/main.ts` does **not** invent a fallback that reparses or rereads the mutable Workspace file. The production viewer runtime is not injected into standalone `pi-knowledge` yet. This is recorded as verification/implementation debt and must be closed by wiring immutable SourceVersion-backed canonical artifact reads.

Browser/Fleet/local-machine acceptance and repository static/build/test suites also remain unverified in the current GitHub-only environment.

## ADR impact

No new ADR is required. P1-T15 applies existing decisions/invariants: host-authoritative PI WEB routing, separate Knowledge Workspace identity, immutable SourceVersion/ParsedArtifact evidence addressing, and UTF-8 byte ranges. It introduces no new durable architecture choice beyond those contracts.

## Out of scope

This task does not add:

- import/job execution changes (P1-T16+);
- search UI or Ask/citation deep-link wiring (later phases);
- vector/hybrid retrieval;
- a browser-to-`pi-knowledge` direct connection;
- a second Machine/Fleet authority layer.
