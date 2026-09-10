# P3-T01S23 Verification — Evidence Durability E2E Harness Lint

Status: **PARTIAL**

## Automated verification

Required repository evidence:

```bash
npm run typecheck
npm run lint
```

Task PASS requires:

- typecheck remains PASS;
- repository lint moves from 53 to 44 unless CI exposes a directly task-owned interaction corrected within S23;
- `src/knowledge/storage/evidenceDurability.e2e.test.ts` disappears from authoritative ESLint output;
- the Evidence durability E2E remains executable when the full suite advances beyond lint;
- unrelated remaining failures remain classified as inherited baseline.

If path-triggered, P2 FTS Evidence and P2 Lexical Evidence must remain PASS.

## Semantic regression checks

Preserve the existing durability assertions:

1. historical Evidence is created against immutable original ParsedArtifact bytes;
2. rechunk/reparse does not rewrite historical Evidence identity;
3. Source update does not redirect the old Evidence;
4. replaced IndexBuild GC does not remove SourceVersion/ParsedArtifact/Evidence history;
5. reopening the SQLite database still resolves the old Evidence;
6. backup includes the original SourceVersion blob and ParsedArtifact bundle;
7. restore verifies the full closure before publication;
8. restored historical Evidence reads the exact original quote;
9. malformed fixture/database JSON rows fail closed rather than being trusted via TypeScript assertions.

## Frozen boundaries

Do not modify:

- production storage/retrieval behavior;
- ADR-029;
- schema/migrations;
- P2 corpus/query/label/evidence files;
- retrieval profile/compiler/Top-K;
- benchmark thresholds;
- P3 Slice A product semantics.

## User verification debt

None expected. S23 is repository-verifiable and does not require browser, Fleet, multi-instance, hardware, system-service or manual semantic acceptance for PASS.
