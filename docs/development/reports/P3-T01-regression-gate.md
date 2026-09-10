# P3-T01 — Regression Gate / Exit Audit

Status: **PASS**

Date: 2026-09-10
Base: `686bf747` (`docs: adopt product slice first development policy`)

## Decision

P3-T01 exits the baseline-cleanup critical path. `npm run verify:p3` is now the
blocking Product Slice gate for the P3 Knowledge core path; full-repository lint
remains visible as inherited-debt telemetry and is not part of this blocking
decision.

## Gate contents

`verify:p3` runs these checks in order:

1. `npm run typecheck`;
2. `npm run lint:p3`, covering the twelve P3-critical production files under
   `src/knowledge/storage/`;
3. `npm run test:p3`, covering the focused Source/ParsedArtifact/Evidence,
   FTS5/search, publication/retention and durable worker/import tests;
4. `npm run build`.

The exact file lists are intentionally explicit in `package.json`. Existing
ESLint rules remain enabled; no blanket suppression or rule reduction was
introduced.

## Automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint:p3` | PASS; all 12 critical production files clean |
| `npm run test:p3` | PASS; 12 files, 74 tests |
| `npm run build` | PASS; server, plugins, packages and Vite client built |
| `npm run verify:p3` | PASS; all four checks completed |
| `npm run lint` | Non-zero, 77 inherited findings; diagnostic only |
| `npm run knip` | Non-zero, 2 inherited findings plus 1 configuration hint; diagnostic only |

The build emitted an existing Vite chunk-size advisory. It did not affect the
successful build result.

## Exit audit

- TypeScript is reliable and green.
- P3-critical production lint is green and uses the repository ESLint
  configuration without weakening it.
- The selected Knowledge contract tests are green and attributable to the
  covered core path.
- The gate reaches and completes the build, so the old full-verify lint
  fail-fast behavior no longer hides these checks from the P3 Product Slice.
- The 77 full-repository findings are outside the twelve-file critical lint
  scope and cannot block the P3 gate or obscure a regression in that covered
  path.
- `pi-web-plugins/knowledge/**` was reviewed but remains outside this core
  storage gate; it has existing unrelated lint/test debt. A future slice that
  changes that boundary must own an appropriate plugin-scope gate rather than
  treating this audit as coverage of it.
- No ADR-029, retrieval strategy, frozen P2 evidence or Reliable Knowledge
  implementation changes were made.

Therefore:

```text
P3-T01 = PASS
```

Next Product Slice:

```text
feat/p3-reliable-knowledge
Captured → Parsed → Indexed → Published
```
