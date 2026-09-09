# P1-T10 — Stable Evidence entity

Status: **PARTIAL**

Branch: `feat/p1-stable-evidence-entity`  
Direct base: `feat/p1-utf8-stable-range-library`  
PR: #20

## Scope

Introduce server-authoritative Stable Evidence over P1-T08 canonical ParsedArtifact bytes and P1-T09 UTF-8 byte ranges.

Evidence stores at minimum:

- Knowledge Workspace scope;
- `parsed_artifact_id`;
- half-open `start_byte` / `end_byte`;
- `exact_quote`;
- `quote_hash`;
- `locator_snapshot`;
- creation identity/time.

Callers may provide the artifact address and locator metadata, but cannot provide authoritative quote text or quote hashes. Those are always derived from canonical artifact bytes.

## Implementation

Added `src/knowledge/storage/evidence.ts`:

- `StableEvidence` value shape;
- `createStableEvidence()` deriving exact quote and SHA-256 from authoritative `canonicalBytes` via P1-T09;
- explicit Knowledge Workspace and ParsedArtifact identity;
- non-empty byte ranges only;
- JSON snapshot cloning for locator metadata so caller mutation cannot rewrite Evidence metadata after creation;
- `assertEvidenceMatchesArtifact()` for deterministic revalidation against authoritative bytes.

The creator does not accept authoritative quote/hash fields. Extra runtime properties cannot override the derived values.

## Schema correction

The P1-T02 bootstrap contained an earlier provisional `evidence` schema tied to `chunk_id`, `source_version_id`, and generic offsets. That no longer matches the locked P1-T10 Evidence contract and would incorrectly require P1-T11 chunking before Evidence can exist.

Schema v3 therefore replaces the provisional table with the stable byte-addressed form and advances `KNOWLEDGE_SCHEMA_VERSION` to 3.

Migration safety is fail-closed: schema-v2 databases with any legacy Evidence rows cannot be losslessly upgraded because those rows lack authoritative `exact_quote`, `quote_hash`, `locator_snapshot`, and direct ParsedArtifact semantics. The migration first inserts `COUNT(*)` into a zero-only guard table; any non-empty legacy Evidence table aborts and rolls back migration 3 rather than silently dropping or fabricating evidence. Empty provisional tables are safely replaced.

## Locked invariants

1. Evidence is addressed against one ParsedArtifact by canonical UTF-8 byte range.
2. Evidence ranges are non-empty and half-open.
3. `exact_quote` and `quote_hash` are derived server-side from authoritative bytes.
4. `quote_hash` is lowercase SHA-256 of the exact addressed bytes.
5. Duplicate quote text is valid and is disambiguated by `(parsed_artifact_id, start_byte, end_byte)`.
6. Locator snapshot is supplementary metadata; it cannot replace exact byte addressing.
7. Revalidation fails closed when authoritative artifact bytes no longer match persisted quote/hash.
8. Legacy provisional Evidence rows are never silently discarded or guessed during migration.

## Tests

`src/knowledge/storage/evidence.test.ts` covers:

- server-derived exact quote/hash over Chinese + emoji content;
- duplicate quote disambiguation by range;
- forged caller quote/hash properties being ignored;
- changed authoritative bytes failing revalidation;
- empty/mid-code-point/out-of-bounds ranges failing closed;
- locator metadata snapshot isolation.

`src/knowledge/storage/database.test.ts` is updated for schema v3 and verifies migration ordering, expected stable Evidence columns, v1→v3 progression, idempotency, future-schema fail-closed behavior, and rollback preservation for migration 3.

## Deferred verification / dependency risk

P1-T10 depends on still-PARTIAL P1-T08 canonicalization, P1-T09 range semantics, and P1-T02 native SQLite execution. The implementation isolates these dependencies behind canonical `Uint8Array` bytes, P1-T09 helpers, and the migration contract.

No executable CI/status evidence is currently available to automation, and target native SQLite migration behavior cannot be exercised here. P1-T10 therefore remains **PARTIAL**. In particular, the schema-v2 empty-table migration and non-empty legacy-row rollback must be verified against real SQLite before PASS.

P1-T11 may proceed using Stable Evidence's byte-addressing contract but must not treat P1-T08/P1-T09/P1-T10 as accepted until their debts are resolved.

## Scope check

Direct-base comparison must remain limited to P1-T10 Evidence entity/tests, schema-v3 correction, migration tests and task records. No chunker implementation, FTS5/index/search, source viewer, Ask runtime, or unrelated inherited baseline fixes belong in this PR.
