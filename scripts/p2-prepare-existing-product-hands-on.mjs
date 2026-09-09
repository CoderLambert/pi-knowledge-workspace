#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve(process.env.P2_T11_EVIDENCE_OUT_DIR ?? "/tmp/pi-knowledge-p2-evidence/p2-t11");
const products = [
  {
    id: "anythingllm",
    repo: "https://github.com/Mintplex-Labs/anything-llm.git",
    rawRepo: "Mintplex-Labs/anything-llm",
    tag: "v1.16.1",
    commit: "35c58d89907e675a8c4fb10544c19be0f050f611",
    image: "ghcr.io/mintplex-labs/anything-llm:1.16.1",
    files: {
      system: "server/endpoints/system.js",
      workspace: "server/endpoints/api/workspace/index.js",
      document: "server/endpoints/api/document/index.js",
      dockerfile: "docker/Dockerfile",
    },
    assertions: [
      ["system", "app.post(\"/request-token\""],
      ["system", "\"/system/generate-api-key\""],
      ["workspace", "\"/v1/workspace/new\""],
      ["workspace", "\"/v1/workspace/:slug/chat\""],
      ["workspace", "\"/v1/workspace/:slug/update-embeddings\""],
      ["document", "\"/v1/document/upload\""],
    ],
  },
  {
    id: "open-webui",
    repo: "https://github.com/open-webui/open-webui.git",
    rawRepo: "open-webui/open-webui",
    tag: "v0.11.3",
    commit: "2a960a59fe1dbbd35282f0556b3666d81102e781",
    image: "ghcr.io/open-webui/open-webui:v0.11.3",
    files: {
      knowledge: "backend/open_webui/routers/knowledge.py",
      files: "backend/open_webui/routers/files.py",
    },
    assertions: [
      ["knowledge", "@router.post('/create'"],
      ["knowledge", "@router.post('/{id}/file/add'"],
      ["files", "@router.post('/', response_model=FileModelResponse)"],
    ],
  },
];

if (process.argv.slice(2).some((arg) => arg !== "--contracts-only")) {
  throw new Error("Supported option: --contracts-only");
}

await mkdir(outDir, { recursive: true });
const evidence = {
  schemaVersion: 1,
  mode: "contracts-only",
  generatedAt: new Date().toISOString(),
  runner: `${process.platform}/${process.arch}`,
  products: {},
};

for (const product of products) {
  const remote = execFileSync("git", ["ls-remote", "--refs", product.repo, `refs/tags/${product.tag}`], { encoding: "utf8" }).trim();
  const resolvedCommit = remote.split(/\s+/u)[0] ?? "";
  if (resolvedCommit !== product.commit) {
    throw new Error(`${product.id} tag drift: expected ${product.commit}, got ${resolvedCommit || "missing"}`);
  }

  const fetched = {};
  for (const [key, filePath] of Object.entries(product.files)) {
    const url = `https://raw.githubusercontent.com/${product.rawRepo}/${product.commit}/${filePath}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${product.id} failed to fetch ${filePath}: ${response.status}`);
    const content = await response.text();
    fetched[key] = {
      path: filePath,
      sha256: sha256(content),
      content,
    };
  }

  const contractChecks = product.assertions.map(([fileKey, needle]) => {
    const pass = fetched[fileKey]?.content.includes(needle) === true;
    if (!pass) throw new Error(`${product.id} contract missing ${needle} in ${String(fileKey)}`);
    return { file: fetched[fileKey].path, needle, pass };
  });

  const inspect = execFileSync("docker", ["buildx", "imagetools", "inspect", product.image], { encoding: "utf8" });
  const imageDigest = inspect.match(/^Digest:\s+(sha256:[a-f0-9]+)$/mu)?.[1] ?? null;
  if (imageDigest === null) throw new Error(`Could not resolve digest for ${product.image}`);

  evidence.products[product.id] = {
    tag: product.tag,
    commit: product.commit,
    image: product.image,
    imageDigest,
    sourceFiles: Object.fromEntries(Object.entries(fetched).map(([key, value]) => [key, { path: value.path, sha256: value.sha256 }])),
    contractChecks,
  };
}

const output = path.join(outDir, "existing-product-contracts.json");
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", output, products: evidence.products }, null, 2));

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
