import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  GOLDEN_QUERY_CATEGORIES,
  validateGoldenDataset,
  type GoldenCorpusArtifact,
  type GoldenEvidenceLabel,
  type GoldenQuery,
} from "./goldenDataset.js";

const CORPUS_RECORDS = [
  "vue-reactivity-core-zh",
  "node-fspromises-cp-v16.7.0",
  "node-fspromises-cp-v22.3.0",
] as const;

const MULTI_SOURCE_QUERY_IDS = [
  "dev-024",
  "dev-044",
  "dev-049",
  "holdout-014",
  "holdout-018",
  "holdout-028",
] as const;

describe("P2-T03 query annotations", () => {
  it("keeps the 50/30 split, category coverage and stable Evidence labels valid", async () => {
    const corpus = await Promise.all(CORPUS_RECORDS.map(readCorpusRecord));
    const development = await readJsonLines<GoldenQuery>("eval/queries/development.jsonl");
    const holdout = await readJsonLines<GoldenQuery>("eval/queries/holdout.jsonl");
    const developmentLabels = await readJsonLines<GoldenEvidenceLabel>("eval/labels/development.jsonl");
    const holdoutLabels = await readJsonLines<GoldenEvidenceLabel>("eval/labels/holdout.jsonl");
    const queries = [...development, ...holdout];
    const labels = [...developmentLabels, ...holdoutLabels];

    validateGoldenDataset({ schemaVersion: 1, corpus, queries, labels });

    expect(development).toHaveLength(50);
    expect(holdout).toHaveLength(30);
    expect(development.every((query) => query.split === "development")).toBe(true);
    expect(holdout.every((query) => query.split === "holdout")).toBe(true);

    const coveredCategories = new Set(queries.flatMap((query) => query.categories));
    expect([...GOLDEN_QUERY_CATEGORIES].every((category) => coveredCategories.has(category))).toBe(true);

    const labelsByQuery = groupLabels(labels);
    const noAnswer = queries.filter((query) => query.categories.includes("no-answer"));
    expect(noAnswer).toHaveLength(12);
    for (const query of noAnswer) expect(labelsByQuery.get(query.id) ?? []).toHaveLength(0);

    for (const queryId of MULTI_SOURCE_QUERY_IDS) {
      const required = (labelsByQuery.get(queryId) ?? []).filter((label) => label.importance === "required");
      expect(new Set(required.map((label) => label.sourceVersionId)).size).toBeGreaterThanOrEqual(2);
    }

    const artifacts = new Map(corpus.map((record) => [record.parsedArtifact.parsedArtifactId, record]));
    const artifactBytes = new Map<string, Buffer>();
    for (const record of corpus) {
      artifactBytes.set(record.parsedArtifact.parsedArtifactId, await readFile(path.resolve("eval", record.relativePath)));
    }

    for (const label of labels) {
      const artifact = artifacts.get(label.parsedArtifactId);
      const bytes = artifactBytes.get(label.parsedArtifactId);
      if (artifact === undefined || bytes === undefined) throw new Error(`Missing corpus bytes for ${label.id}`);

      expect(label.sourceVersionId).toBe(artifact.parsedArtifact.sourceVersionId);
      expect(label.endByte).toBeLessThanOrEqual(bytes.byteLength);
      const exact = bytes.subarray(label.startByte, label.endByte);
      expect(exact.equals(Buffer.from(label.exactQuote, "utf8"))).toBe(true);
      expect(createHash("sha256").update(exact).digest("hex")).toBe(label.quoteHash);
    }
  });
});

async function readCorpusRecord(name: string): Promise<GoldenCorpusArtifact> {
  const raw = await readFile(path.resolve("eval", "corpus", `${name}.meta.json`), "utf8");
  return JSON.parse(raw) as GoldenCorpusArtifact;
}

async function readJsonLines<T>(relativePath: string): Promise<T[]> {
  const raw = await readFile(path.resolve(relativePath), "utf8");
  return raw.trim().split("\n").map((line) => JSON.parse(line) as T);
}

function groupLabels(labels: readonly GoldenEvidenceLabel[]): Map<string, GoldenEvidenceLabel[]> {
  const grouped = new Map<string, GoldenEvidenceLabel[]>();
  for (const label of labels) {
    const current = grouped.get(label.queryId) ?? [];
    current.push(label);
    grouped.set(label.queryId, current);
  }
  return grouped;
}
