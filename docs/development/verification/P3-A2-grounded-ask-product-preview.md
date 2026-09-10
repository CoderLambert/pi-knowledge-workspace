# P3-A2 — Grounded Ask Product Preview Verification

## What this verifies

This guide owns the first complete Grounded Ask product journey:

```text
host-selected Workspace
→ import Markdown/TXT
→ publish an immutable Knowledge snapshot
→ freeze a GenerationRun scope
→ retrieve with the ADR-029 FTS5 baseline
→ persist DeliveredEvidence and Answer/CitationRef
→ open the exact historical Evidence from the citation
```

It also verifies that updating and republishing a source after an Ask does not change that run's retrieval, answer, or citation target.

This slice does not claim production lifecycle safety, crash recovery for abandoned runs, backup/restore coverage for the new Grounded Ask records, or live-provider acceptance with user credentials. Those belong to the next Lifecycle Safety slice or explicit provider/manual verification.

## Prerequisites

- Node.js `>=22.19.0`.
- Repository dependencies installed.
- Branch `feat/p3-grounded-ask` based on P3-A1 commit `a930ab6d`.

## Automated Slice Gate

Run the P3 gate:

```bash
npm run verify:p3
```

Required result:

- typecheck passes;
- `lint:p3` passes for P3-critical and Slice-owned files;
- `test:p3` passes;
- the production build passes.

Run the integrated Product Preview journey directly:

```bash
npm test -- pi-web-plugins/knowledge/grounded-ask.e2e.test.ts
```

The E2E uses a deterministic provider at the server-owned adapter seam. It otherwise runs the real browser component, paired sessiond backend route, Knowledge client and HTTP dispatch, SQLite migration/storage, Markdown import, complete publication composition, frozen FTS5 retrieval, DeliveredEvidence, durable answer, citation, index retention, and historical artifact viewer.

Expected:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

## Required invariants

The focused P3 tests must demonstrate:

- an invalid or legacy selected ParsedArtifact without readable canonical payload fails before GenerationRun freeze;
- `[A1, B1] → update A → [A2, B1]` retains the unchanged B selection;
- a candidate composed from a stale publication generation is rejected;
- the run never reacquires the latest publication after freeze;
- retrieval remains SQLite FTS5, `unicode61`, `baseline`, quoted-literal-or, Top-K 10;
- DeliveredEvidence persists ordered canonical spans for an invocation/attempt;
- CitationRef cannot point outside the evidence delivered to that generation;
- Workspace authority is host-derived and model/provider identity is server-owned;
- after `A1 → A2`, an A1 citation still opens the immutable A1 ParsedArtifact and exact Evidence.

## Manual/provider verification

The repository-level E2E intentionally does not contact a paid or credentialed model. The production `pi-knowledge` entry composes the same storage/import/publication/viewer stack and, when configured, the server-side Pi model adapter.

For target-provider acceptance, start the service with an approved model already available in the selected Pi agent directory:

```bash
export PI_KNOWLEDGE_TOKEN='local-grounded-ask-token-at-least-16-characters'
export PI_KNOWLEDGE_PROVIDER='<provider>'
export PI_KNOWLEDGE_MODEL='<model-id>'
export PI_KNOWLEDGE_MODEL_REVISION='<deployed-prompt-or-config-revision>'
npm run start:knowledge
```

Start PI WEB/sessiond with the same `PI_KNOWLEDGE_TOKEN`, open Knowledge for a Workspace, and repeat Import → Publish → Ask → Citation. The browser must never submit credentials or choose the durable model identity recorded on the GenerationRun.

Live-provider acceptance remains manual debt unless it is run with approved credentials and recorded; it is not simulated by the deterministic E2E.

## PASS condition

P3-A2 Product Preview is PASS when `npm run verify:p3` and the focused E2E both pass, no Slice-owned lint error is hidden, and the limitations above are reported. Lifecycle Safety remains the next Product Slice and is not implied by this PASS.
