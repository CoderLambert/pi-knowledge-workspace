# P2-T09 verification — Retrieval benchmark runner

Status: **OPEN / PARTIAL**

## 1. Focused runner tests

```bash
npm test -- src/knowledge/eval/retrievalBenchmarkRunner.test.ts
```

PASS evidence:

- one explicit split is evaluated at a time;
- multiple named variants produce comparable metrics;
- variant configuration is deterministic/canonical;
- cross-split observations fail closed;
- duplicate variant ids and invalid run timestamps fail closed;
- Markdown output includes aggregate metrics, category failures, configuration and diagnostics.

## 2. Repository gates

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
```

Inherited failures must be classified rather than repaired inside this unrelated report-runner task.

## 3. Produce a real development report

Collect complete observations from the frozen development configurations selected by the applicable earlier P2 experiments. At minimum include the currently retained lexical variant. Include Dense/Hybrid only if those experiments have real reproducible observations.

For every variant record:

```text
variant id
complete configuration map
one observation per development query
peak RSS bytes
index/vector resource bytes
```

Run:

```text
runRetrievalBenchmark(dataset, "development", generatedAt, variants)
renderRetrievalBenchmarkMarkdown(report)
```

Replace `eval/reports/retrieval-benchmark.md` with the generated output without hand-editing numeric metrics.

PASS requires complete observations; the runner must reject missing/extra/cross-split observations rather than infer them.

## 4. Holdout report discipline

Generate a holdout report only after applicable retrieval configurations are frozen from development results. Use `split = "holdout"` explicitly and a separate generated timestamp/output artifact.

Do not merge development and holdout observations into one run. Do not retune configurations from holdout failures without opening a new documented experiment.

## 5. Reproducibility record

Alongside a generated report record:

- repository commit / branch;
- Golden Dataset revision/hash;
- selected split;
- generated timestamp;
- variant configuration maps;
- retrieval implementation/model revisions used to create observations.

Rerunning with identical observations/configuration must produce identical metrics and Markdown except for an intentionally changed generated timestamp.

## 6. Direct-base scope

```bash
git diff --check origin/experiment/p2-hybrid-rrf...HEAD
git diff --name-status origin/experiment/p2-hybrid-rrf...HEAD
```

Expected P2-T09-only scope: generic observation-driven report runner/test, UNRUN report template, task report/verification and safe bookkeeping. No retriever implementation, tuning, provider/model code, product comparison or P3 work belongs here.

## PASS condition

P2-T09 remains PARTIAL until focused/static/build/package/full-suite gates pass or are correctly classified and at least one real complete development-set benchmark report is generated reproducibly from recorded observations. Holdout generation remains subject to the frozen-configuration rule.
