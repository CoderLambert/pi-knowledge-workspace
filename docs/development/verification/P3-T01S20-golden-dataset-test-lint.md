# P3-T01S20 Verification — Golden Dataset Test-Harness Lint

Status: **PARTIAL**

## Automated verification

Required repository checks:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/eval/goldenDataset.test.ts
```

Required result for task PASS:

- typecheck remains PASS;
- the focused Golden Dataset schema test passes when reachable;
- `src/knowledge/eval/goldenDataset.test.ts` disappears from authoritative ESLint output;
- repository lint moves from the verified 77-error checkpoint to 68 unless a directly task-owned interaction is exposed and corrected within S20;
- unrelated remaining failures remain classified as inherited baseline.

Frozen P2 regression workflows must also remain PASS:

- P2 FTS Evidence;
- P2 Lexical Evidence.

## Semantic regression checks

The test must continue proving:

1. Stable ParsedArtifact byte-range labels are accepted across development and holdout.
2. A fixture containing persisted Chunk identity is rejected.
3. SourceVersion/ParsedArtifact lineage mismatch is rejected.
4. Answerable queries require at least one required Evidence label.
5. No-answer queries accept zero labels and reject fabricated labels.
6. Unsafe corpus relative paths are rejected.
7. Invalid canonical SHA-256 values are rejected.

## Frozen boundaries

Do not modify or retune:

- `src/knowledge/eval/goldenDataset.ts` in this slice;
- `eval/**` committed corpus/query/label/evidence files;
- ADR-029;
- retrieval profile/compiler/Top-K settings;
- benchmark inputs, metrics or thresholds.

## User verification debt

None expected. This is repository-owned test-harness/static cleanup and should be fully verifiable through GitHub CI and focused automated tests.
