import { describe, expect, it } from "vitest";

import type { GoldenDataset } from "./goldenDataset.js";
import {
  renderRetrievalBenchmarkMarkdown,
  runRetrievalBenchmark,
  type RetrievalBenchmarkVariant,
} from "./retrievalBenchmarkRunner.js";

const HASH = "a".repeat(64);

function dataset(): GoldenDataset {
  return {
    schemaVersion: 1,
    corpus: [{
      schemaVersion: 1,
      id: "corpus-a",
      relativePath: "corpus/a.md",
      mediaType: "text/markdown",
      language: "mixed",
      source: {
        title: "Fixture",
        uri: "https://example.test/a",
        capturedAt: "2026-09-09T00:00:00.000Z",
        version: "v1",
      },
      parsedArtifact: {
        parsedArtifactId: "pa-a",
        sourceVersionId: "sv-a",
        parserFingerprint: "parser-v1",
        normalizationFingerprint: "norm-v1",
        canonicalTextSha256: HASH,
      },
    }],
    queries: [
      { schemaVersion: 1, id: "dev-hit", text: "alpha", split: "development", categories: ["english"] },
      { schemaVersion: 1, id: "dev-miss", text: "beta", split: "development", categories: ["semantic"] },
      { schemaVersion: 1, id: "dev-na", text: "missing", split: "development", categories: ["no-answer", "english"] },
      { schemaVersion: 1, id: "holdout-hit", text: "gamma", split: "holdout", categories: ["english"] },
    ],
    labels: [
      {
        schemaVersion: 1,
        id: "label-dev-hit",
        queryId: "dev-hit",
        importance: "required",
        parsedArtifactId: "pa-a",
        sourceVersionId: "sv-a",
        startByte: 10,
        endByte: 20,
        exactQuote: "abcdefghij",
        quoteHash: HASH,
      },
      {
        schemaVersion: 1,
        id: "label-dev-miss",
        queryId: "dev-miss",
        importance: "required",
        parsedArtifactId: "pa-a",
        sourceVersionId: "sv-a",
        startByte: 30,
        endByte: 40,
        exactQuote: "klmnopqrst",
        quoteHash: HASH,
      },
      {
        schemaVersion: 1,
        id: "label-holdout",
        queryId: "holdout-hit",
        importance: "required",
        parsedArtifactId: "pa-a",
        sourceVersionId: "sv-a",
        startByte: 50,
        endByte: 60,
        exactQuote: "uvwxyz0123",
        quoteHash: HASH,
      },
    ],
  };
}

function developmentVariant(id: string = "fts"): RetrievalBenchmarkVariant {
  return {
    id,
    label: id === "fts" ? "FTS baseline" : "Dense candidate",
    configRevision: `${id}-rev-1`,
    resources: { peakRssBytes: 2048, indexBytes: 1024 },
    observations: [
      {
        queryId: "dev-hit",
        latencyMs: 2,
        hits: [{ sourceVersionId: "sv-a", locator: { parsedArtifactId: "pa-a", startByte: 9, endByte: 21 } }],
      },
      {
        queryId: "dev-miss",
        latencyMs: 4,
        hits: [{ sourceVersionId: "sv-a", locator: { parsedArtifactId: "pa-a", startByte: 0, endByte: 5 } }],
      },
      {
        queryId: "dev-na",
        latencyMs: 6,
        hits: [{ sourceVersionId: "sv-a", locator: { parsedArtifactId: "pa-a", startByte: 70, endByte: 80 } }],
      },
    ],
  };
}

describe("runRetrievalBenchmark", () => {
  it("computes deterministic development metrics and failure details for multiple variants", () => {
    const report = runRetrievalBenchmark(dataset(), "development", [developmentVariant(), developmentVariant("dense")]);

    expect(report.schemaVersion).toBe(1);
    expect(report.split).toBe("development");
    expect(report.queryCount).toBe(3);
    expect(report.variants).toHaveLength(2);
    expect(report.variants[0]?.metrics.recallAt10).toBe(0.5);
    expect(report.variants[0]?.metrics.mrr).toBe(0.5);
    expect(report.variants[0]?.metrics.allRequiredEvidenceCoverage).toBe(0.5);
    expect(report.variants[0]?.metrics.latencyMs).toEqual({ median: 4, p95: 6, max: 6 });
    expect(report.variants[0]?.missedAnswerableQueryIds).toEqual(["dev-miss"]);
    expect(report.variants[0]?.noAnswerQueryIdsWithAnyHit).toEqual(["dev-na"]);
    expect(report.variants[0]?.metrics.categoryFailureCounts).toEqual({ semantic: 1 });
  });

  it("rejects holdout observations during a development benchmark", () => {
    const variant = developmentVariant();
    expect(() => runRetrievalBenchmark(dataset(), "development", [{
      ...variant,
      observations: [...variant.observations, {
        queryId: "holdout-hit",
        latencyMs: 1,
        hits: [],
      }],
    }])).toThrow(/outside development split/);
  });

  it("rejects duplicate variant ids and incomplete observations", () => {
    expect(() => runRetrievalBenchmark(dataset(), "development", [developmentVariant(), developmentVariant()]))
      .toThrow(/Duplicate retrieval benchmark variant/);

    const variant = developmentVariant();
    expect(() => runRetrievalBenchmark(dataset(), "development", [{
      ...variant,
      observations: variant.observations.slice(0, 2),
    }])).toThrow(/must cover every query/);
  });

  it("renders aggregate metrics and explicit failures without hiding no-answer hits", () => {
    const markdown = renderRetrievalBenchmarkMarkdown(
      runRetrievalBenchmark(dataset(), "development", [developmentVariant()]),
    );

    expect(markdown).toContain("| FTS baseline | fts-rev-1 | 0.5000 | 0.5000 | 0.5000 | 6 | 2048 | 1024 |");
    expect(markdown).toContain("- semantic: 1");
    expect(markdown).toContain("- dev-miss");
    expect(markdown).toContain("- dev-na");
  });
});
