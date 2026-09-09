#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { release } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { validateGoldenDataset } from "../src/knowledge/eval/goldenDataset.ts";
import {
  buildDirectFilePiTasks,
  evaluateDirectFilePiBaseline,
} from "../src/knowledge/eval/directFilePiBaseline.ts";

const CORPUS_RECORDS = [
  "vue-reactivity-core-zh",
  "node-fspromises-cp-v16.7.0",
  "node-fspromises-cp-v22.3.0",
  "challenge-vue-reactivity-neighbors",
  "challenge-node-fspromises-neighbors-a",
  "challenge-node-fspromises-neighbors-b",
];
const EXPECTED_DEVELOPMENT_QUERIES = 50;
const EXPECTED_DATASET_HASH = "949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3";
const DEFAULT_TIMEOUT_MS = 180_000;
const SYSTEM_PROMPT = `You are executing a frozen direct-file evidence baseline.
Use only the files supplied with the current user message. Do not use external knowledge.
Return exactly one JSON object and nothing else, with this schema:
{"answer":"string","insufficientEvidence":false,"citations":[{"path":"eval/corpus/example.md","exactQuote":"verbatim contiguous quote from that file"}]}
For every citation, path must be exactly one of the supplied eval/corpus/... paths and exactQuote must be a verbatim contiguous substring of that file.
Cite all evidence needed for the answer, including distinct sources when the question depends on multiple or conflicting/versioned facts.
Preserve source/version distinctions. Never invent a citation.
If the supplied files do not contain enough evidence, set insufficientEvidence=true and citations=[] and state the limitation in answer.`;

const repoRoot = path.resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const prepareOnly = args.has("--prepare-only");
for (const arg of args) {
  if (arg !== "--prepare-only") throw new Error(`Unknown argument: ${arg}`);
}

const outDir = path.resolve(
  process.env.P2_T10_EVIDENCE_OUT_DIR ?? "/tmp/pi-knowledge-p2-evidence/p2-t10",
);
const timeoutMs = parsePositiveInteger(
  process.env.P2_T10_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  "P2_T10_TIMEOUT_MS",
);
const piBin = process.env.P2_T10_PI_BIN?.trim() || "pi";
const providerOverride = process.env.P2_T10_PROVIDER?.trim() || null;
const modelOverride = process.env.P2_T10_MODEL?.trim() || null;

await rm(outDir, { recursive: true, force: true });
await mkdir(path.join(outDir, "raw"), { recursive: true });

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

if (development.length !== EXPECTED_DEVELOPMENT_QUERIES) {
  throw new Error(
    `Frozen development query count drifted: expected ${String(EXPECTED_DEVELOPMENT_QUERIES)}, got ${String(development.length)}`,
  );
}

const datasetFiles = [
  ...CORPUS_RECORDS.flatMap((name) => [
    `eval/corpus/${name}.md`,
    `eval/corpus/${name}.meta.json`,
  ]),
  "eval/queries/development.jsonl",
  "eval/labels/development.jsonl",
];
const datasetHash = await hashFiles(datasetFiles);
if (datasetHash !== EXPECTED_DATASET_HASH) {
  throw new Error(`Frozen development dataset hash drifted: ${datasetHash}`);
}

await verifyCorpusBytes(corpus);
const tasks = buildDirectFilePiTasks(dataset, "development");
if (tasks.length !== EXPECTED_DEVELOPMENT_QUERIES) {
  throw new Error(`Direct-file task count mismatch: ${String(tasks.length)}`);
}
const expectedTaskPaths = corpus
  .map((record) => record.relativePath)
  .sort((left, right) => left.localeCompare(right));
for (const task of tasks) {
  const taskPaths = task.files.map((file) => file.relativePath);
  if (JSON.stringify(taskPaths) !== JSON.stringify(expectedTaskPaths)) {
    throw new Error(`Direct-file task corpus drift: ${task.queryId}`);
  }
}

const repoSha = git(["rev-parse", "HEAD"]);
const systemPromptHash = sha256(Buffer.from(SYSTEM_PROMPT, "utf8"));
const taskManifest = {
  schemaVersion: 1,
  split: "development",
  queryCount: tasks.length,
  datasetHash,
  files: expectedTaskPaths.map((relativePath) => `eval/${relativePath}`),
  queryIds: tasks.map((task) => task.queryId),
  modelFacingFields: ["queryId", "query", "split", "files"],
  goldenLabelsModelFacing: false,
  systemPromptSha256: systemPromptHash,
};
await writeJson(path.join(outDir, "task-manifest-development.json"), taskManifest);
await writeFile(
  path.join(outDir, "human-review-development.md"),
  renderHumanReviewWorksheet(tasks),
  "utf8",
);

if (prepareOnly) {
  const prepared = {
    schemaVersion: 1,
    status: "PREPARED_ONLY",
    repoSha,
    datasetHash,
    queryCount: tasks.length,
    systemPromptSha256: systemPromptHash,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    osRelease: release(),
    outDir,
  };
  await writeJson(path.join(outDir, "prepare-provenance.json"), prepared);
  console.log("===== P2-T10 DIRECT-FILE PI PREPARE-ONLY PASS =====");
  console.log(JSON.stringify(prepared, null, 2));
  process.exit(0);
}

const piVersion = readPiVersion(piBin);
const observations = [];
const answerRecords = [];
let frozenRuntimeIdentity = null;

for (let index = 0; index < tasks.length; index += 1) {
  const task = tasks[index];
  console.log(`[P2-T10 ${String(index + 1)}/${String(tasks.length)}] ${task.queryId}`);

  const fileArgs = task.files.map((file) => `@eval/${file.relativePath}`);
  const prompt = `Answer this frozen evaluation query using only the supplied files.\n\nQuery: ${task.query}`;
  const piArgs = [
    "--mode", "json",
    "--no-session",
    "--no-tools",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
    "--no-approve",
    "--system-prompt", SYSTEM_PROMPT,
  ];
  if (providerOverride !== null) piArgs.push("--provider", providerOverride);
  if (modelOverride !== null) piArgs.push("--model", modelOverride);
  piArgs.push(...fileArgs, prompt);

  const started = performance.now();
  const execution = await runProcess(piBin, piArgs, timeoutMs);
  const latencyMs = performance.now() - started;
  const rawPath = path.join(outDir, "raw", `${task.queryId}.jsonl`);
  await writeFile(rawPath, execution.stdout, "utf8");
  if (execution.stderr.trim().length > 0) {
    await writeFile(path.join(outDir, "raw", `${task.queryId}.stderr.txt`), execution.stderr, "utf8");
  }
  if (execution.code !== 0) {
    throw new Error(`Pi failed for ${task.queryId} with exit code ${String(execution.code)}; see ${rawPath}`);
  }

  const finalMessage = parseFinalAssistantMessage(execution.stdout, task.queryId);
  const runtimeIdentity = normalizeRuntimeIdentity(finalMessage);
  if (frozenRuntimeIdentity === null) frozenRuntimeIdentity = runtimeIdentity;
  else assertSameRuntimeIdentity(frozenRuntimeIdentity, runtimeIdentity, task.queryId);

  const responseText = assistantText(finalMessage);
  const parsed = parseModelResult(responseText, task.queryId);
  const mapped = await mapCitations(task, parsed.citations);
  observations.push({
    queryId: task.queryId,
    latencyMs,
    insufficientEvidence: parsed.insufficientEvidence,
    citations: mapped.citations,
    unmappedCitationCount: mapped.unmapped.length,
  });
  answerRecords.push({
    schemaVersion: 1,
    queryId: task.queryId,
    query: task.query,
    categories: development.find((query) => query.id === task.queryId)?.categories ?? [],
    answer: parsed.answer,
    insufficientEvidence: parsed.insufficientEvidence,
    requestedCitations: parsed.citations,
    mappedCitations: mapped.citations,
    unmappedCitations: mapped.unmapped,
    latencyMs,
    runtime: runtimeIdentity,
  });
}

if (frozenRuntimeIdentity === null) throw new Error("No Pi runtime identity was recorded");
const report = evaluateDirectFilePiBaseline(dataset, "development", observations);
const generatedAt = new Date().toISOString();
const provenance = {
  schemaVersion: 1,
  benchmark: "p2-t10-direct-file-pi-baseline",
  split: "development",
  generatedAt,
  repoSha,
  datasetHash,
  datasetFiles,
  queryCount: tasks.length,
  piVersion,
  piBinary: piBin,
  runtime: frozenRuntimeIdentity,
  providerOverride,
  modelOverride,
  systemPromptSha256: systemPromptHash,
  invocationPolicy: {
    session: "ephemeral",
    tools: false,
    extensions: false,
    skills: false,
    promptTemplates: false,
    themes: false,
    contextFiles: false,
    projectTrust: "no-approve",
    filePresentation: "@eval/<Golden corpus relativePath>",
  },
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  osRelease: release(),
  report,
};

await writeJson(path.join(outDir, "direct-file-pi-development.json"), provenance);
await writeJson(path.join(outDir, "observations-development.json"), observations);
await writeFile(
  path.join(outDir, "answers-development.jsonl"),
  `${answerRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
  "utf8",
);
await writeFile(
  path.join(outDir, "human-review-development.md"),
  renderHumanReviewWorksheet(tasks, answerRecords),
  "utf8",
);

console.log("===== P2-T10 DIRECT-FILE PI DEVELOPMENT RESULT =====");
console.log(JSON.stringify({
  repoSha,
  datasetHash,
  queryCount: tasks.length,
  piVersion,
  runtime: frozenRuntimeIdentity,
  report,
  outDir,
}, null, 2));
console.log("Human semantic review remains required: human-review-development.md");

async function readCorpusRecord(name) {
  const metadataPath = path.resolve(repoRoot, "eval", "corpus", `${name}.meta.json`);
  return JSON.parse(await readFile(metadataPath, "utf8"));
}

async function readJsonLines(relativePath) {
  const raw = await readFile(path.resolve(repoRoot, relativePath), "utf8");
  return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function verifyCorpusBytes(records) {
  for (const record of records) {
    const actualPath = path.resolve(repoRoot, "eval", record.relativePath);
    const bytes = await readFile(actualPath);
    const actualHash = sha256(bytes);
    if (actualHash !== record.parsedArtifact.canonicalTextSha256) {
      throw new Error(`Corpus bytes do not match frozen metadata: ${record.relativePath}`);
    }
  }
}

async function mapCitations(task, requestedCitations) {
  const allowed = new Map(task.files.map((file) => [file.relativePath, file]));
  const citations = [];
  const unmapped = [];

  for (const requested of requestedCitations) {
    const normalizedPath = normalizeCitationPath(requested.path);
    const file = allowed.get(normalizedPath);
    if (file === undefined) {
      unmapped.push({ ...requested, reason: "path-not-in-frozen-task" });
      continue;
    }
    if (requested.exactQuote.length === 0) {
      unmapped.push({ ...requested, reason: "empty-quote" });
      continue;
    }

    const bytes = await readFile(path.resolve(repoRoot, "eval", normalizedPath));
    const text = bytes.toString("utf8");
    const first = text.indexOf(requested.exactQuote);
    if (first < 0) {
      unmapped.push({ ...requested, reason: "quote-not-found" });
      continue;
    }
    const second = text.indexOf(requested.exactQuote, first + requested.exactQuote.length);
    if (second >= 0) {
      unmapped.push({ ...requested, reason: "quote-ambiguous" });
      continue;
    }

    const startByte = Buffer.byteLength(text.slice(0, first), "utf8");
    const endByte = startByte + Buffer.byteLength(requested.exactQuote, "utf8");
    citations.push({
      sourceVersionId: file.sourceVersionId,
      parsedArtifactId: file.parsedArtifactId,
      startByte,
      endByte,
    });
  }

  return { citations, unmapped };
}

function normalizeCitationPath(value) {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  return normalized.startsWith("eval/") ? normalized.slice("eval/".length) : normalized;
}

function parseFinalAssistantMessage(stdout, queryId) {
  let finalMessage = null;
  for (const line of stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event?.type !== "message_end") continue;
    const message = event.message ?? event.data?.message ?? null;
    if (message?.role === "assistant") finalMessage = message;
  }
  if (finalMessage === null) throw new Error(`No authoritative assistant message_end for ${queryId}`);
  return finalMessage;
}

function assistantText(message) {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function parseModelResult(text, queryId) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error(`Pi response is not a JSON object for ${queryId}`);
  }
  let value;
  try {
    value = JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    throw new Error(`Pi response JSON parse failed for ${queryId}: ${String(error)}`);
  }
  if (typeof value?.answer !== "string" || typeof value?.insufficientEvidence !== "boolean" || !Array.isArray(value?.citations)) {
    throw new Error(`Pi response has invalid result schema for ${queryId}`);
  }
  const citations = value.citations.map((citation, index) => {
    if (typeof citation?.path !== "string" || typeof citation?.exactQuote !== "string") {
      throw new Error(`Pi response citation ${String(index)} has invalid schema for ${queryId}`);
    }
    return { path: citation.path, exactQuote: citation.exactQuote };
  });
  if (value.insufficientEvidence && citations.length > 0) {
    throw new Error(`Pi marked insufficient evidence but emitted citations for ${queryId}`);
  }
  return { answer: value.answer, insufficientEvidence: value.insufficientEvidence, citations };
}

function normalizeRuntimeIdentity(message) {
  const provider = stringOrNull(message.provider);
  const model = stringOrNull(message.model);
  const responseModel = stringOrNull(message.responseModel);
  const api = stringOrNull(message.api);
  const thinkingLevel = stringOrNull(message.providerThinkingLevel);
  if (provider === null || model === null) {
    throw new Error("Pi final assistant message does not expose provider/model identity");
  }
  return { provider, model, responseModel, api, thinkingLevel };
}

function assertSameRuntimeIdentity(expected, actual, queryId) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `Pi runtime identity drifted at ${queryId}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readPiVersion(binary) {
  const result = spawnSync(binary, ["--version"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: evidenceEnvironment(),
  });
  if (result.error !== undefined) {
    throw new Error(`Unable to execute ${binary}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${binary} --version failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function runProcess(binary, processArgs, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, processArgs, {
      cwd: repoRoot,
      env: evidenceEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeout);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal !== null) {
        resolve({ code: code ?? 1, signal, stdout, stderr: `${stderr}\nterminated by ${signal}` });
        return;
      }
      resolve({ code: code ?? 1, signal: null, stdout, stderr });
    });
  });
}

function evidenceEnvironment() {
  return {
    ...process.env,
    PI_SKIP_VERSION_CHECK: "1",
    PI_TELEMETRY: "0",
  };
}

function git(gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${gitArgs.join(" ")} failed`);
  return result.stdout.trim();
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

async function writeJson(targetPath, value) {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parsePositiveInteger(raw, fallback, label) {
  if (raw === undefined || raw.trim().length === 0) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

function renderHumanReviewWorksheet(tasksToReview, answers = []) {
  const answerById = new Map(answers.map((answer) => [answer.queryId, answer]));
  const lines = [
    "# P2-T10 human answer-quality review — development",
    "",
    "Reviewer must be independent of the model under test. Read `answers-development.jsonl` and the fixed source files before scoring.",
    "",
    "Allowed correctness values: `correct`, `partially correct`, `incorrect`.",
    "",
    "| Query | Categories | Model result | Correctness | Unsupported claims | Version/conflict mistakes | Important evidence omitted | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const task of tasksToReview) {
    const query = development.find((candidate) => candidate.id === task.queryId);
    const answer = answerById.get(task.queryId);
    const modelResult = answer === undefined
      ? "PENDING"
      : `mapped=${String(answer.mappedCitations.length)}, unmapped=${String(answer.unmappedCitations.length)}, abstain=${String(answer.insufficientEvidence)}`;
    lines.push(
      `| ${escapeTable(task.queryId)} | ${escapeTable((query?.categories ?? []).join(", "))} | ${escapeTable(modelResult)} |  |  |  |  |  |`,
    );
  }
  lines.push(
    "",
    "## Review completion record",
    "",
    "- Reviewer: ",
    "- Reviewed at: ",
    "- Correct: ",
    "- Partially correct: ",
    "- Incorrect: ",
    "- Answers with unsupported claims: ",
    "- Version/conflict mistakes: ",
    "- No-answer hallucinations: ",
    "- Evidence omissions: ",
    "",
  );
  return lines.join("\n");
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}
