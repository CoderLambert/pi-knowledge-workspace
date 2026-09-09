#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const FROZEN_BASE = "origin/experiment/p2-direct-file-pi-baseline";
const FROZEN_REPO_SHA = "10219b81981056c9c827a4b28e1839a6cc8a5f34";
const DATASET_HASH = "949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3";
const PRODUCT_COMMIT = "35c58d89907e675a8c4fb10544c19be0f050f611";
const LLM = {
  name: "qwen3.5:9b-q8_0",
  digest: "441ec31e4d2aedceb97dd834b036db104d943fbe3dbc1e5c8ac95eeaa9141c77",
};
const EMBEDDING = {
  name: "bge-m3:latest",
  digest: "7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab",
};
const CORPUS = [
  "vue-reactivity-core-zh.md",
  "node-fspromises-cp-v16.7.0.md",
  "node-fspromises-cp-v22.3.0.md",
  "challenge-vue-reactivity-neighbors.md",
  "challenge-node-fspromises-neighbors-a.md",
  "challenge-node-fspromises-neighbors-b.md",
];

const args = new Set(process.argv.slice(2));
for (const arg of args) if (arg !== "--check-only") throw new Error(`Unknown option: ${arg}`);

const repoRoot = git(["rev-parse", "--show-toplevel"]);
const productRoot = path.resolve(
  process.env.P2_T11_ANYTHINGLLM_ROOT ?? path.join(os.homedir(), "p2-t11-lab/anything-llm-v1.16.1"),
);
const envPath = path.resolve(
  process.env.P2_T11_ANYTHINGLLM_ENV ?? path.join(productRoot, "docker", ".env"),
);
const outDir = path.resolve(
  process.env.P2_T11_EVIDENCE_OUT_DIR ?? path.join(os.homedir(), "p2-t11-lab/evidence/anythingllm"),
);
const baseUrl = (process.env.P2_T11_ANYTHINGLLM_URL ?? "http://127.0.0.1:3001").replace(/\/$/u, "");
const ollamaUrl = (process.env.P2_T11_OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/u, "");
const workspaceSlug = process.env.P2_T11_ANYTHINGLLM_WORKSPACE ?? "p2-t11-anythingllm";
const timeoutMs = Number.parseInt(process.env.P2_T11_QUERY_TIMEOUT_MS ?? "180000", 10);
const finalPath = path.join(outDir, "anythingllm-development.json");
const jsonlPath = path.join(outDir, "anythingllm-development.jsonl");

const queryRaw = git(["show", `${FROZEN_BASE}:eval/queries/development.jsonl`]);
const queries = queryRaw
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
assertQueries(queries);

if (args.has("--check-only")) {
  console.log(JSON.stringify({ status: "PASS", frozenRepoSha: FROZEN_REPO_SHA, datasetHash: DATASET_HASH, queryCount: 50 }, null, 2));
  process.exit(0);
}

await mkdir(outDir, { recursive: true });
if (await exists(finalPath)) {
  throw new Error(`${finalPath} already exists; preserve the first formal run instead of silently overwriting it.`);
}

const productCommit = git(["rev-parse", "HEAD"], productRoot);
const productTag = git(["describe", "--tags", "--always"], productRoot);
if (productCommit !== PRODUCT_COMMIT) {
  throw new Error(`AnythingLLM commit drift: expected ${PRODUCT_COMMIT}, got ${productCommit}`);
}

const ollamaTags = await request(`${ollamaUrl}/api/tags`, { timeoutMs: 15_000 });
const llm = freezeOllamaModel(ollamaTags, LLM);
const embedding = freezeOllamaModel(ollamaTags, EMBEDDING);

const authToken = await envValue(envPath, "AUTH_TOKEN");
if (!authToken) throw new Error(`AUTH_TOKEN not found in ${envPath}`);
const login = await request(`${baseUrl}/api/request-token`, {
  method: "POST",
  body: { password: authToken },
  timeoutMs: 15_000,
});
if (!login?.token) throw new Error("AnythingLLM login returned no session token");

const keyResponse = await request(`${baseUrl}/api/system/generate-api-key`, {
  method: "POST",
  bearer: login.token,
  body: { name: `p2-t11-50q-${new Date().toISOString()}` },
  timeoutMs: 15_000,
});
const apiKey = keyResponse?.apiKey?.secret ?? keyResponse?.apiKey ?? keyResponse?.secret;
if (typeof apiKey !== "string" || !apiKey) throw new Error("AnythingLLM API-key generation returned no secret");

const workspaceResponse = await request(`${baseUrl}/api/v1/workspace/${encodeURIComponent(workspaceSlug)}`, {
  bearer: apiKey,
  timeoutMs: 15_000,
});
const workspace = Array.isArray(workspaceResponse?.workspace)
  ? workspaceResponse.workspace[0]
  : workspaceResponse?.workspace;
assertWorkspace(workspace);

const runId = randomUUID();
const records = [];
const startedAt = new Date().toISOString();
for (let index = 0; index < queries.length; index += 1) {
  const query = queries[index];
  const sessionId = `p2-t11-${runId}-${query.id}`;
  process.stdout.write(`[P2-T11 ${index + 1}/50] ${query.id} ... `);
  const started = performance.now();
  let rawResponse = null;
  let runnerError = null;
  try {
    rawResponse = await request(`${baseUrl}/api/v1/workspace/${encodeURIComponent(workspaceSlug)}/chat`, {
      method: "POST",
      bearer: apiKey,
      body: { message: query.text, mode: "query", sessionId },
      timeoutMs,
    });
  } catch (error) {
    runnerError = String(error?.stack ?? error);
  }
  const latencyMs = performance.now() - started;
  const sources = Array.isArray(rawResponse?.sources) ? rawResponse.sources : [];
  records.push({
    schemaVersion: 1,
    queryId: query.id,
    query: query.text,
    categories: query.categories ?? [],
    split: query.split,
    sessionId,
    latencyMs,
    answer: textResponse(rawResponse),
    sourceCount: sources.length,
    sources,
    responseType: rawResponse?.type ?? null,
    responseError: rawResponse?.error ?? null,
    metrics: rawResponse?.metrics ?? null,
    rawResponse,
    runnerError,
  });
  await writeFile(jsonlPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  console.log(runnerError ? "ERROR" : `${latencyMs.toFixed(0)} ms / ${sources.length} source(s)`);
}

const failures = records.filter((record) => record.runnerError || record.responseError);
const successfulLatencies = records.filter((record) => !record.runnerError).map((record) => record.latencyMs);
const evidence = {
  schemaVersion: 1,
  benchmark: "p2-t11-anythingllm-development",
  status: failures.length === 0 ? "COMPLETE" : "PARTIAL",
  runId,
  startedAt,
  finishedAt: new Date().toISOString(),
  repo: { frozenRepoSha: FROZEN_REPO_SHA, datasetHash: DATASET_HASH, split: "development", queryCount: 50 },
  product: {
    name: "AnythingLLM",
    tag: "v1.16.1",
    commit: productCommit,
    describe: productTag,
    workspaceSlug,
    chatMode: "query",
    vectorDb: "LanceDB",
    workspaceSnapshot: redact(workspace),
  },
  models: { llm, embedding },
  isolation: {
    requestMode: "query",
    uniqueApiSessionPerQuery: true,
    concurrency: 1,
    note: "AnythingLLM documents query mode as not recalling chat history; each request also gets a unique API sessionId.",
  },
  runtime: { node: process.version, platform: `${process.platform}/${process.arch}`, osRelease: os.release(), queryTimeoutMs: timeoutMs },
  summary: {
    completedQueries: 50 - failures.length,
    failedQueries: failures.length,
    queriesWithSources: records.filter((record) => record.sourceCount > 0).length,
    totalReturnedSources: records.reduce((sum, record) => sum + record.sourceCount, 0),
    latencyMs: latencySummary(successfulLatencies),
  },
  records,
};
await writeFile(finalPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
const digest = createHash("sha256").update(await readFile(finalPath)).digest("hex");
console.log("\n===== P2-T11 ANYTHINGLLM DEVELOPMENT RESULT =====");
console.log(JSON.stringify({
  status: evidence.status,
  runId,
  queryCount: 50,
  failedQueries: failures.length,
  queriesWithSources: evidence.summary.queriesWithSources,
  latencyMs: evidence.summary.latencyMs,
  output: finalPath,
  jsonl: jsonlPath,
  sha256: digest,
}, null, 2));
if (failures.length) process.exitCode = 2;

function git(args, cwd = process.cwd()) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function assertQueries(items) {
  if (items.length !== 50) throw new Error(`Expected 50 frozen development queries, got ${items.length}`);
  items.forEach((item, index) => {
    const id = `dev-${String(index + 1).padStart(3, "0")}`;
    if (item.id !== id || item.split !== "development") throw new Error(`Query drift at ${id}`);
  });
}

function assertWorkspace(value) {
  if (!value) throw new Error(`Workspace ${workspaceSlug} not found`);
  const documents = Array.isArray(value.documents) ? value.documents : [];
  if (documents.length !== 6) throw new Error(`Workspace ${workspaceSlug} must contain exactly 6 documents; got ${documents.length}`);
  const serialized = JSON.stringify(documents);
  for (const filename of CORPUS) {
    if (!serialized.includes(filename)) throw new Error(`Workspace ${workspaceSlug} is missing ${filename}`);
  }
}

function freezeOllamaModel(tags, expected) {
  const models = Array.isArray(tags?.models) ? tags.models : [];
  const found = models.find((model) => model?.name === expected.name || model?.model === expected.name);
  if (!found) throw new Error(`Ollama model missing: ${expected.name}`);
  if (found.digest !== expected.digest) throw new Error(`Ollama digest drift for ${expected.name}`);
  return { name: expected.name, digest: found.digest, size: found.size ?? null, details: found.details ?? null, capabilities: found.capabilities ?? null };
}

async function envValue(filename, key) {
  const raw = await readFile(filename, "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/u);
    if (!match || match[1] !== key) continue;
    const value = match[2];
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) return value.slice(1, -1);
    return value;
  }
  return null;
}

async function request(url, { method = "GET", bearer, body, timeoutMs: requestTimeout = 30_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeout);
  try {
    const headers = { Accept: "application/json" };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    const text = await response.text();
    let parsed = null;
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = { nonJsonBody: text }; }
    }
    if (!response.ok) throw new Error(`${method} ${url} -> HTTP ${response.status}: ${text.slice(0, 1000)}`);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function textResponse(response) {
  for (const candidate of [response?.textResponse, response?.text, response?.response]) if (typeof candidate === "string") return candidate;
  return null;
}

function redact(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => (/token|secret|password|api.?key/iu.test(key) ? "<redacted>" : item)));
}

function latencySummary(values) {
  if (!values.length) return { median: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  return { median: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), max: sorted.at(-1) };
}

function percentile(sorted, p) {
  const rank = (sorted.length - 1) * p;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

async function exists(filename) {
  try { await stat(filename); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}
