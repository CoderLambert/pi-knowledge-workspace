#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { validateGoldenDataset } from "../src/knowledge/eval/goldenDataset.ts";
import {
  renderRetrievalBenchmarkMarkdown,
  runRetrievalBenchmark,
} from "../src/knowledge/eval/retrievalBenchmarkRunner.ts";
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
const FIXED_NOW = "2026-09-09T08:20:00.000Z";
const WORKSPACE_ID = "workspace-p2-t09-benchmark";
const BUILD_ID = "build-p2-t09-fts-baseline";

const repoRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(
  process.env.P2_T09_EVIDENCE_OUT_DIR ?? "/tmp/pi-knowledge-p2-evidence/p2-t09",
);
await mkdir(outDir, { recursive: true });

const repoSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();
const generatedAt = new Date().toISOString();

const corpus = await Promise.all(CORPUS_RECORDS.map(readCorpusRecord));
const development = await readJsonLines("eval/queries/development.jsonl");
const developmentLabels = await readJsonLines("eval/labels/development.jsonl");
const dataset = {
  schemaVersion: 1,
  corpus,
  queries: development,
  labels: developmentLabels,
};
validateGoldenDataset(dataset);

const datasetFiles = [
  ...CORPUS_RECORDS.flatMap((name) => [
    `eval/corpus/${name}.md`,
    `eval/corpus/${name}.meta.json`,
  ]),
  "eval/queries/development.jsonl",
  "eval/labels/development.jsonl",
];
const datasetHash = await hashFiles(datasetFiles);

const dbDir = await mkdtemp(path.join(tmpdir(), "p2-t09-benchmark-"));
const dbPath = path.join(dbDir, "knowledge.sqlite");
const db = openKnowledgeDatabase(dbPath);

try {
  db.prepare("INSERT INTO installations (id, created_at) VALUES (?, ?)")
    .run("installation-p2-t09", FIXED_NOW);
  db.prepare(`
    INSERT INTO knowledge_workspaces (
      id, installation_id, canonical_realpath, external_binding, created_at
    ) VALUES (?, ?, ?, NULL, ?)
  `).run(WORKSPACE_ID, "installation-p2-t09", "/p2/t09-benchmark", FIXED_NOW);

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

    const sourceId = `source-p2-t09-${String(index + 1)}`;
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
    indexedArtifacts.push({
      corpusName: CORPUS_RECORDS[index],
      record,
      canonical,
    });
  }

  const publisher = new IndexBuildPublisher(db, {
    now: () => new Date(FIXED_NOW),
    createId: () => BUILD_ID,
  });
  const build = publisher.createStaging(WORKSPACE_ID, "fts5-unicode61-p2-t09");
  if (build.id !== BUILD_ID) throw new Error("unexpected IndexBuild id");

  const fts = new Fts5BaselineIndex(db);
  let totalChunks = 0;
  let challengeChunks = 0;
  const chunksByRecord = {};
  for (const { corpusName, record, canonical } of indexedArtifacts) {
    const chunks = chunkParsedArtifact(canonical);
    chunksByRecord[record.id] = chunks.length;
    totalChunks += chunks.length;
    if (CHALLENGE_RECORDS.includes(corpusName)) challengeChunks += chunks.length;
    fts.replaceArtifactChunks({
      knowledgeWorkspaceId: WORKSPACE_ID,
      indexBuildId: BUILD_ID,
      sourceVersionId: record.parsedArtifact.sourceVersionId,
      parsedArtifactId: record.parsedArtifact.parsedArtifactId,
      chunks,
      createdAt: FIXED_NOW,
    });
  }
  if (totalChunks !== 38 || challengeChunks !== 35) {
    throw new Error(`frozen corpus pressure mismatch: total=${String(totalChunks)} challenge=${String(challengeChunks)}`);
  }

  publisher.markValidated(BUILD_ID);
  publisher.publish(BUILD_ID);
  db.pragma("wal_checkpoint(TRUNCATE)");

  const search = new SearchQueryApi(db, fts);
  const observations = [];
  for (const query of development) {
    const started = performance.now();
    const result = search.query({
      knowledgeWorkspaceId: WORKSPACE_ID,
      query: query.text,
      limit: TOP_K,
    });
    observations.push({
      queryId: query.id,
      latencyMs: performance.now() - started,
      hits: result.hits.map((hit) => ({
        sourceVersionId: hit.sourceVersionId,
        locator: hit.locator,
      })),
    });
  }
  if (observations.length !== development.length) {
    throw new Error("development observation count mismatch");
  }

  db.pragma("wal_checkpoint(TRUNCATE)");
  const allocationRows = db.prepare(`
    SELECT name, COUNT(*) AS pages, SUM(pgsize) AS bytes
    FROM dbstat
    WHERE name = 'chunk_fts' OR name GLOB 'chunk_fts_*'
    GROUP BY name
    ORDER BY name
  `).all();
  const ftsIndexBytes = allocationRows.reduce(
    (sum, row) => sum + Number(row.bytes ?? 0),
    0,
  );
  const resources = {
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    indexBytes: ftsIndexBytes,
  };

  const configuration = {
    retriever: "sqlite-fts5",
    tokenizer: "unicode61",
    lexicalProfile: "baseline",
    naturalLanguageCompiler: "quoted-literal-or",
    topK: TOP_K,
    corpusChunks: totalChunks,
    challengeChunks,
  };
  const report = runRetrievalBenchmark(
    dataset,
    "development",
    generatedAt,
    [{
      id: "fts-baseline",
      configuration,
      observations,
      resources,
    }],
  );
  const markdown = renderRetrievalBenchmarkMarkdown(report);

  const provenance = {
    schemaVersion: 1,
    benchmark: "p2-t09-retrieval-benchmark",
    repoSha,
    datasetHash,
    datasetFiles,
    generatedAt,
    split: "development",
    queryCount: development.length,
    corpus: {
      records: CORPUS_RECORDS,
      totalChunks,
      challengeChunks,
      chunksByRecord,
    },
    configuration,
    resources,
    sqliteVersion: String(
      db.prepare("SELECT sqlite_version() AS version").get()?.version ?? "unknown",
    ),
    node: process.version,
    report,
  };

  await writeFile(
    path.join(outDir, "retrieval-benchmark-development.md"),
    markdown,
    "utf8",
  );
  await writeFile(
    path.join(outDir, "retrieval-benchmark-development.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(outDir, "observations-development.json"),
    `${JSON.stringify(observations, null, 2)}\n`,
    "utf8",
  );

  console.log("===== P2-T09 GENERATED DEVELOPMENT BENCHMARK =====");
  console.log(markdown);
  console.log("===== P2-T09 PROVENANCE =====");
  console.log(JSON.stringify({
    repoSha,
    datasetHash,
    generatedAt,
    configuration,
    resources,
    metrics: report.variants[0]?.metrics,
    outDir,
  }, null, 2));
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

async function hashFiles(relativePaths) {
  const hash = createHash("sha256");
  for (const relativePath of [...relativePaths].sort()) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(path.resolve(repoRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
