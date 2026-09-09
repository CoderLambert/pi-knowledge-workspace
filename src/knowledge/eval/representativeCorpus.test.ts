import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  validateGoldenDataset,
  type GoldenCorpusArtifact,
} from "./goldenDataset.js";

const RECORDS = [
  "vue-reactivity-core-zh",
  "node-fspromises-cp-v16.7.0",
  "node-fspromises-cp-v22.3.0",
] as const;

describe("P2-T02 representative corpus", () => {
  it("keeps captured metadata, canonical hashes and representative coverage aligned", async () => {
    const corpus = await Promise.all(RECORDS.map(readCorpusRecord));
    validateGoldenDataset({ schemaVersion: 1, corpus, queries: [], labels: [] });

    const byId = new Map(corpus.map((record) => [record.id, record]));
    const vue = byId.get("corpus-vue-reactivity-core-zh-20260907");
    const node16 = byId.get("corpus-node-fspromises-cp-v16-7-0");
    const node22 = byId.get("corpus-node-fspromises-cp-v22-3-0");
    if (!vue || !node16 || !node22) throw new Error("Representative corpus records are incomplete");

    expect(vue.language).toBe("zh");
    expect(node16.language).toBe("en");
    expect(node22.language).toBe("en");
    expect(node16.source.version).toBe("tag:v16.7.0");
    expect(node22.source.version).toBe("tag:v22.3.0");
    expect(node16.parsedArtifact.sourceVersionId).not.toBe(node22.parsedArtifact.sourceVersionId);

    const vueText = await readSnapshot(vue);
    const node16Text = await readSnapshot(node16);
    const node22Text = await readSnapshot(node22);

    expect(vueText).toContain("function ref<T>");
    expect(vueText).toContain("响应式");
    expect(node16Text).toContain("fsPromises.cp");
    expect(node16Text).toContain("Stability: 1 - Experimental");
    expect(node22Text).toContain("fsPromises.cp");
    expect(node22Text).toContain("no longer experimental");

    // This intentionally absent option is a real no-answer candidate for P2-T03.
    expect(node16Text).not.toContain("preserveOwnership");
    expect(node22Text).not.toContain("preserveOwnership");
  });
});

async function readCorpusRecord(name: string): Promise<GoldenCorpusArtifact> {
  const metadataPath = path.resolve("eval", "corpus", `${name}.meta.json`);
  const raw = await readFile(metadataPath, "utf8");
  const record = JSON.parse(raw) as GoldenCorpusArtifact;
  const bytes = await readFile(path.resolve("eval", record.relativePath));
  const hash = createHash("sha256").update(bytes).digest("hex");
  expect(hash).toBe(record.parsedArtifact.canonicalTextSha256);
  return record;
}

async function readSnapshot(record: GoldenCorpusArtifact): Promise<string> {
  return readFile(path.resolve("eval", record.relativePath), "utf8");
}
