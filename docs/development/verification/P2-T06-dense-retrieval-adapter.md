# P2-T06 verification — Dense retrieval adapter spike

Status: **OPEN / PARTIAL**

## 1. Focused contract tests

```bash
npm test -- src/knowledge/eval/denseRetrievalAdapter.test.ts
```

PASS evidence must show:

- at most two profiles are accepted;
- model/version/dimension/preprocessing metadata is mandatory;
- preprocessing is deterministic;
- vector count/dimensions/finite/non-zero constraints fail closed;
- cancellation propagates before provider work;
- SourceVersion filtering occurs before ranking/Top-K;
- an explicit empty scope never falls back globally.

## 2. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Classify inherited failures rather than modifying unrelated PI WEB code merely for green.

## 3. Fix at most two real multilingual profiles

Before running embeddings, record for each candidate:

```text
profile id
model id
exact version/revision
dimensions
preprocessing id
query prefix
document prefix
whitespace normalization
runtime/provider used
```

Maximum candidate count: **2**.

Do not silently change a model revision or preprocessing rule during comparison. Any change creates a new profile identity.

## 4. Build comparable embeddings

Using the same fixed P2 corpus/chunks for each profile:

1. prepare document text through the profile metadata;
2. embed every evaluated chunk;
3. verify output count/dimensions and finite non-zero vectors;
4. retain `sourceVersionId`, `parsedArtifactId`, `startByte`, `endByte` with every vector;
5. record embedding/build duration, peak RSS and total vector bytes.

For query evaluation, use `embedDenseInputs(..., "query", ...)` and the in-memory dense index. Apply optional SourceVersion scope before ranking/Top-K.

## 5. Development-set retrieval evaluation

Use only the fixed development split while comparing profiles.

For each candidate record:

- Recall@10;
- MRR;
- all-required-Evidence coverage;
- failure counts by category;
- median/p95/max query latency;
- peak RSS;
- vector bytes;
- representative missed queries.

Relevance must remain Stable Evidence SourceVersion + ParsedArtifact UTF-8 range overlap. Vector/chunk identity is never ground truth.

## 6. Select/fail explicitly

Freeze one profile only if it materially improves retrieval enough to justify its runtime/resource cost. If neither candidate is useful, record dense retrieval as not proven and do not force P2-T07/P2-T08 adoption.

Only after profile selection may the holdout split be run once. Do not retune from holdout results in this task.

## 7. Direct-base scope

```bash
git diff --check origin/experiment/p2-lexical-normalization...HEAD
git diff --name-status origin/experiment/p2-lexical-normalization...HEAD
```

Expected P2-T06-only scope: dense adapter/index contract, focused tests, UNRUN report, task report/verification and safe bookkeeping. No sqlite-vec implementation, persistent vector schema, RRF/hybrid code or P3 work.

## PASS condition

P2-T06 remains PARTIAL until focused/static/build/package/full-suite gates and at least one real fixed multilingual profile run produce reproducible retrieval/resource evidence. Later tasks may consume the narrow adapter contract under the autonomous execution policy, but must keep dense usability as an explicit unverified assumption until then.
