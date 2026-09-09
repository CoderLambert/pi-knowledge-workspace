# P1-T10 — Stable Evidence entity verification

Status: **OPEN / required for PASS**

Branch: `feat/p1-stable-evidence-entity`  
Direct base: `feat/p1-utf8-stable-range-library`  
PR: #20

## Automated verification

```bash
npm test -- src/knowledge/storage/evidence.test.ts src/knowledge/storage/utf8Range.test.ts src/knowledge/storage/database.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Do not modify the known inherited `src/server/sessions/piSessionService.promptQueue.test.ts` baseline failure inside this task merely to obtain a green full suite. Investigate any new Evidence/schema-attributable failure.

## Stable Evidence contract

Using canonical ParsedArtifact bytes containing ASCII, Chinese, emoji, combining characters and duplicated passages, verify:

1. Evidence uses `[startByte, endByte)` UTF-8 byte offsets.
2. Empty ranges and mid-code-point boundaries fail closed.
3. `exactQuote` equals the exact addressed bytes decoded as fatal UTF-8.
4. `quoteHash` equals lowercase SHA-256 of those exact bytes.
5. Duplicate quote text at two locations remains distinguishable by range even when quote hashes are equal.
6. Supplying forged `exactQuote`/`quoteHash` properties to a runtime object cannot override derived values.
7. `assertEvidenceMatchesArtifact()` succeeds for original bytes and fails after a byte change in the addressed range.
8. Mutating the caller's locator object after creation does not mutate the Evidence locator snapshot.

## Real SQLite schema-v3 verification

This is mandatory before PASS because the automation environment cannot execute the selected native driver.

1. Create a fresh DB and confirm `PRAGMA user_version = 3`.
2. Inspect `PRAGMA table_info(evidence)` and confirm at least:
   - `id`
   - `knowledge_workspace_id`
   - `parsed_artifact_id`
   - `start_byte`
   - `end_byte`
   - `exact_quote`
   - `quote_hash`
   - `locator_snapshot`
   - `created_at`
3. Confirm `end_byte > start_byte` is enforced.
4. Confirm malformed/non-lowercase/non-64-hex `quote_hash` values are rejected.
5. Confirm invalid JSON `locator_snapshot` is rejected.
6. Starting from schema v2 with an empty provisional `evidence` table, upgrade and confirm schema v3 commits successfully.
7. Starting from schema v2 with at least one provisional legacy Evidence row, attempt upgrade and confirm migration 3 fails and rolls back to schema version 2 with the legacy row/table intact. This is the required no-silent-data-loss evidence.
8. Confirm foreign keys from Evidence to Knowledge Workspace and ParsedArtifact are enforced.

## Direct-base scope check

```bash
git diff --check origin/feat/p1-utf8-stable-range-library...HEAD
git diff --name-status origin/feat/p1-utf8-stable-range-library...HEAD
git diff --stat origin/feat/p1-utf8-stable-range-library...HEAD
```

Expected scope is limited to Evidence entity/tests, schema-v3 migration/database-version changes, migration tests, task report/verification and required bookkeeping. P1-T11 chunking and all later indexing/search/UI/runtime work must be absent.

## PASS evidence

P1-T10 becomes PASS only when focused/static/build/package checks pass, the full suite has no new task-attributable failure, real SQLite schema-v3 positive/negative migration cases pass, P1-T08/P1-T09 integration proves exact canonical-byte Evidence roundtrip, and the result is recorded in the report, plan, changelog, debt ledger and PR description.
