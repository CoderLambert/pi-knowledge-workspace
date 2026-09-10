# P3-T01S6 — Verified baseline status sync

Status: **PASS**

Date: 2026-09-10

## Verified CI state

GitHub CI run `34417678413` on P3-T01S6 proves:

```text
npm run typecheck → PASS
ESLint 233 → 227
```

All six targeted `utf8Range.test.ts` findings disappeared. P2 FTS and lexical evidence workflows on the same head completed successfully; no P2 evidence/configuration was changed or retuned.

## Planning impact

The authoritative P3-T01 status is therefore:

```text
TypeScript: 12 → 0
ESLint: 261 → 254 → 252 → 247 → 242 → 233 → 227
```

P3-T01 remains **PARTIAL** because inherited lint debt remains. ADR-029, PHASES.md and VERIFICATION-DEBT.md require no semantic change. Continue only with bounded subsystem-scoped cleanup before P3-A01.

## Scope

Docs-only status record. No production code, ADR, schema, retrieval configuration, P2 evidence, benchmark or user-verification change.