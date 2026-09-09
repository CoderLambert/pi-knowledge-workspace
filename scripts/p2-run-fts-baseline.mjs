#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { evaluateFtsBaseline } from "../src/knowledge/eval/ftsBaselineEvaluation.ts";
import { validateGoldenDataset } from "../src/knowledge/eval/goldenDataset.ts";
import { chunkParsedArtifact } from "../src/knowledge/storage/chunker.ts";
import { openKnowledgeDatabase } from "../src/knowledge/storage/database.ts";
import { Fts5BaselineIndex } from "../src/knowledge/storage/fts5Index.ts";
import { IndexBuildPublisher } from "../src/knowledge/storage/indexBuildPublication.ts";
import { canonicalizeParsedArtifact } from "../src/knowledge/storage/parsedArtifact.ts";
import { SearchQueryApi } from "../src/knowledge/storage/searchQuery.ts";

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
const FIXED_NOW = "2026-09-09T07:00:00.000Z";
const WORKSPACE_ID = "workspace-p2-t04-expanded";
const BUILD_ID = "build-p2-t04-expanded";

const repoRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(
  process.env.P2_EVIDENCE_OUT_DIR ?? "/tmp/pi-knowledge-p2-evidence/p2-t04",
);
await mkdir(outDir, { recursive: true });

const repoSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();

const corpus = await Promise.all(CORPUS_RECORDS.map(readCorpusRecord));
const development = await readJsonLines("eval/queries/development.jsonl");
const holdout = await readJsonLines("eval/queries/holdout.jsonl");
const developmentLabels = await readJsonLines("eval/labels/development.jsonl");
const holdoutLabels = await readJsonLines("eval/labels/holdout.jsonl");
const queries = [...development, ...holdout];
const labels = [...developmentLabels, ...holdoutLabels];
const dataset = { schemaVersion: 1, corpus, queries, labels };
validateGoldenDataset(dataset);

const dbDir = await mkdtemp(path.join(tmpdir(), "p2-t04-expanded-"));
const dbPath = path.join(dbDir, "knowledge.sqlite");
const db = openKnowledgeDatabase(dbPath);

try {
  db.prepare("INSERT INTO installations (id, created_at) VALUES (?, ?)")
    .run("installation-p2", FIXED_NOW);
  db.prepare(`
    INSERT INTO knowledge_workspaces (
      id, installation_id, canonical_realpath, external_binding, created_at
    ) VALUES (?, ?, ?, NULL, ?)
  `).run(WORKSPACE_ID, "installation-p2", "/p2/eval-workspace", FIXED_NOW);

  const indexedArtifacts = [];
  for (let index = 0; index < corpus.length; index += 1) {
    const record = corpus[index];
    const bytes = await readFile(path.resolve(repoRoot, "eval", record.relativePath));
    const actualHash = sha256(bytes);
    if (actualHash !== record.parsedArtifact.canonicalTextSha256) {
      throw new Error(`corpus hash mismatch: ${record.id}`);
    }

    const sourceKind = record.mediaType === "text/markdown" ? "md" : "txt";
    const canonical = canonicalizeParsedArtifact(
      record.parsedArtifact.sourceVersionId,
      bytes,
      sourceKind,
    );
    if (canonical.canonicalTextSha256 !== record.parsedArtifact.canonicalTextSha256) {
      throw new Error(`canonical hash mismatch: ${record.id}`);
    }
    if (canonical.parserFingerprint !== record.parsedArtifact.parserFingerprint) {
      throw new Error(`parser fingerprint mismatch: ${record.id}`);
    }
    if (canonical.normalizationFingerprint !== record.parsedArtifact.normalizationFingerprint) {
      throw new Error(`normalization fingerprint mismatch: ${record.id}`);
    }

    const sourceId = `source-p2-${index + 1}`;
    db.prepare(`
      INSERT INTO sources (
        id, knowledge_workspace_id, kind, display_name, archived_at, created_at
      ) VALUES (?, ?, ?, ?, NULL, ?)
    `).run(sourceId, WORKSPACE_ID, sourceKind, record.source.title, FIXED_NOW);

    db.prepare(`
      INSERT INTO source_versions (
        id, source_id, content_sha256, blob_key, byte_length, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      record.parsedArtifact.sourceVersionId,
      sourceId,
      actualHash,
      actualHash,
      bytes.byteLength,
      FIXED_NOW,
    );

    db.prepare(`
      INSERT INTO parsed_artifacts (
        id, source_version_id, parser_version, canonical_text_sha256, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      record.parsedArtifact.parsedArtifactId,
      record.parsedArtifact.sourceVersionId,
      `${canonical.parserFingerprint}|${canonical.normalizationFingerprint}`,
      canonical.canonicalTextSha256,
      FIXED_NOW,
    );

    indexedArtifacts.push({ record, canonical });
  }

  const publisher = new IndexBuildPublisher(db, {
    now: () => new Date(FIXED_NOW),
    createId: () => BUILD_ID,
  });
  const build = publisher.createStaging(WORKSPACE_ID, "fts5-unicode61-p2-expanded");
  if (build.id !== BUILD_ID) throw new Error("unexpected IndexBuild id");

  const fts = new Fts5BaselineIndex(db);
  let totalChunks = 0;
  let originalChunks = 0;
  let challengeChunks = 0;
  const chunksByRecord = {};

  for (const { record, canonical } of indexedArtifacts) {
    const chunks = chunkParsedArtifact(canonical);
    chunksByRecord[record.id] = chunks.length;
    totalChunks += chunks.length;
    if (CHALLENGE_RECORDS.some((name) => record.relativePath.endsWith(`${name}.md`))) {
      challengeChunks += chunks.length;
      if (chunks.length < 10) {
        throw new Error(`challenge chunk pressure too small: ${record.id} -> ${chunks.length}`);
      }
    } else {
      originalChunks += chunks.length;
    }

    fts.replaceArtifactChunks({
      knowledgeWorkspaceId: WORKSPACE_ID,
      indexBuildId: BUILD_ID,
      sourceVersionId: record.parsedArtifact.sourceVersionId,
      parsedArtifactId: record.parsedArtifact.parsedArtifactId,
      chunks,
      createdAt: FIXED_NOW,
    });
  }

  if (challengeChunks < 30) {
    throw new Error(`challenge corpus must produce at least 30 chunks; got ${challengeChunks}`);
  }

  publisher.markValidated(BUILD_ID);
  publisher.publish(BUILD_ID);
  db.pragma("wal_checkpoint(TRUNCATE)");

  const search = new SearchQueryApi(db, fts);
  const observations = [];
  const detailsByQuery = new Map();
  const queryErrors = [];

  for (const query of queries) {
    const started = performance.now();
    let hits = [];
    try {
      const result = search.query({
        knowledgeWorkspaceId: WORKSPACE_ID,
        query: query.text,
        limit: TOP_K,
      });
      hits = result.hits;
    } catch (error) {
      queryErrors.push({
        queryId: query.id,
        split: query.split,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const latencyMs = performance.now() - started;
    detailsByQuery.set(query.id, hits);
    observations.push({
      queryId: query.id,
      latencyMs,
      hits: hits.map((hit) => ({
        sourceVersionId: hit.sourceVersionId,
        locator: hit.locator,
      })),
    });
  }

  db.pragma("wal_checkpoint(TRUNCATE)");
  const ftsAllocationRows = db.prepare(`
    SELECT name, COUNT(*) AS pages, SUM(pgsize) AS bytes
    FROM dbstat
    WHERE name = 'chunk_fts' OR name GLOB 'chunk_fts_*'
    GROUP BY name
    ORDER BY name
  `).all();
  const ftsIndexBytes = ftsAllocationRows.reduce(
    (sum, row) => sum + Number(row.bytes ?? 0),
    0,
  );
  const peakRssBytes = process.resourceUsage().maxRSS * 1024;
  const resources = { peakRssBytes, indexBytes: ftsIndexBytes };
  const report = evaluateFtsBaseline(dataset, observations, resources);

  const labelsByQuery = groupLabels(labels);
  const developmentIds = new Set(development.map((query) => query.id));
  const rankObservations = queries.map((query) => {
    const noAnswer = query.categories.includes("no-answer");
    const required = (labelsByQuery.get(query.id) ?? [])
      .filter((label) => label.importance === "required");
    const hits = (detailsByQuery.get(query.id) ?? []).slice(0, TOP_K);
    const firstRelevantIndex = noAnswer
      ? -1
      : hits.findIndex((hit) => required.some((label) => overlaps(hit, label)));
    return {
      queryId: query.id,
      split: developmentIds.has(query.id) ? "development" : "holdout",
      noAnswer,
      firstRelevantRank: firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null,
      hits,
    };
  });

  const rankSummary = {
    overall: summarizeRanks(rankObservations),
    development: summarizeRanks(rankObservations.filter((item) => item.split === "development")),
    holdout: summarizeRanks(rankObservations.filter((item) => item.split === "holdout")),
  };

  const developmentNonRank1 = rankObservations
    .filter((item) => item.split === "development" && !item.noAnswer && item.firstRelevantRank !== 1)
    .map((item) => ({
      queryId: item.queryId,
      firstRelevantRank: item.firstRelevantRank,
      topHits: item.hits.slice(0, 3).map(compactHit),
    }));

  const developmentMisses = developmentNonRank1.filter((item) => item.firstRelevantRank === null);
  const noAnswerBySplit = {
    development: summarizeNoAnswer(rankObservations.filter((item) => item.split === "development")),
    holdout: summarizeNoAnswer(rankObservations.filter((item) => item.split === "holdout")),
  };

  const sqliteVersion = String(
    db.prepare("SELECT sqlite_version() AS version").get()?.version ?? "unknown",
  );
  const benchmarkValid = queryErrors.length === 0;

  const evidence = {
    schemaVersion: 1,
    benchmark: "p2-t04-expanded-fts-baseline",
    benchmarkValid,
    generatedAt: new Date().toISOString(),
    repoSha,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      sqliteVersion,
    },
    corpus: {
      recordNames: CORPUS_RECORDS,
      artifactCount: corpus.length,
      originalArtifactCount: ORIGINAL_RECORDS.length,
      challengeArtifactCount: CHALLENGE_RECORDS.length,
      totalChunks,
      originalChunks,
      challengeChunks,
      chunksByRecord,
    },
    queryExecution: {
      queryCount: queries.length,
      topK: TOP_K,
      errorCount: queryErrors.length,
      developmentErrors: queryErrors.filter((item) => item.split === "development"),
      holdoutErrorCount: queryErrors.filter((item) => item.split === "holdout").length,
    },
    report,
    rankSummary,
    developmentNonRank1,
    developmentMisses,
    noAnswerBySplit,
    storage: {
      ftsAllocationRows,
      ftsIndexBytes,
      dbPath,
    },
  };

  const jsonPath = path.join(outDir, "fts-expanded-result.json");
  const markdownPath = path.join(outDir, "fts-expanded-result.md");
  await writeFile(jsonPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  await writeFile(markdownPath, renderMarkdown(evidence), "utf8");

  console.log("===== P2-T04 EXPANDED FTS RESULT =====");
  console.log(JSON.stringify({
    benchmarkValid,
    repoSha,
    corpus: evidence.corpus,
    queryExecution: evidence.queryExecution,
    report,
    rankSummary,
    developmentNonRank1,
    noAnswerBySplit,
    ftsIndexBytes,
    outDir,
  }, null, 2));

  if (!benchmarkValid) process.exitCode = 2;
} finally {
  db.close();
}

async function readCorpusRecord(name) {
  const metadataPath = path.resolve(repoRoot, "eval", "corpus", `${name}.meta.json`);
  return JSON.parse(await readFile(metadataPath, "utf8"));
}

async function readJsonLines(relativePath) {
  const raw = await readFile(path.resolve(repoRoot, relativePath), "utf8");
  return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function groupLabels(allLabels) {
  const grouped = new Map();
  for (const label of allLabels) {
    const current = grouped.get(label.queryId) ?? [];
    current.push(label);
    grouped.set(label.queryId, current);
  }
  return grouped;
}

function overlaps(hit, label) {
  return hit.sourceVersionId === label.sourceVersionId
    && hit.locator.parsedArtifactId === label.parsedArtifactId
    && hit.locator.startByte < label.endByte
    && hit.locator.endByte > label.startByte;
}

function summarizeRanks(items) {
  const answerable = items.filter((item) => !item.noAnswer);
  return {
    answerableQueries: answerable.length,
    rank1: answerable.filter((item) => item.firstRelevantRank === 1).length,
    rank2: answerable.filter((item) => item.firstRelevantRank === 2).length,
    rank3: answerable.filter((item) => item.firstRelevantRank === 3).length,
    rank4To10: answerable.filter((item) => (
      item.firstRelevantRank !== null
      && item.firstRelevantRank >= 4
      && item.firstRelevantRank <= TOP_K
    )).length,
    miss: answerable.filter((item) => item.firstRelevantRank === null).length,
  };
}

function summarizeNoAnswer(items) {
  const noAnswer = items.filter((item) => item.noAnswer);
  return {
    queries: noAnswer.length,
    withAnyHit: noAnswer.filter((item) => item.hits.length > 0).length,
  };
}

function compactHit(hit) {
  return {
    sourceVersionId: hit.sourceVersionId,
    parsedArtifactId: hit.locator.parsedArtifactId,
    startByte: hit.locator.startByte,
    endByte: hit.locator.endByte,
    rank: hit.rank,
    snippet: hit.snippet.replace(/\s+/gu, " ").slice(0, 160),
  };
}

function renderMarkdown(result) {
  const r = result.report;
  return [
    "# P2-T04 expanded-corpus FTS evidence",
    "",
    `Benchmark valid: **${String(result.benchmarkValid)}**`,
    `Repository SHA: \`${result.repoSha}\``,
    `Node: \`${result.runtime.node}\``,
    `SQLite: \`${result.runtime.sqliteVersion}\``,
    "",
    "## Corpus",
    "",
    `- artifacts: ${result.corpus.artifactCount}`,
    `- original chunks: ${result.corpus.originalChunks}`,
    `- challenge chunks: ${result.corpus.challengeChunks}`,
    `- total chunks: ${result.corpus.totalChunks}`,
    "",
    "## Metrics",
    "",
    `- query count: ${r.queryCount}`,
    `- answerable queries: ${r.scoredAnswerableQueries}`,
    `- no-answer queries: ${r.noAnswerQueries}`,
    `- no-answer with any hit: ${r.noAnswerQueriesWithAnyHit}`,
    `- Recall@10: ${r.recallAt10}`,
    `- MRR: ${r.mrr}`,
    `- all-required Evidence coverage: ${r.allRequiredEvidenceCoverage}`,
    `- latency median / p95 / max: ${r.latencyMs.median} / ${r.latencyMs.p95} / ${r.latencyMs.max} ms`,
    `- peak RSS bytes: ${r.resources.peakRssBytes}`,
    `- FTS dbstat bytes: ${r.resources.indexBytes}`,
    "",
    "## Rank summary",
    "",
    "```json",
    JSON.stringify(result.rankSummary, null, 2),
    "```",
    "",
    "## Development non-rank-1 diagnostics",
    "",
    ...(result.developmentNonRank1.length === 0
      ? ["None."]
      : ["```json", JSON.stringify(result.developmentNonRank1, null, 2), "```"]),
    "",
    "## Query errors",
    "",
    `- total: ${result.queryExecution.errorCount}`,
    `- holdout error count: ${result.queryExecution.holdoutErrorCount}`,
    ...(result.queryExecution.developmentErrors.length === 0
      ? ["- development errors: none"]
      : ["- development errors:", "", "```json", JSON.stringify(result.queryExecution.developmentErrors, null, 2), "```"]),
    "",
    "Holdout query identities and per-query hit details are intentionally not emitted by this harness for tuning.",
    "",
  ].join("\n");
}
