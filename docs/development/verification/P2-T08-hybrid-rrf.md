# P2-T08 verification — Hybrid + RRF experiment

Status: **OPEN / PARTIAL**

## 1. Focused fusion contract

```bash
npm test -- src/knowledge/eval/hybridRrf.test.ts
```

PASS evidence:

- matching Stable locators from FTS/Dense accumulate RRF score;
- lexical-only and dense-only results remain eligible;
- SourceVersion scope is applied before fusion/Top-K;
- explicit empty scope returns no result;
- cross-retriever identity uses SourceVersion + ParsedArtifact UTF-8 range, not Chunk id;
- duplicates inside one ranked list fail closed;
- score ties are deterministic.

## 2. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Do not patch inherited failures merely to make the repository green.

## 3. Preconditions for a real comparison

Record before executing P2-T08:

- the frozen P2-T05 lexical profile, or explicit `baseline` decision;
- one frozen, reproducibly evaluated P2-T06 Dense profile with exact model/version/dimensions/preprocessing;
- the RRF `rrfK` value (default experiment value: 60);
- Top-K and SourceVersion scope rules.

If Dense has not produced real usable retrieval evidence, leave Dense/Hybrid metrics `UNRUN`; do not simulate results to close this task.

sqlite-vec adoption is not a prerequisite because P2-T06's in-memory index may supply Dense rankings for quality evaluation.

## 4. Development-set comparison

Run the fixed development queries through:

```text
FTS
Dense
FTS + Dense + RRF
```

using the same Stable Evidence labels and Top-K=10 evaluation semantics.

For every variant publish:

- Recall@10;
- MRR;
- all-required-Evidence coverage;
- category failure counts;
- representative misses;
- median/p95/max latency;
- peak RSS;
- relevant index/vector size where applicable.

For Hybrid, latency must include both retrieval calls plus fusion overhead; do not report only the final in-memory fusion function time.

## 5. Fusion correctness audit

For a sample containing:

- one result returned by both retrievers;
- one lexical-only result;
- one dense-only result;
- an out-of-scope higher-ranked result;

record the input ranks and fused output. Confirm the shared Stable locator receives both reciprocal-rank contributions and the out-of-scope row never enters fusion.

## 6. Decision rule

Prefer the simpler retrieval path unless Hybrid produces a material quality benefit that justifies its added embedding/runtime/resource cost.

Do not add a reranker in response to hybrid misses inside this task.

Freeze the chosen configuration before one-shot holdout confirmation. Do not retune from holdout failures.

## 7. Direct-base scope

```bash
git diff --check origin/experiment/p2-sqlite-vec-deployment...HEAD
git diff --name-status origin/experiment/p2-sqlite-vec-deployment...HEAD
```

Expected P2-T08-only scope: RRF implementation/test, UNRUN comparison report, task report/verification and safe bookkeeping. No production retrieval-default change, reranker or P2-T09 runner belongs here.

## PASS condition

P2-T08 remains PARTIAL until repository gates and a real FTS/Dense/Hybrid development comparison are recorded, a configuration decision is made from development data, and holdout is run only after that decision. If Dense never satisfies P2-T06 acceptance, P2-T08 should explicitly remain not-applicable/failed rather than fabricating a hybrid result.
