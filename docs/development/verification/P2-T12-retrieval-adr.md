# P2-T12 verification — Retrieval ADR

Status: **BLOCKED ON EVIDENCE**

## Purpose

This guide closes the P2 retrieval decision. It is intentionally not satisfiable with unit fixtures or architectural preference alone.

## 1. Resolve applicable P2 experiment debt

Before editing ADR-029's Decision section, record dated evidence for:

### P2-T04 FTS baseline

- complete development observations;
- Recall@10, MRR, all-required-Evidence coverage;
- category failures/representative misses;
- latency/RSS/index bytes.

### P2-T05 lexical normalization

- all four fixed development profiles;
- least-complex selected profile or explicit baseline/no-improvement decision;
- frozen configuration before holdout.

### P2-T06 Dense

If Dense remains a candidate:

- one/two fixed model profiles with exact revision/dimensions/preprocessing;
- real development quality/resource metrics;
- one frozen winner or explicit Dense-not-useful conclusion.

If Dense is rejected from real evidence, record P2-T08 as not applicable rather than manufacturing a Hybrid run.

### P2-T07 sqlite-vec

Required only if sqlite-vec is considered for the chosen Dense deployment:

- trusted extension version/path;
- load/reload after restart;
- scoped KNN before Top-K;
- concurrency/resource measurements;
- adopt/do-not-adopt decision.

### P2-T08 Hybrid

Required only after Dense is proven useful:

- same development set for FTS, Dense and Hybrid;
- full quality/category/resource comparison;
- frozen RRF configuration;
- material benefit vs simpler option.

### P2-T09 benchmark report

Generate a reproducible development report from complete real observations and record dataset/repo/config/model revisions.

### P2-T10 direct-file Pi baseline

Run the same development user tasks with fixed files supplied directly to Pi, then record deterministic Evidence/citation/no-answer metrics and independent human answer correctness.

### P2-T11 existing products

Run fixed-version AnythingLLM and Open WebUI hands-on with the same corpus/tasks, including source-update/restart historical-citation durability and target operational cost.

## 2. Fill the ADR decision table

Replace `UNRUN` / `HANDS-ON UNRUN` cells in `docs/architecture/ADR-029-v1-retrieval-strategy.md` only with actual measured evidence references.

Do not convert a documentation claim, unit fixture, or synthetic observation into benchmark evidence.

## 3. Apply the decision criteria in order

Evaluate:

1. required Evidence correctness/coverage;
2. code/version/Chinese/mixed/conflict behavior;
3. immutable historical Evidence compatibility;
4. measured product value over direct-file Pi;
5. simplicity/maintainability;
6. latency/RSS/index cost;
7. installation/restart/backup reliability.

When measured quality is materially equivalent, prefer the simpler stack. Simplicity cannot override a material required-Evidence failure.

## 4. Record exactly one V1 decision

The expected final choices are intentionally narrow:

```text
FTS only
```

possibly with the selected deterministic lexical normalization, or:

```text
FTS + Dense + RRF
```

with exact frozen lexical/model/preprocessing/RRF/deployment revisions.

If benchmark evidence forces a materially different architecture, stop and open a new architecture decision rather than silently widening ADR-029.

## 5. Holdout integrity

Verify that configurations were frozen before holdout and that holdout failures did not feed back into the selected configuration during the same experiment cycle.

Record development and holdout reports separately.

## 6. Update dependent architecture records

After the decision:

- change ADR-029 from `BLOCKED ON EVIDENCE` to `Accepted`;
- update the architecture baseline with the exact retrieval revision contract;
- update P2-T04..T12 reports/debt statuses as supported by evidence;
- update DEVELOPMENT-PLAN / CHANGELOG / canonical verification-debt ledger safely;
- define the retrieval-config revision consumed by P3 ScopeManifest.

## 7. Repository/direct-base audit

```bash
git diff --check origin/research/p2-existing-product-comparison...HEAD
git diff --name-status origin/research/p2-existing-product-comparison...HEAD
```

While blocked, expected P2-T12 scope is ADR-029 plus task report/verification and safe bookkeeping only. No P3 schema/runtime implementation belongs here.

## 8. P3 gate

Only after ADR-029 is Accepted and the required P2 evidence is recorded may P3-T01 branch from P2-T12.

## PASS condition

P2-T12 is PASS only when the final retrieval choice is supported by dated reproducible P2 evidence, ADR-029 is Accepted, the P2 gate is closed, and the exact retrieval configuration/revision contract is available for P3 durable provenance.
