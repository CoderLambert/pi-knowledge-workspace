import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { chunkParsedArtifact } from "../storage/chunker.js";
import { canonicalizeParsedArtifact } from "../storage/parsedArtifact.js";
import {
  validateGoldenDataset,
  type GoldenCorpusArtifact,
  type GoldenEvidenceLabel,
} from "./goldenDataset.js";

const ORIGINAL_RECORDS = [
  "vue-reactivity-core-zh",
  "node-fspromises-cp-v16.7.0",
  "node-fspromises-cp-v22.3.0",
] as const;

const CHALLENGE_RECORDS = [
  "challenge-vue-reactivity-neighbors",
  "challenge-node-fspromises-neighbors-a",
  "challenge-node-fspromises-neighbors-b",
] as const;

async function readCorpusRecord(name: string): Promise<GoldenCorpusArtifact> {
  const raw = await readFile(path.resolve("eval", "corpus", `${name}.meta.json`), "utf8");
  return JSON.parse(raw) as GoldenCorpusArtifact;
}

async function readJsonLines<T>(relativePath: string): Promise<T[]> {
  const raw = await readFile(path.resolve(relativePath), "utf8");
  return raw.trim().split("\n").map((line) => JSON.parse(line) as T);
}

describe("P2-T03A development retrieval challenge corpus", () => {
  it("adds immutable hard-negative artifacts without changing the original corpus contract", async () => {
    const original = await Promise.all(ORIGINAL_RECORDS.map(readCorpusRecord));
    const challenge = await Promise.all(CHALLENGE_RECORDS.map(readCorpusRecord));
    const corpus = [...original, ...challenge];

    validateGoldenDataset({ schemaVersion: 1, corpus, queries: [], labels: [] });

    expect(new Set(corpus.map((record) => record.id)).size).toBe(corpus.length);
    expect(new Set(corpus.map((record) => record.parsedArtifact.sourceVersionId)).size).toBe(corpus.length);
    expect(new Set(corpus.map((record) => record.parsedArtifact.parsedArtifactId)).size).toBe(corpus.length);

    for (const record of corpus) {
      const bytes = await readFile(path.resolve("eval", record.relativePath));
      expect(createHash("sha256").update(bytes).digest("hex"))
        .toBe(record.parsedArtifact.canonicalTextSha256);
    }
  });

  it("creates materially more than Top-10 candidate chunks through the production parser/chunker", async () => {
    const challenge = await Promise.all(CHALLENGE_RECORDS.map(readCorpusRecord));
    let challengeChunks = 0;

    for (const record of challenge) {
      const bytes = await readFile(path.resolve("eval", record.relativePath));
      const canonical = canonicalizeParsedArtifact(
        record.parsedArtifact.sourceVersionId,
        bytes,
        "md",
      );

      expect(canonical.canonicalTextSha256).toBe(record.parsedArtifact.canonicalTextSha256);
      expect(canonical.parserFingerprint).toBe(record.parsedArtifact.parserFingerprint);
      expect(canonical.normalizationFingerprint).toBe(record.parsedArtifact.normalizationFingerprint);

      const chunks = chunkParsedArtifact(canonical);
      expect(chunks.length).toBeGreaterThanOrEqual(10);
      challengeChunks += chunks.length;
    }

    // Existing fixed corpus contributes 3 additional chunks. The challenge
    // alone must already make Top-K=10 non-trivial rather than structurally saturated.
    expect(challengeChunks).toBeGreaterThanOrEqual(30);
  });

  it("adds lexical pressure without copying development Evidence or target API passages", async () => {
    const challenge = await Promise.all(CHALLENGE_RECORDS.map(readCorpusRecord));
    const challengeText = (
      await Promise.all(
        challenge.map((record) => readFile(path.resolve("eval", record.relativePath), "utf8")),
      )
    ).join("\n");

    const developmentLabels = await readJsonLines<GoldenEvidenceLabel>("eval/labels/development.jsonl");
    for (const label of developmentLabels) {
      expect(challengeText).not.toContain(label.exactQuote);
    }

    expect(challengeText).not.toContain("fsPromises.cp");
    expect(challengeText).not.toContain("`ref()`");

    expect(challengeText).toContain(".value");
    expect(challengeText).toContain("reactive");
    expect(challengeText).toContain("recursive");
    expect(challengeText).toContain("force");
    expect(challengeText).toContain("Promise");
    expect(challengeText).toContain("fsPromises.copyFile");
  });
});
