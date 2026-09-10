# P3-T01S23 — Evidence Durability E2E Harness Lint

Status: **PARTIAL**

## Purpose

Continue P3-T01 inherited baseline closure from the verified 53-error checkpoint with the existing Evidence durability E2E harness.

## Scope

Test file:

- `src/knowledge/storage/evidenceDurability.e2e.test.ts`

Support documentation:

- this report;
- `docs/development/verification/P3-T01S23-evidence-durability-harness-lint.md`.

The 53-checkpoint CI reports 9 inherited findings in this harness.

Expected repository lint endpoint if all task-owned findings close cleanly:

```text
53 → 44
```

## Changes

- narrow the runtime database instance to `BackupCapableDatabase` with an explicit capability predicate instead of a type assertion;
- stringify the numeric experimental chunk target in the fixture IndexBuild id;
- narrow SQLite Evidence rows before reading fields;
- parse `locator_snapshot` through an explicit object guard;
- parse fixture ParsedArtifact bundles through a structural validator, including DocumentNode ranges/kinds;
- narrow restored Evidence rows rather than asserting an array row type;
- return an explicit resolved Promise from the synchronous restore verifier fixture instead of declaring an `async` method with no `await`.

## Contract preservation

The existing E2E scenario remains unchanged:

```text
import
→ SourceVersion
→ ParsedArtifact
→ FTS retrieval
→ Stable Evidence
→ rechunk
→ reparse
→ Source update
→ index GC
→ process restart
→ backup
→ restore
→ historical Evidence reopens exact original bytes
```

The new guards strengthen fixture/database boundary validation and do not change production Source/Evidence/index/backup/restore behavior.

No production source, schema, migration, ADR-029, P2 corpus/query/label/evidence, retrieval profile/compiler/Top-K, benchmark threshold or product feature is modified.

## Verification state

Status remains **PARTIAL** until GitHub CI establishes:

```text
npm run typecheck → PASS
ESLint 53 → 44
```

The task-owned test file must disappear from authoritative lint output. Because the harness exercises storage/retrieval durability, any path-triggered P2 FTS/Lexical workflows must remain PASS.

## Git discipline

Base: `docs/p3-t01-53-checkpoint` (#99)

Head: `chore/p3-t01-evidence-durability-harness-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, benchmark retuning, P2 evidence mutation or unrelated cleanup.
