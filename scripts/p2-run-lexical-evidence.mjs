#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { evaluateFtsBaseline } from "../src/knowledge/eval/ftsBaselineEvaluation.ts";
import { validateGoldenDataset } from "../src/knowledge/eval/goldenDataset.ts";
import {
  LEXICAL_NORMALIZATION_PROFILES,
  normalizeLexicalText,
} from "../src/knowledge/eval/lexicalNormalization.ts";
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
const PROFILE_IDS = LEXICAL_NORMALIZATION_PROFILES.map((profile) => profile.id);
const TOP_K = 10;
const FIXED_NOW = "2026-09-09T07:00:00.000Z";
const REFERENCE_EXPANDED_BASELINE = Object.freeze({
  source: "P2-T04 GitHub Actions evidence run 34320914371 / artifact 10091833384",
  corpusChunks: 38,
  challengeChunks: 35,
  topK: 10,
  recallAt10: 1,
  mrr: 0.928921568627451,
  allRequiredEvidenceCoverage: 1,
  developmentRankDistribution: {
    answerableQueries: 42,
    rank1: 37,
    rank2: 4,
    rank3: 1,
    rank4To10: 0,
    miss: 0,
  },
});
const EPSILON = 1e-12;

const repoRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(
  process.env.P2_LEXICAL_EVIDENCE_OUT_DIR ?? "/tmp/pi-knowledge-p2-evidence/p2-t05",
);
await mkdir(outDir, { recursive: true });

const args = parseArgs(process.argv.slice(2));
if (args.child) {
  if (!PROFILE_IDS.includes(args.profile)) {
    throw new Error(`Unknown lexical profile: ${args.profile ?? "<missing>"}`);
  }
  if (args.split !== "development" && args.split !== "holdout") {
    throw new Error(`Unknown split: ${args.split ?? "<missing>"}`);
  }
  await runProfile(args.profile, args.split);
} else {
  await orchestrate();
}

async function orchestrate() {
  const repoSha = git(["rev-parse", "HEAD"]);
  const developmentResults = [];
  for (const profileId of PROFILE_IDS) {
    runChild(profileId, "development");
    developmentResults.push(await readResult("development", profileId));
  }

  const baseline = developmentResults.find((item) => item.profileId === "baseline");
  if (!baseline) throw new Error("development baseline result missing");
  assertExpandedDevelopmentBaseline(baseline);

  const selection = selectWinner(developmentResults);
  await writeFile(
    path.join(outDir, "selection.json"),
    JSON.stringify(selection, null, 2) + "\n",
    "utf8",
  );

  console.log("===== P2-T05 PROFILE FROZEN FROM DEVELOPMENT EVIDENCE =====");
  console.log(JSON.stringify(selection, null, 2));

  runChild(selection.winnerProfileId, "holdout");
  const holdout = await readResult("holdout", selection.winnerProfileId);

  const evidence = {
    schemaVersion: 1,
    benchmark: "p2-t05-lexical-normalization",
    generatedAt: new Date().toISOString(),
    repoSha,
    protocol: {
      profileOrder: PROFILE_IDS,
      topK: TOP_K,
      tuningSplit: "development",
      holdoutPolicy: "winner-only aggregate acceptance after development profile freeze",
      selectionRule: selection.rule,
    },
    referenceExpandedBaseline: REFERENCE_EXPANDED_BASELINE,
    development: {
      queryCount: baseline.report.queryCount,
      answerableQueries: baseline.report.scoredAnswerableQueries,
      materiality: selection.materiality,
      winnerProfileId: selection.winnerProfileId,
      profiles: developmentResults,
    },
    holdoutAcceptance: aggregateOnly(holdout),
  };

  await writeFile(
    path.join(outDir, "lexical-evidence.json"),
    JSON.stringify(evidence, null, 2) + "\n",
    "utf8",
  );
  await writeFile(
    path.join(outDir, "lexical-evidence.md"),
    renderMarkdown(evidence),
    "utf8",
  );

  console.log("===== P2-T05 LEXICAL EVIDENCE =====");
  console.log(JSON.stringify({
    repoSha,
    winnerProfileId: selection.winnerProfileId,
    materiality: selection.materiality,
    development: developmentResults.map(compactDevelopmentResult),
    holdoutAcceptance: aggregateOnly(holdout),
    outDir,
  }, null, 2));
}

function runChild(profileId, split) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawnSync(
    npx,
    ["tsx", path.resolve(import.meta.filename), "--child", "--profile", profileId, "--split", split],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        P2_LEXICAL_EVIDENCE_OUT_DIR: outDir,
      },
      stdio: "inherit",
    },
  );
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`lexical profile child failed: ${profileId}/${split} exit=${child.status}`);
  }
}

async function runProfile(profileId, split) {
  const queries = await readJsonLines(`eval/queries/${split}.jsonl`);
  const labels = await readJsonLines(`eval/labels/${split}.jsonl`);
  const corpus = await Promise.all(CORPUS_RECORDS.map(readCorpusRecord));
  const dataset = { schemaVersion: 1, corpus, queries, labels };
  validateGoldenDataset(dataset);

  const dbDir = await mkdtemp(path.join(tmpdir(), `p2-t05-${profileId}-${split}-`));
  const dbPath = path.join(dbDir, "knowledge.sqlite");
  const db = openKnowledgeDatabase(dbPath);
  const workspaceId = `workspace-p2-t05-${profileId}-${split}`;
  const buildId = `build-p2-t05-${profileId}-${split}`;

  try {
    seedWorkspace(db, workspaceId);

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
      assertCanonicalIdentity(record, canonical);
      seedArtifact(db, workspaceId, index, record, sourceKind, bytes.byteLength, actualHash, canonical);
      indexedArtifacts.push({ record, canonical });
    }

    const publisher = new IndexBuildPublisher(db, {
      now: () => new Date(FIXED_NOW),
      createId: () => buildId,
    });
    const buildStarted = performance.now();
    const build = publisher.createStaging(workspaceId, `fts5-unicode61-p2-t05-${profileId}`);
    if (build.id !== buildId) throw new Error("unexpected IndexBuild id");

    const fts = new Fts5BaselineIndex(db);
    let totalChunks = 0;
    let originalChunks = 0;
    let challengeChunks = 0;
    let derivedIndexTermCount = 0;
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
        knowledgeWorkspaceId: workspaceId,
        indexBuildId: buildId,
        sourceVersionId: record.parsedArtifact.sourceVersionId,
        parsedArtifactId: record.parsedArtifact.parsedArtifactId,
        chunks,
        createdAt: FIXED_NOW,
      });

      if (profileId !== "baseline") {
        const rows = db.prepare(`
          SELECT id, ordinal, text
          FROM chunks
          WHERE index_build_id = ? AND parsed_artifact_id = ?
          ORDER BY ordinal
        `).all(buildId, record.parsedArtifact.parsedArtifactId);
        if (rows.length !== chunks.length) {
          throw new Error(`chunk row count mismatch: ${record.id}`);
        }
        const updateFtsText = db.prepare("UPDATE chunk_fts SET text = ? WHERE chunk_id = ?");
        for (const row of rows) {
          const normalized = normalizeLexicalText(String(row.text), profileId);
          derivedIndexTermCount += normalized.derivedTerms.length;
          updateFtsText.run(normalized.expandedText, String(row.id));
        }
      }
    }

    if (challengeChunks < 30 || totalChunks !== 38 || originalChunks !== 3) {
      throw new Error(
        `unexpected corpus pressure: total=${totalChunks} original=${originalChunks} challenge=${challengeChunks}`,
      );
    }

    publisher.markValidated(buildId);
    publisher.publish(buildId);
    db.pragma("wal_checkpoint(TRUNCATE)");
    const indexBuildMs = performance.now() - buildStarted;

    const search = new SearchQueryApi(db, fts);
    const observations = [];
    const rankItems = [];
    let derivedQueryTermCount = 0;
    let queryErrorCount = 0;
    const queryErrors = [];
    const labelsByQuery = groupLabels(labels);

    for (const query of queries) {
      const normalizedQuery = normalizeLexicalText(query.text, profileId);
      derivedQueryTermCount += normalizedQuery.derivedTerms.length;
      const started = performance.now();
      let hits = [];
      try {
        const result = search.query({
          knowledgeWorkspaceId: workspaceId,
          query: normalizedQuery.expandedText,
          limit: TOP_K,
        });
        hits = result.hits;
      } catch (error) {
        queryErrorCount += 1;
        if (split === "development") {
          queryErrors.push({
            queryId: query.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const latencyMs = performance.now() - started;
      observations.push({
        queryId: query.id,
        latencyMs,
        hits: hits.map((hit) => ({
          sourceVersionId: hit.sourceVersionId,
          locator: hit.locator,
        })),
      });

      const noAnswer = query.categories.includes("no-answer");
      const required = (labelsByQuery.get(query.id) ?? [])
        .filter((label) => label.importance === "required");
      const firstRelevantIndex = noAnswer
        ? -1
        : hits.slice(0, TOP_K)
            .findIndex((hit) => required.some((label) => overlaps(hit, label)));
      rankItems.push({
        ...(split === "development" ? { queryId: query.id, categories: query.categories } : {}),
        noAnswer,
        firstRelevantRank: firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null,
        hitCount: hits.length,
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
    const rankSummary = summarizeRanks(rankItems);
    const ftsDerivedRowCount = Number(db.prepare(`
      SELECT COUNT(*) AS count
      FROM chunks c
      JOIN chunk_fts f ON f.chunk_id = c.id
      WHERE c.index_build_id = ? AND f.text <> c.text
    `).get(buildId)?.count ?? 0);

    const result = {
      schemaVersion: 1,
      profileId,
      split,
      repoSha: git(["rev-parse", "HEAD"]),
      corpus: {
        artifactCount: corpus.length,
        totalChunks,
        originalChunks,
        challengeChunks,
        chunksByRecord,
      },
      queryExecution: {
        queryCount: queries.length,
        topK: TOP_K,
        errorCount: queryErrorCount,
        ...(split === "development" ? { errors: queryErrors } : {}),
      },
      report,
      rankSummary,
      build: {
        indexBuildMs,
        derivedIndexTermCount,
        derivedQueryTermCount,
        ftsDerivedRowCount,
        originalChunkRowsPreserved: true,
      },
      storage: {
        ftsAllocationRows,
        ftsIndexBytes,
      },
      ...(split === "development"
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

    const resultPath = profileResultPath(split, profileId);
    await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n", "utf8");
    console.log(`===== ${profileId} / ${split} =====`);
    console.log(JSON.stringify(
      split === "development" ? compactDevelopmentResult(result) : aggregateOnly(result),
      null,
      2,
    ));

    if (queryErrorCount > 0) process.exitCode = 2;
  } finally {
    db.close();
    await rm(dbDir, { recursive: true, force: true });
  }
}

function selectWinner(results) {
  const baseline = results.find((item) => item.profileId === "baseline");
  if (!baseline) throw new Error("baseline result missing");
  const answerable = baseline.report.scoredAnswerableQueries;
  const materiality = {
    recallStep: 1 / answerable,
    mrrStep: 0.5 / answerable,
    coverageStep: 1 / answerable,
    rationale: "one answerable-query Recall/coverage change, or one Rank-2→Rank-1 equivalent MRR gain",
  };

  let winner = baseline;
  const decisions = [];
  for (const candidate of results.filter((item) => item.profileId !== "baseline")) {
    const delta = {
      recallAt10: candidate.report.recallAt10 - winner.report.recallAt10,
      mrr: candidate.report.mrr - winner.report.mrr,
      allRequiredEvidenceCoverage:
        candidate.report.allRequiredEvidenceCoverage - winner.report.allRequiredEvidenceCoverage,
    };
    const noQualityRegression = (
      delta.recallAt10 >= -EPSILON
      && delta.mrr >= -EPSILON
      && delta.allRequiredEvidenceCoverage >= -EPSILON
    );
    const materialImprovement = (
      delta.recallAt10 >= materiality.recallStep - EPSILON
      || delta.mrr >= materiality.mrrStep - EPSILON
      || delta.allRequiredEvidenceCoverage >= materiality.coverageStep - EPSILON
    );
    const selected = noQualityRegression && materialImprovement;
    decisions.push({
      candidateProfileId: candidate.profileId,
      comparedAgainst: winner.profileId,
      delta,
      noQualityRegression,
      materialImprovement,
      selected,
    });
    if (selected) winner = candidate;
  }

  return {
    winnerProfileId: winner.profileId,
    materiality,
    rule: "iterate fixed profiles from least to most complex; adopt a more complex profile only when it has no development quality regression and clears a dataset-sized material improvement threshold",
    decisions,
  };
}

function assertExpandedDevelopmentBaseline(result) {
  const expected = REFERENCE_EXPANDED_BASELINE.developmentRankDistribution;
  const actual = result.rankSummary;
  for (const key of ["answerableQueries", "rank1", "rank2", "rank3", "rank4To10", "miss"]) {
    if (actual[key] !== expected[key]) {
      throw new Error(`expanded development baseline drift: ${key} expected=${expected[key]} actual=${actual[key]}`);
    }
  }
  if (
    Math.abs(result.report.recallAt10 - 1) > EPSILON
    || Math.abs(result.report.allRequiredEvidenceCoverage - 1) > EPSILON
  ) {
    throw new Error("expanded development baseline quality drift");
  }
}

function aggregateOnly(result) {
  return {
    profileId: result.profileId,
    split: result.split,
    corpus: {
      totalChunks: result.corpus.totalChunks,
      challengeChunks: result.corpus.challengeChunks,
    },
    queryExecution: {
      queryCount: result.queryExecution.queryCount,
      topK: result.queryExecution.topK,
      errorCount: result.queryExecution.errorCount,
    },
    report: result.report,
    rankSummary: result.rankSummary,
    build: result.build,
    storage: {
      ftsIndexBytes: result.storage.ftsIndexBytes,
    },
  };
}

function compactDevelopmentResult(result) {
  return {
    profileId: result.profileId,
    report: result.report,
    rankSummary: result.rankSummary,
    developmentNonRank1: result.developmentNonRank1,
    build: result.build,
    storage: {
      ftsIndexBytes: result.storage.ftsIndexBytes,
    },
    queryErrors: result.queryExecution.errorCount,
  };
}

function renderMarkdown(evidence) {
  const lines = [
    "# P2-T05 lexical-normalization CI evidence",
    "",
    `Repository SHA: \`${evidence.repoSha}\``,
    "",
    "## Frozen expanded baseline reference",
    "",
    `- P2-T04 overall MRR: **${evidence.referenceExpandedBaseline.mrr}**`,
    `- P2-T04 Recall@10: **${evidence.referenceExpandedBaseline.recallAt10}**`,
    `- P2-T04 all-required coverage: **${evidence.referenceExpandedBaseline.allRequiredEvidenceCoverage}**`,
    "- Development baseline ranks: **37 Rank-1 / 4 Rank-2 / 1 Rank-3 / 0 miss**",
    "",
    "## Development profile comparison",
    "",
    "| profile | Recall@10 | MRR | all-required | Rank1 | Rank2 | Rank3 | miss | median ms | p95 ms | max ms | peak RSS | FTS bytes | build ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const item of evidence.development.profiles) {
    lines.push(
      `| \`${item.profileId}\` | ${item.report.recallAt10} | ${item.report.mrr} | ${item.report.allRequiredEvidenceCoverage} | ${item.rankSummary.rank1} | ${item.rankSummary.rank2} | ${item.rankSummary.rank3} | ${item.rankSummary.miss} | ${item.report.latencyMs.median} | ${item.report.latencyMs.p95} | ${item.report.latencyMs.max} | ${item.report.resources.peakRssBytes} | ${item.storage.ftsIndexBytes} | ${item.build.indexBuildMs} |`,
    );
  }
  lines.push(
    "",
    "### Development non-Rank-1 query ids",
    "",
  );
  for (const item of evidence.development.profiles) {
    const diagnostics = item.developmentNonRank1
      .map((entry) => `${entry.queryId}=Rank${entry.firstRelevantRank ?? "miss"}`)
      .join(", ");
    lines.push(`- \`${item.profileId}\`: ${diagnostics || "none"}`);
  }
  lines.push(
    "",
    "### Category failure counts",
    "",
  );
  for (const item of evidence.development.profiles) {
    lines.push(`- \`${item.profileId}\`: \`${JSON.stringify(item.report.categoryFailureCounts)}\``);
  }
  lines.push(
    "",
    "## Development-only selection",
    "",
    `Winner: **\`${evidence.development.winnerProfileId}\`**`,
    "",
    `Material MRR step: **${evidence.development.materiality.mrrStep}** (${evidence.development.materiality.rationale}).`,
    "",
    "The fixed profiles were evaluated in complexity order. Holdout was not executed until this winner was frozen.",
    "",
    "## One-shot holdout aggregate acceptance",
    "",
    `Profile: **\`${evidence.holdoutAcceptance.profileId}\`**`,
    `Queries: **${evidence.holdoutAcceptance.queryExecution.queryCount}**; errors: **${evidence.holdoutAcceptance.queryExecution.errorCount}**`,
    `Recall@10: **${evidence.holdoutAcceptance.report.recallAt10}**`,
    `MRR: **${evidence.holdoutAcceptance.report.mrr}**`,
    `all-required coverage: **${evidence.holdoutAcceptance.report.allRequiredEvidenceCoverage}**`,
    `Ranks: **${evidence.holdoutAcceptance.rankSummary.rank1} Rank-1 / ${evidence.holdoutAcceptance.rankSummary.rank2} Rank-2 / ${evidence.holdoutAcceptance.rankSummary.rank3} Rank-3 / ${evidence.holdoutAcceptance.rankSummary.rank4To10} Rank4-10 / ${evidence.holdoutAcceptance.rankSummary.miss} miss**`,
    "",
    "No holdout query ids, hit lists, or per-query ranks are emitted by this artifact.",
    "",
    "Runner latency/RSS are GitHub-runner-specific and are not Omarchy target-machine performance evidence.",
    "",
  );
  return lines.join("\n");
}

function seedWorkspace(db, workspaceId) {
  db.prepare("INSERT INTO installations (id, created_at) VALUES (?, ?)")
    .run("installation-p2", FIXED_NOW);
  db.prepare(`
    INSERT INTO knowledge_workspaces (
      id, installation_id, canonical_realpath, external_binding, created_at
    ) VALUES (?, ?, ?, NULL, ?)
  `).run(workspaceId, "installation-p2", `/p2/${workspaceId}`, FIXED_NOW);
}

function seedArtifact(db, workspaceId, index, record, sourceKind, byteLength, actualHash, canonical) {
  const sourceId = `source-p2-${index + 1}`;
  db.prepare(`
    INSERT INTO sources (
      id, knowledge_workspace_id, kind, display_name, archived_at, created_at
    ) VALUES (?, ?, ?, ?, NULL, ?)
  `).run(sourceId, workspaceId, sourceKind, record.source.title, FIXED_NOW);
  db.prepare(`
    INSERT INTO source_versions (
      id, source_id, content_sha256, blob_key, byte_length, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    record.parsedArtifact.sourceVersionId,
    sourceId,
    actualHash,
    actualHash,
    byteLength,
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
}

function assertCanonicalIdentity(record, canonical) {
  if (canonical.canonicalTextSha256 !== record.parsedArtifact.canonicalTextSha256) {
    throw new Error(`canonical hash mismatch: ${record.id}`);
  }
  if (canonical.parserFingerprint !== record.parsedArtifact.parserFingerprint) {
    throw new Error(`parser fingerprint mismatch: ${record.id}`);
  }
  if (canonical.normalizationFingerprint !== record.parsedArtifact.normalizationFingerprint) {
    throw new Error(`normalization fingerprint mismatch: ${record.id}`);
  }
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
    && hit.locator.parsedArtifactId === label.parsedArtifactId
    && hit.locator.startByte < label.endByte
    && hit.locator.endByte > label.startByte;
}

async function readCorpusRecord(name) {
  return JSON.parse(
    await readFile(path.resolve(repoRoot, "eval", "corpus", `${name}.meta.json`), "utf8"),
  );
}

async function readJsonLines(relativePath) {
  const raw = await readFile(path.resolve(repoRoot, relativePath), "utf8");
  return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function readResult(split, profileId) {
  return JSON.parse(await readFile(profileResultPath(split, profileId), "utf8"));
}

function profileResultPath(split, profileId) {
  return path.join(outDir, `${split}-${profileId}.json`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function parseArgs(argv) {
  const result = { child: false, profile: undefined, split: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--child") result.child = true;
    if (arg === "--profile") result.profile = argv[index + 1];
    if (arg === "--split") result.split = argv[index + 1];
  }
  return result;
}
