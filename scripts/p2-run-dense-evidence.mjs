#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  embedDenseInputs,
  InMemoryDenseEvaluationIndex,
  prepareDenseInput,
  validateDenseExperimentProfiles,
} from "../src/knowledge/eval/denseRetrievalAdapter.ts";
import { evaluateFtsBaseline } from "../src/knowledge/eval/ftsBaselineEvaluation.ts";
import { validateGoldenDataset } from "../src/knowledge/eval/goldenDataset.ts";
import { chunkParsedArtifact } from "../src/knowledge/storage/chunker.ts";
import { canonicalizeParsedArtifact } from "../src/knowledge/storage/parsedArtifact.ts";

const ORIGINAL_RECORDS = [
  "vue-reactivity-core-zh",
  "node-fspromises-cp-v16.7.0",
  "node-fspromises-cp-v22.3.0",
];
const CHALLENGE_RECORDS = [
  "challenge-vue-reactivity-neighbors",
  "challenge-node-fspromises-neighbors-a",
  "challenge-node-fspromises-neighbors-b",
];
const CORPUS_RECORDS = [...ORIGINAL_RECORDS, ...CHALLENGE_RECORDS];
const TOP_K = 10;
const EPSILON = 1e-12;
const repoRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(
  process.env.P2_DENSE_EVIDENCE_OUT_DIR ?? "/tmp/pi-knowledge-p2-evidence/p2-t06",
);

const FTS_DEVELOPMENT_BASELINE = Object.freeze({
  source: "P2-T05 accepted expanded FTS baseline / GitHub Actions run 34325709633",
  recallAt10: 1,
  mrr: 0.9365079365079365,
  allRequiredEvidenceCoverage: 1,
  rankDistribution: Object.freeze({
    answerableQueries: 42,
    rank1: 37,
    rank2: 4,
    rank3: 1,
    rank4To10: 0,
    miss: 0,
  }),
});

const DENSE_PROFILES = Object.freeze([
  Object.freeze({
    id: "multilingual-e5-small-fd1525a",
    model: "intfloat/multilingual-e5-small",
    version: "fd1525a9fd15316a2d503bf26ab031a61d056e98",
    dimensions: 384,
    preprocessing: Object.freeze({
      id: "e5-retrieval-prefix-collapse-v1",
      queryPrefix: "query: ",
      documentPrefix: "passage: ",
      collapseWhitespace: true,
    }),
  }),
  Object.freeze({
    id: "paraphrase-multilingual-minilm-l12-v2-e8f8c21",
    model: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    version: "e8f8c211226b894fcb81acc59f3b34ba3efd5f42",
    dimensions: 384,
    preprocessing: Object.freeze({
      id: "identity-collapse-v1",
      queryPrefix: "",
      documentPrefix: "",
      collapseWhitespace: true,
    }),
  }),
]);

await mkdir(outDir, { recursive: true });
validateDenseExperimentProfiles(DENSE_PROFILES);
await orchestrate();

async function orchestrate() {
  const repoSha = git(["rev-parse", "HEAD"]);
  const development = await prepareSplit("development");
  const developmentResults = [];

  for (const profile of DENSE_PROFILES) {
    const result = await runProfile(profile, development, true);
    developmentResults.push(result);
    await writeFile(
      path.join(outDir, `development-${profile.id}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );
    console.log(`===== ${profile.id} / development =====`);
    console.log(JSON.stringify(compactDevelopment(result), null, 2));
  }

  const selection = selectDenseWinner(developmentResults);
  await writeFile(path.join(outDir, "selection.json"), `${JSON.stringify(selection, null, 2)}\n`, "utf8");
  console.log("===== P2-T06 DENSE PROFILE FREEZE =====");
  console.log(JSON.stringify(selection, null, 2));

  let holdoutAcceptance = null;
  if (selection.selectedProfileId !== null) {
    const selected = DENSE_PROFILES.find((profile) => profile.id === selection.selectedProfileId);
    if (selected === undefined) throw new Error("selected dense profile metadata missing");
    const holdout = await prepareSplit("holdout");
    const holdoutResult = await runProfile(selected, holdout, false);
    holdoutAcceptance = aggregateOnly(holdoutResult);
    console.log("===== SELECTED DENSE PROFILE / HOLDOUT AGGREGATE =====");
    console.log(JSON.stringify(holdoutAcceptance, null, 2));
  } else {
    console.log("===== HOLDOUT SKIPPED =====");
    console.log("No dense profile cleared the frozen development materiality gate.");
  }

  const evidence = {
    schemaVersion: 1,
    benchmark: "p2-t06-dense-retrieval",
    generatedAt: new Date().toISOString(),
    repoSha,
    protocol: {
      profileOrder: DENSE_PROFILES.map((profile) => profile.id),
      profiles: DENSE_PROFILES,
      runtime: "python-3.12 + sentence-transformers==5.7.0 + CPU",
      topK: TOP_K,
      tuningSplit: "development",
      holdoutPolicy: "encode and evaluate holdout only after a development winner is frozen; otherwise skip holdout",
      selectionRule: selection.rule,
    },
    ftsDevelopmentBaseline: FTS_DEVELOPMENT_BASELINE,
    development: developmentResults.map(compactDevelopment),
    selection,
    holdoutAcceptance,
  };

  await writeFile(path.join(outDir, "dense-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "dense-evidence.md"), renderMarkdown(evidence), "utf8");

  console.log("===== P2-T06 DENSE EVIDENCE =====");
  console.log(JSON.stringify({
    repoSha,
    development: evidence.development,
    selection,
    holdoutAcceptance,
    outDir,
  }, null, 2));
}

async function prepareSplit(split) {
  if (split !== "development" && split !== "holdout") throw new Error(`unsupported split: ${split}`);
  const queries = await readJsonLines(path.join(repoRoot, "eval", "queries", `${split}.jsonl`));
  const labels = await readJsonLines(path.join(repoRoot, "eval", "labels", `${split}.jsonl`));
  const corpus = [];
  const chunks = [];
  let originalChunks = 0;
  let challengeChunks = 0;

  for (const recordName of CORPUS_RECORDS) {
    const metaPath = path.join(repoRoot, "eval", "corpus", `${recordName}.meta.json`);
    const record = JSON.parse(await readFile(metaPath, "utf8"));
    corpus.push(record);
    const bytes = await readFile(path.join(repoRoot, "eval", record.relativePath));
    const sourceKind = record.mediaType === "text/markdown" ? "md" : "txt";
    const canonical = canonicalizeParsedArtifact(record.parsedArtifact.sourceVersionId, bytes, sourceKind);
    assertCanonicalIdentity(record, canonical);
    const artifactChunks = chunkParsedArtifact(canonical);
    const challenge = CHALLENGE_RECORDS.includes(recordName);
    if (challenge) challengeChunks += artifactChunks.length;
    else originalChunks += artifactChunks.length;

    for (const chunk of artifactChunks) {
      chunks.push({
        chunkId: `${record.parsedArtifact.parsedArtifactId}:${String(chunk.ordinal)}`,
        sourceVersionId: record.parsedArtifact.sourceVersionId,
        parsedArtifactId: record.parsedArtifact.parsedArtifactId,
        startByte: chunk.startByte,
        endByte: chunk.endByte,
        text: chunk.text,
      });
    }
  }

  const dataset = { schemaVersion: 1, corpus, queries, labels };
  validateGoldenDataset(dataset);
  if (chunks.length !== 38 || originalChunks !== 3 || challengeChunks !== 35) {
    throw new Error(
      `unexpected corpus pressure: total=${String(chunks.length)} original=${String(originalChunks)} challenge=${String(challengeChunks)}`,
    );
  }

  return { split, dataset, queries, labels, chunks, originalChunks, challengeChunks };
}

async function runProfile(profile, splitData, includeDevelopmentDiagnostics) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), `p2-t06-${profile.id}-${splitData.split}-`));
  try {
    const inferenceInputPath = path.join(tempRoot, "input.json");
    const inferenceOutputPath = path.join(tempRoot, "output.json");
    const preparedDocuments = splitData.chunks.map((chunk) => prepareDenseInput(chunk.text, profile, "document"));
    const preparedQueries = splitData.queries.map((query) => prepareDenseInput(query.text, profile, "query"));
    await writeFile(inferenceInputPath, `${JSON.stringify({
      profile: {
        id: profile.id,
        model: profile.model,
        revision: profile.version,
        dimensions: profile.dimensions,
      },
      documents: preparedDocuments,
      queries: preparedQueries,
    })}\n`, "utf8");

    runPython(inferenceInputPath, inferenceOutputPath);
    const inference = JSON.parse(await readFile(inferenceOutputPath, "utf8"));
    validateInference(profile, splitData, preparedDocuments, preparedQueries, inference);

    const documentVectors = inference.documentVectors.map((vector) => Float32Array.from(vector));
    const queryVectors = inference.queryVectors.map((item) => Float32Array.from(item.vector));
    let documentCallCount = 0;
    let queryCallIndex = 0;
    const adapter = {
      profile,
      embed(inputs, kind) {
        if (kind === "document") {
          documentCallCount += 1;
          if (documentCallCount !== 1) throw new Error("document embeddings requested more than once");
          assertPreparedInputs(inputs, preparedDocuments, "document");
          return Promise.resolve(documentVectors);
        }
        const expected = preparedQueries[queryCallIndex];
        if (inputs.length !== 1 || inputs[0] !== expected) {
          throw new Error(`query preprocessing mismatch at index ${String(queryCallIndex)}`);
        }
        const vector = queryVectors[queryCallIndex];
        queryCallIndex += 1;
        if (vector === undefined) throw new Error("query vector missing");
        return Promise.resolve([vector]);
      },
    };

    const signal = new AbortController().signal;
    const validatedDocumentVectors = await embedDenseInputs(
      adapter,
      splitData.chunks.map((chunk) => chunk.text),
      "document",
      signal,
    );
    const index = new InMemoryDenseEvaluationIndex(
      profile,
      splitData.chunks.map((chunk, indexPosition) => ({
        chunkId: chunk.chunkId,
        sourceVersionId: chunk.sourceVersionId,
        parsedArtifactId: chunk.parsedArtifactId,
        startByte: chunk.startByte,
        endByte: chunk.endByte,
        vector: validatedDocumentVectors[indexPosition],
      })),
    );

    const observations = [];
    const rankItems = [];
    const labelsByQuery = groupLabels(splitData.labels);
    for (let queryIndex = 0; queryIndex < splitData.queries.length; queryIndex += 1) {
      const query = splitData.queries[queryIndex];
      const queryVectorList = await embedDenseInputs(adapter, [query.text], "query", signal);
      const queryVector = queryVectorList[0];
      if (queryVector === undefined) throw new Error(`query vector missing for ${query.id}`);
      const searchStarted = performance.now();
      const hits = index.search({ queryVector, limit: TOP_K });
      const searchMs = performance.now() - searchStarted;
      const embeddingMs = Number(inference.queryVectors[queryIndex]?.embedMs ?? NaN);
      if (!Number.isFinite(embeddingMs) || embeddingMs < 0) throw new Error("invalid query embedding latency");
      observations.push({
        queryId: query.id,
        latencyMs: embeddingMs + searchMs,
        hits: hits.map((hit) => ({
          sourceVersionId: hit.sourceVersionId,
          locator: {
            parsedArtifactId: hit.parsedArtifactId,
            startByte: hit.startByte,
            endByte: hit.endByte,
          },
        })),
      });

      const noAnswer = query.categories.includes("no-answer");
      const required = (labelsByQuery.get(query.id) ?? []).filter((label) => label.importance === "required");
      const firstRelevantIndex = noAnswer
        ? -1
        : hits.slice(0, TOP_K).findIndex((hit) => required.some((label) => overlaps(hit, label)));
      rankItems.push({
        ...(includeDevelopmentDiagnostics ? { queryId: query.id, categories: query.categories } : {}),
        noAnswer,
        firstRelevantRank: firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null,
        hitCount: hits.length,
      });
    }
    if (queryCallIndex !== splitData.queries.length) throw new Error("not every query vector was consumed");

    const nodePeakRssBytes = process.resourceUsage().maxRSS * 1024;
    const pythonPeakRssBytes = Number(inference.runtime.peakRssBytes);
    const peakRssBytes = Math.max(nodePeakRssBytes, pythonPeakRssBytes);
    const documentVectorBytes = splitData.chunks.length * profile.dimensions * Float32Array.BYTES_PER_ELEMENT;
    const report = evaluateFtsBaseline(splitData.dataset, observations, {
      peakRssBytes,
      indexBytes: documentVectorBytes,
    });
    const rankSummary = summarizeRanks(rankItems);

    return {
      schemaVersion: 1,
      profile,
      split: splitData.split,
      corpus: {
        artifactCount: splitData.dataset.corpus.length,
        totalChunks: splitData.chunks.length,
        originalChunks: splitData.originalChunks,
        challengeChunks: splitData.challengeChunks,
      },
      queryExecution: {
        queryCount: splitData.queries.length,
        topK: TOP_K,
        errorCount: 0,
      },
      report,
      rankSummary,
      embedding: {
        loadMs: Number(inference.runtime.loadMs),
        warmupMs: Number(inference.runtime.warmupMs),
        documentBuildMs: Number(inference.runtime.documentBuildMs),
        documentVectorBytes,
        queryVectorBytes: splitData.queries.length * profile.dimensions * Float32Array.BYTES_PER_ELEMENT,
        normalization: "L2 via SentenceTransformer.encode(normalize_embeddings=True)",
      },
      runtime: {
        python: inference.runtime.python,
        sentenceTransformers: inference.runtime.sentenceTransformers,
        transformers: inference.runtime.transformers,
        torch: inference.runtime.torch,
        device: inference.runtime.device,
        maxSequenceLength: inference.runtime.maxSequenceLength,
        pythonPeakRssBytes,
        nodePeakRssBytes,
      },
      ...(includeDevelopmentDiagnostics
        ? {
            developmentNonRank1: rankItems
              .filter((item) => !item.noAnswer && item.firstRelevantRank !== 1)
              .map((item) => ({
                queryId: item.queryId,
                categories: item.categories,
                firstRelevantRank: item.firstRelevantRank,
              })),
          }
        : {}),
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function selectDenseWinner(results) {
  const materialMrrStep = 1 / (2 * 42);
  const rule = "eligible dense profile must preserve development Recall@10=1 and all-required coverage=1 and improve MRR over frozen FTS baseline by at least one Rank2→Rank1 dataset step; if multiple eligible profiles are within one material MRR step, prefer lower p95 latency, then lower peak RSS, then fixed profile order";
  const comparisons = results.map((result, order) => {
    const delta = {
      recallAt10: result.report.recallAt10 - FTS_DEVELOPMENT_BASELINE.recallAt10,
      mrr: result.report.mrr - FTS_DEVELOPMENT_BASELINE.mrr,
      allRequiredEvidenceCoverage:
        result.report.allRequiredEvidenceCoverage - FTS_DEVELOPMENT_BASELINE.allRequiredEvidenceCoverage,
    };
    const eligible = result.report.recallAt10 >= FTS_DEVELOPMENT_BASELINE.recallAt10 - EPSILON
      && result.report.allRequiredEvidenceCoverage >= FTS_DEVELOPMENT_BASELINE.allRequiredEvidenceCoverage - EPSILON
      && delta.mrr >= materialMrrStep - EPSILON;
    return {
      profileId: result.profile.id,
      order,
      delta,
      eligible,
      mrr: result.report.mrr,
      p95LatencyMs: result.report.latencyMs.p95,
      peakRssBytes: result.report.resources.peakRssBytes,
    };
  });

  const eligible = comparisons.filter((item) => item.eligible);
  eligible.sort((left, right) => {
    const mrrGap = right.mrr - left.mrr;
    if (Math.abs(mrrGap) >= materialMrrStep - EPSILON) return mrrGap;
    if (left.p95LatencyMs !== right.p95LatencyMs) return left.p95LatencyMs - right.p95LatencyMs;
    if (left.peakRssBytes !== right.peakRssBytes) return left.peakRssBytes - right.peakRssBytes;
    return left.order - right.order;
  });
  const selectedProfileId = eligible[0]?.profileId ?? null;

  return {
    selectedProfileId,
    denseWorthCarryingForward: selectedProfileId !== null,
    materiality: {
      mrrStep: materialMrrStep,
      rationale: "one Rank2→Rank1 equivalent across 42 answerable development queries",
    },
    ftsDevelopmentBaseline: FTS_DEVELOPMENT_BASELINE,
    rule,
    comparisons: comparisons.map(({ order: _order, ...comparison }) => comparison),
    conclusion: selectedProfileId === null
      ? "Dense retrieval is not proven worth its added complexity on development evidence; do not continue sqlite-vec/Hybrid merely to preserve the experiment stack."
      : `Dense profile ${selectedProfileId} cleared the frozen development materiality gate.`,
  };
}

function runPython(inputPath, outputPath) {
  const python = process.env.P2_DENSE_PYTHON ?? "python";
  const result = spawnSync(
    python,
    [path.join(repoRoot, "scripts", "p2-embed-dense.py"), "--input", inputPath, "--output", outputPath],
    { cwd: repoRoot, env: process.env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`dense embedding subprocess failed with exit ${String(result.status)}`);
}

function validateInference(profile, splitData, preparedDocuments, preparedQueries, inference) {
  if (inference.profileId !== profile.id) throw new Error("dense inference profile id mismatch");
  if (inference.model !== profile.model || inference.revision !== profile.version) {
    throw new Error("dense inference model identity mismatch");
  }
  if (Number(inference.dimensions) !== profile.dimensions) throw new Error("dense inference dimension mismatch");
  if (!Array.isArray(inference.documentVectors) || inference.documentVectors.length !== preparedDocuments.length) {
    throw new Error("dense document vector count mismatch");
  }
  if (!Array.isArray(inference.queryVectors) || inference.queryVectors.length !== preparedQueries.length) {
    throw new Error("dense query vector count mismatch");
  }
  if (splitData.chunks.length !== 38) throw new Error("dense corpus chunk count drift");
}

function assertPreparedInputs(actual, expected, label) {
  if (actual.length !== expected.length) throw new Error(`${label} prepared input count mismatch`);
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) throw new Error(`${label} preprocessing mismatch at index ${String(index)}`);
  }
}

function assertCanonicalIdentity(record, canonical) {
  if (canonical.sourceVersionId !== record.parsedArtifact.sourceVersionId
    || canonical.canonicalTextSha256 !== record.parsedArtifact.canonicalTextSha256
    || canonical.parserFingerprint !== record.parsedArtifact.parserFingerprint
    || canonical.normalizationFingerprint !== record.parsedArtifact.normalizationFingerprint) {
    throw new Error(`canonical ParsedArtifact identity drift: ${record.id}`);
  }
}

function groupLabels(labels) {
  const grouped = new Map();
  for (const label of labels) {
    const current = grouped.get(label.queryId) ?? [];
    current.push(label);
    grouped.set(label.queryId, current);
  }
  return grouped;
}

function overlaps(hit, label) {
  return hit.sourceVersionId === label.sourceVersionId
    && hit.parsedArtifactId === label.parsedArtifactId
    && hit.startByte < label.endByte
    && hit.endByte > label.startByte;
}

function summarizeRanks(items) {
  const answerable = items.filter((item) => !item.noAnswer);
  return {
    answerableQueries: answerable.length,
    rank1: answerable.filter((item) => item.firstRelevantRank === 1).length,
    rank2: answerable.filter((item) => item.firstRelevantRank === 2).length,
    rank3: answerable.filter((item) => item.firstRelevantRank === 3).length,
    rank4To10: answerable.filter(
      (item) => item.firstRelevantRank !== null && item.firstRelevantRank >= 4 && item.firstRelevantRank <= 10,
    ).length,
    miss: answerable.filter((item) => item.firstRelevantRank === null).length,
  };
}

function compactDevelopment(result) {
  return {
    profileId: result.profile.id,
    model: result.profile.model,
    revision: result.profile.version,
    dimensions: result.profile.dimensions,
    preprocessing: result.profile.preprocessing,
    report: result.report,
    rankSummary: result.rankSummary,
    embedding: result.embedding,
    runtime: result.runtime,
    developmentNonRank1: result.developmentNonRank1,
  };
}

function aggregateOnly(result) {
  return {
    profileId: result.profile.id,
    split: result.split,
    corpus: result.corpus,
    queryExecution: result.queryExecution,
    report: result.report,
    rankSummary: result.rankSummary,
    embedding: result.embedding,
    runtime: result.runtime,
  };
}

function renderMarkdown(evidence) {
  const rows = evidence.development.map((item) => (
    `| \`${item.profileId}\` | ${item.report.recallAt10.toFixed(6)} | ${item.report.mrr.toFixed(6)} | ${item.report.allRequiredEvidenceCoverage.toFixed(6)} | ${item.rankSummary.rank1}/${item.rankSummary.rank2}/${item.rankSummary.rank3}/${item.rankSummary.rank4To10}/${item.rankSummary.miss} | ${item.report.latencyMs.median.toFixed(3)} / ${item.report.latencyMs.p95.toFixed(3)} / ${item.report.latencyMs.max.toFixed(3)} | ${String(item.report.resources.peakRssBytes)} | ${String(item.embedding.documentVectorBytes)} |`
  )).join("\n");
  const holdout = evidence.holdoutAcceptance === null
    ? "Holdout was not encoded or evaluated because no dense profile cleared the development gate."
    : `Selected-profile aggregate holdout: Recall@10=${evidence.holdoutAcceptance.report.recallAt10}, MRR=${evidence.holdoutAcceptance.report.mrr}, coverage=${evidence.holdoutAcceptance.report.allRequiredEvidenceCoverage}.`;
  return `# P2-T06 dense evidence\n\nGenerated from GitHub Actions evidence harness. Runner latency/RSS are not Omarchy measurements.\n\n## Development\n\n| Profile | Recall@10 | MRR | Coverage | R1/R2/R3/R4-10/miss | median/p95/max ms | peak RSS B | doc vector B |\n| --- | ---: | ---: | ---: | --- | --- | ---: | ---: |\n${rows}\n\n## Selection\n\n- FTS development MRR: ${FTS_DEVELOPMENT_BASELINE.mrr}\n- Dense winner: ${evidence.selection.selectedProfileId ?? "NONE"}\n- Carry Dense forward: ${evidence.selection.denseWorthCarryingForward ? "yes" : "no"}\n- Conclusion: ${evidence.selection.conclusion}\n\n## Holdout\n\n${holdout}\n`;
}

async function readJsonLines(filePath) {
  const text = await readFile(filePath, "utf8");
  return text.split(/\r?\n/u).filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}
