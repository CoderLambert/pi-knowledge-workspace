# P2-T12 — Retrieval ADR

Status: **BLOCKED**

## Objective

Publish the final V1 retrieval choice from real P2 benchmark/product evidence and prevent P3 from freezing an unevaluated retrieval stack into durable Answer provenance.

## Direct base

P2-T11 / `research/p2-existing-product-comparison` / PR #43.

This task is stacked and is not independently merge-safe before its base.

## Work completed

Created `docs/architecture/ADR-029-v1-retrieval-strategy.md` with:

- the intentionally narrow candidate set (`FTS only` or evidence-backed `FTS + Dense + RRF`);
- explicit separation of Dense quality from sqlite-vec deployment;
- mandatory evidence rows for P2-T04 through P2-T11;
- decision criteria prioritizing Evidence correctness, product value and simplicity;
- an explicit simpler-is-preferred bias only when measured quality is materially equivalent;
- a decision table whose missing values are visibly `UNRUN` / `HANDS-ON UNRUN`;
- an unblocking procedure;
- a hard consequence that P3 must not branch while the retrieval decision is unresolved.

## Why status is BLOCKED rather than PARTIAL

Unlike earlier tasks, the remaining work is not merely implementation that can be safely completed against a mocked contract. The task's deliverable **is the empirical architecture decision itself**.

Current mandatory evidence is missing:

- real P2-T04 FTS baseline metrics;
- P2-T05 lexical profile decision;
- real P2-T06 Dense result if Dense remains a candidate;
- P2-T07 target sqlite-vec deployment evidence if sqlite-vec is considered;
- P2-T08 real FTS/Dense/Hybrid comparison if Dense is useful;
- P2-T09 generated real benchmark report;
- P2-T10 direct-file Pi product baseline;
- P2-T11 fixed-version hands-on product comparison.

These results require native/runtime/model/product execution that cannot be truthfully substituted by fixtures. Choosing a retrieval strategy without them would violate the stated P2 goal.

## Decision state

No FTS/Dense/Hybrid choice is made. This is intentional.

The ADR records the decision gate, not a preference disguised as evidence.

## P3 stop condition

`DEVELOPMENT-PLAN.md` explicitly states that P3 must not proceed without the P2-T12 retrieval decision. Therefore autonomous implementation stops at this task until the missing real evidence is supplied and ADR-029 can be finalized.

This is the autonomous policy's literal blocker case: continuing would freeze an unselected retrieval configuration into P3 AnswerRun/ScopeManifest design and could invalidate durable provenance contracts.

## Verification state

The decision-gate document is implemented and direct-base scope can be audited, but P2-T12 cannot become PASS until ADR-029 contains a dated evidence-backed final decision and the P2 gate is closed.

Exact unblocking procedure is in `docs/development/verification/P2-T12-retrieval-adr.md`.

## Out of scope while blocked

- guessing FTS because it is simpler;
- guessing Hybrid because it is more sophisticated;
- adding a reranker;
- starting P3 schemas/runtime with a placeholder retrieval revision;
- treating public external-product feature descriptions as benchmark results.
