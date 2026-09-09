# P3-T01S3 — Core Storage Test Lint Baseline

Status: **PARTIAL**

Date: 2026-09-10

## Objective

Continue P3-T01 inherited lint closure with a test-only slice over the chunker and Stable Evidence contract tests.

## Changes

### `chunker.test.ts`

- replace two forbidden non-null assertions with explicit fail-fast narrowing after the existing length assertions;
- preserve all chunking expectations and fixture data.

### `evidence.test.ts`

- wrap two assertion callbacks in block bodies to avoid returning void expressions from shorthand callbacks;
- replace one type assertion used only to mutate nested test fixture state with a separately named mutable object;
- preserve Evidence identity, fail-closed and snapshot-immutability expectations.

## Scope exclusions

No production code, schema, ADR, retrieval configuration, P2 evidence, benchmark data or runtime behavior changes.

## Acceptance

- typecheck remains green;
- the five targeted lint findings disappear;
- focused chunker/Evidence tests remain behaviorally unchanged;
- remaining inherited lint debt is left for later bounded support slices.

Until CI evidence is observed, this slice remains **PARTIAL**.
