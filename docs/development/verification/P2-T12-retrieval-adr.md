# P2-T12 verification — Retrieval ADR

Status: **BLOCKED ON FINAL PRODUCT EVIDENCE**

## Purpose

This guide closes the P2 retrieval decision. It is intentionally not satisfiable with unit fixtures or architectural preference alone.

## 1. Retrieval experiment debt — RESOLVED / CLASSIFIED

### P2-T04 FTS baseline — COMPLETE

Real expanded-corpus evidence exists with:

```text
Recall@10 = 1.0
MRR = 0.928921568627451
all-required Evidence coverage = 1.0
category failures = none
```

### P2-T05 lexical normalization — COMPLETE

All four fixed profiles executed. Plain `baseline` is frozen because no more complex profile materially improved development quality. One-shot holdout occurred only after freeze.

### P2-T06 Dense — COMPLETE / REJECTED

Both fixed multilingual Dense profiles regressed FTS quality. No Dense profile was selected.

### P2-T07 sqlite-vec — NOT APPLICABLE

sqlite-vec is only a Dense deployment mechanism. Dense was rejected, so sqlite-vec target acceptance is not required for the V1 decision.

### P2-T08 Hybrid/RRF — NOT APPLICABLE

Hybrid was conditional on Dense proving useful. Do not manufacture a Hybrid benchmark after the prerequisite failed.

### P2-T09 benchmark report — PASS

Frozen FTS development report generated from real observations:

```text
50 queries / 42 answerable / 8 no-answer
Recall@10 = 1.0
MRR = 0.9365079365079365
all-required Evidence coverage = 1.0
category failures = none
```

### P2-T10 deterministic direct-file Pi run — COMPLETE

Real Omarchy/Pi execution:

```text
50 queries
any-required Evidence coverage = 1.0
all-required Evidence coverage = 1.0
citation precision = 0.7758620689655172 (45/58)
no-answer correct abstention = 0.625 (5/8)
median latency = 10165.077273999981 ms
p95 latency = 14855.569325999997 ms
max latency = 18050.93610000005 ms
Pi 0.85.1 / openai-codex / gpt-6-astra
```

The automated run is complete, but P2-T10 remains PARTIAL until independent human semantic review is recorded.

## 2. Remaining P2-T10 human review — REQUIRED

Complete the generated local worksheet:

```text
/tmp/pi-knowledge-p2-evidence/p2-t10/human-review-development.md
```

For all 50 development answers record:

- correct / partially correct / incorrect;
- unsupported claims;
- version/conflict mistakes;
- important omitted evidence;
- no-answer hallucination/abstention behavior.

The model under test must not be its own sole reviewer.

## 3. Remaining P2-T11 external-product hands-on — REQUIRED

For fixed versions of:

- AnythingLLM;
- Open WebUI Knowledge;

record on the same target machine as applicable:

- exact product/model/embedding/retrieval versions;
- same fixed P2 development corpus/query behavior;
- Chinese/mixed/code/version/conflict/no-answer quality;
- source version A → citation → update to B → restart → reopen old citation;
- multi-version/conflict behavior;
- nearest note/reuse feature and source stability;
- Pi/API/MCP workflow fit;
- install/update/backup friction;
- idle/query RSS, p95 and persistent/index bytes.

Public documentation claims are context, not PASS evidence.

## 4. Current retrieval candidate

Measured retrieval evidence narrows the V1 candidate to:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

Do not reintroduce Dense/sqlite-vec/Hybrid unless new development evidence explicitly reopens that decision.

## 5. Fill the final ADR product-value rows

After P2-T10 human review and P2-T11 hands-on, update `docs/architecture/ADR-029-v1-retrieval-strategy.md` with:

- direct-file semantic correctness/partial/incorrect counts;
- unsupported/version/conflict/no-answer observations;
- external-product historical citation durability;
- same-corpus external-product quality;
- operational/workflow comparison;
- final justification for retaining or rejecting the FTS-only Knowledge product architecture.

## 6. Apply decision criteria

Evaluate:

1. required Evidence correctness/coverage;
2. code/version/Chinese/mixed/conflict behavior;
3. immutable historical Evidence compatibility;
4. product value over direct-file Pi and mature local substitutes;
5. simplicity/maintainability;
6. latency/RSS/index cost;
7. installation/restart/backup reliability.

## 7. Holdout integrity

Confirm the P2-T05 retrieval configuration was frozen before its one-shot holdout and holdout did not feed retuning.

Do not run P2-T10 holdout for tuning.

## 8. Final acceptance procedure

Only after sections 2 and 3 are complete:

1. update ADR-029's final evidence table;
2. record exactly one V1 architecture decision;
3. if evidence still supports FTS only, freeze the exact configuration/revision;
4. change ADR-029 from `BLOCKED ON FINAL PRODUCT EVIDENCE` to `Accepted`;
5. update P2 task/report/debt status safely;
6. define the retrieval-config revision consumed by P3 ScopeManifest/AnswerRun provenance;
7. stop before P3 unless explicitly authorized.

## 9. Repository/direct-base audit

```bash
git diff --check origin/research/p2-existing-product-comparison...HEAD
git diff --name-status origin/research/p2-existing-product-comparison...HEAD
```

Expected P2-T12 scope remains exactly ADR-029 plus task report and verification guide. No P3 schema/runtime implementation belongs here.

## PASS condition

P2-T12 is PASS only when the final product-value evidence is complete, ADR-029 is Accepted with a dated evidence-backed decision, and the exact retrieval configuration/revision contract is available for P3 durable provenance.
