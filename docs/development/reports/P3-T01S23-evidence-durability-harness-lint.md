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

Initial GitHub CI run `34468104382` on head `6d36b4238c04c22272eeeaa3c05775c3250ae0b0` established:

```text
npm run typecheck → PASS
ESLint 53 → 45
```

Eight of the nine task-owned findings closed. One S23-owned `@typescript-eslint/dot-notation` finding remained in the new backup-capability predicate at `evidenceDurability.e2e.test.ts:562` (`db["backup"]`). This is task-owned implementation debt, not inherited baseline. It was corrected on follow-up commit `337b7ded98af1d3979af6561622ea6c72ae3a54d` by using dot notation after the explicit `"backup" in db` capability guard.

The same initial head passed both frozen regression workflows:

```text
P2 FTS Evidence     34468104461 → PASS
P2 Lexical Evidence 34468104433 → PASS
```

Status remains **PARTIAL** until follow-up GitHub CI proves:

```text
npm run typecheck → PASS
ESLint 53 → 44
```

The task-owned test file must disappear from authoritative lint output. Any remaining 44 findings are expected to be inherited outside this slice; they must not be pulled into S23 merely to make global CI green.

## Git discipline

Base: `docs/p3-t01-53-checkpoint` (#99)

Head: `chore/p3-t01-evidence-durability-harness-lint`

One task / one branch / Draft PR. No merge, rebase, force-push, benchmark retuning, P2 evidence mutation or unrelated cleanup.
