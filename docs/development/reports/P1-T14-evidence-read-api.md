# P1-T14 — Evidence read API

Status: **PARTIAL**

Branch: `feat/p1-evidence-read-api`  
Direct base: `feat/p1-search-api-baseline`  
PR: pending creation

## Scope

Implement bounded read expansion around stable Evidence/ranges with three modes:

```text
exact Evidence
nearby context
containing section
```

All reads remain inside the same immutable ParsedArtifact. This task does not add Source Viewer UI, artifact persistence schema, retrieval ranking, or index publication.

## Implementation

Added `src/knowledge/storage/evidenceRead.ts` with `EvidenceReadApi`.

### Authoritative artifact dependency

P1-T08 currently defines canonical ParsedArtifact bytes/structure but has not yet established a durable canonical-artifact materialization store that P1-T14 can read directly. Per autonomous-execution policy, P1-T14 therefore isolates this unverified/missing invariant behind the narrow `ParsedArtifactReadStore` interface:

```text
read(KnowledgeWorkspace, ParsedArtifact)
→ canonical bytes
→ source version
→ document structure
```

The API rechecks returned Workspace/ParsedArtifact authority and revalidates persisted Evidence quote/hash against those authoritative bytes before returning content.

A later persistence task must provide the real store without changing Evidence addressing semantics.

### Exact mode

Returns exactly `[evidence.startByte,evidence.endByte)` after P1-T10 integrity verification.

### Context mode

Expands around Evidence by a caller-bounded byte budget, snaps only inward to UTF-8 code-point boundaries, caps the actual result with `maxReadBytes`, and never crosses canonical artifact boundaries.

### Section mode

Uses P1-T08 Markdown heading nodes to identify the containing section:

- nearest heading at/before Evidence starts the section;
- next peer/ancestor heading ends it;
- preamble Evidence uses `[0,next heading)`;
- no following heading ends at artifact length.

If a section exceeds `maxReadBytes`, the result is a bounded UTF-8-safe window around the Evidence and reports `truncatedBefore` / `truncatedAfter`; `containerRange` still identifies the complete section boundary.

### Bounds

Defaults:

```text
contextBytes = 512
maxReadBytes = 64 KiB
```

Hard limits:

```text
contextBytes <= 32 KiB
maxReadBytes <= 256 KiB
```

If exact Evidence itself exceeds `maxReadBytes`, the API fails explicitly rather than returning incomplete Evidence.

## Locked invariants

1. Workspace authority must match the Evidence and artifact store result.
2. Reads never switch to latest SourceVersion/ParsedArtifact implicitly.
3. Exact Evidence quote/hash is verified against authoritative canonical bytes before expansion.
4. Actual ranges are UTF-8 byte ranges; JavaScript string indexes are never used as durable locators.
5. Context/section reads remain inside one ParsedArtifact.
6. Expanded output is bounded; oversized sections are explicitly marked truncated.
7. Invalid document structure fails closed instead of guessing section boundaries.
8. Durable artifact-store implementation remains behind a narrow interface until its persistence contract exists.

## Tests

`src/knowledge/storage/evidenceRead.test.ts` covers six scenarios:

- exact Evidence read including Chinese/emoji bytes;
- UTF-8-safe bounded nearby context;
- containing heading section without crossing the next peer section;
- oversized section truncation around Evidence;
- Workspace/artifact authority mismatch and tampered canonical bytes fail closed;
- unsafe bounds and malformed document structure fail closed.

## Deferred verification / dependency risk

P1-T14 consumes still-PARTIAL P1-T08/P1-T09/P1-T10 contracts and the absence of a durable canonical-artifact reader is explicit debt. Later tasks may use the `ParsedArtifactReadStore` contract with mocks/fixtures, but cannot claim real persistence/restart Evidence reads until that store exists and is accepted.

The automation container cannot clone/install the repository because outbound DNS resolution is unavailable. Focused tests, typecheck/lint/knip/build/pack/full suite and real persisted-artifact acceptance remain OPEN verification debt.

## Scope check

Direct-base comparison must contain only P1-T14 Evidence-read implementation/tests and task records. No P1-T15 UI, schema migration, retrieval changes, job worker, IndexBuild publication, model/runtime, or unrelated baseline fix belongs in this PR.
