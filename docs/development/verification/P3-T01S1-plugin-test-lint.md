# P3-T01S1 — Knowledge Plugin Test Lint Verification

Status: **PARTIAL until CI evidence is recorded**

## Scope check

Compare against the parent branch:

```bash
git diff --check origin/chore/p3-baseline-closure...HEAD
git diff --name-only origin/chore/p3-baseline-closure...HEAD
```

Expected implementation scope is limited to four Knowledge plugin test files plus this task's report/verification docs.

## Static checks

```bash
npm run typecheck
npm run lint
```

Expected:

- TypeScript remains green after P3-T01;
- the addressed plugin-test lint findings are gone;
- remaining lint failures, if any, are outside this bounded tranche or are separately investigated before classification.

## Focused tests

When executable CI reaches tests, run/observe the current repository equivalents of:

```bash
npm test -- --run \
  pi-web-plugins/knowledge/server-plugin.test.ts \
  pi-web-plugins/knowledge/server-plugin.viewer.test.ts \
  pi-web-plugins/knowledge/service-client.test.ts \
  pi-web-plugins/knowledge/local-integration.e2e.test.ts
```

Expected behavior is unchanged.

## User verification

None required.
