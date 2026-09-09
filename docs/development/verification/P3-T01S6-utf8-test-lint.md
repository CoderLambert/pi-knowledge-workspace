# P3-T01S6 Verification — UTF-8 Range Test Lint Baseline

Status: **PARTIAL until CI evidence is recorded**

## Automated acceptance

Run:

```bash
npm run typecheck
npm run lint
npm test -- src/knowledge/storage/utf8Range.test.ts
```

Expected:

- TypeScript remains green.
- The six previous `no-confusing-void-expression` findings in `utf8Range.test.ts` disappear.
- Repository ESLint baseline reduces from 233 to 227 if no unrelated head change occurs.
- The focused UTF-8 range tests retain the same pass/fail behavior.

## Scope audit

Compare directly with `docs/p3-t01-s5-status-sync` and confirm the support slice contains only:

```text
src/knowledge/storage/utf8Range.test.ts
docs/development/reports/P3-T01S6-utf8-test-lint.md
docs/development/verification/P3-T01S6-utf8-test-lint.md
```

No user-local verification is required for this test-only cleanup.
