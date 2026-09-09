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
      id: "corpus-1",
      relativePath: "corpus/source.md",
      mediaType: "text/markdown",
      language: "mixed",
      source: {
        title: "Source",
        uri: "https://example.test/source",
        capturedAt: "2026-09-09T00:00:00.000Z",
        version: "v1",
      },
      parsedArtifact: {
        parsedArtifactId: "artifact-1",
        sourceVersionId: "sv-1",
        parserFingerprint: "parser-v1",
        normalizationFingerprint: "normalizer-v1",
        canonicalTextSha256: HASH,
      },
    }],
    queries: [
      {
        schemaVersion: 1,
        id: "dev-1",
        text: "development query",
        split: "development",
        categories: ["english", "code-symbol"],
      },
      {
        schemaVersion: 1,
        id: "holdout-1",
        text: "holdout query",
        split: "holdout",
        categories: ["english"],
      },
    ],
    labels: [
      {
        schemaVersion: 1,
        id: "label-dev",
        queryId: "dev-1",
        importance: "required",
        parsedArtifactId: "artifact-1",
        sourceVersionId: "sv-1",
        startByte: 10,
        endByte: 20,
        exactQuote: "dev quote",
        quoteHash: HASH,
      },
      {
        schemaVersion: 1,
        id: "label-holdout",
        queryId: "holdout-1",
        importance: "required",
        parsedArtifactId: "artifact-1",
        sourceVersionId: "sv-1",
        startByte: 30,
        endByte: 40,
        exactQuote: "holdout quote",
        quoteHash: HASH,
      },
    ],
  };
}

function variant(id: string, relevant: boolean): RetrievalBenchmarkVariant {
  return {
    id,
    configuration: {
      zeta: true,
      alpha: id,
    },
    observations: [{
      queryId: "dev-1",
      latencyMs: id === "fts" ? 3 : 5,
      hits: [{
        sourceVersionId: "sv-1",
        locator: {
          parsedArtifactId: "artifact-1",
          startByte: relevant ? 9 : 40,
          endByte: relevant ? 21 : 50,
        },
      }],
    }],
    resources: {
      peakRssBytes: id === "fts" ? 1_000 : 2_000,
      indexBytes: id === "fts" ? 500 : 800,
    },
  };
}

describe("retrieval benchmark runner", () => {
  it("evaluates multiple named variants on one explicit split", () => {
    const report = runRetrievalBenchmark(
      dataset(),
      "development",
      "2026-09-09T12:00:00.000Z",
      [variant("fts", false), variant("hybrid", true)],
    );

    expect(report).toMatchObject({
      schemaVersion: 1,
      split: "development",
      queryCount: 1,
    });
    expect(report.variants.map((item) => item.id)).toEqual(["fts", "hybrid"]);
    expect(report.variants[0]?.metrics.recallAt10).toBe(0);
    expect(report.variants[1]?.metrics.recallAt10).toBe(1);
    expect(Object.keys(report.variants[0]?.configuration ?? {})).toEqual(["alpha", "zeta"]);
  });

  it("fails if observations from another split are mixed into a run", () => {
    const invalid = variant("fts", true);
    const withHoldout: RetrievalBenchmarkVariant = {
      ...invalid,
      observations: [
        ...invalid.observations,
        {
          queryId: "holdout-1",
          latencyMs: 1,
          hits: [],
        },
      ],
    };

    expect(() => {
      runRetrievalBenchmark(
        dataset(),
        "development",
        "2026-09-09T12:00:00.000Z",
        [withHoldout],
      );
    }).toThrow("unknown query: holdout-1");
  });

  it("rejects duplicate variant ids and invalid timestamps", () => {
    expect(() => {
      runRetrievalBenchmark(
        dataset(),
        "development",
        "2026-09-09T12:00:00.000Z",
        [variant("same", true), variant("same", false)],
      );
    }).toThrow("Duplicate benchmark variant id: same");

    expect(() => {
      runRetrievalBenchmark(dataset(), "development", "not-a-date", [variant("fts", true)]);
    }).toThrow("generatedAt");
  });

  it("renders deterministic metric, configuration, failure and diagnostic sections", () => {
    const report = runRetrievalBenchmark(
      dataset(),
      "development",
      "2026-09-09T12:00:00.000Z",
      [variant("fts", false), variant("hybrid", true)],
    );
    const markdown = renderRetrievalBenchmarkMarkdown(report);

    expect(markdown).toContain("| fts | 0.0000 | 0.0000 | 0.0000 | 3.0000 | 1000 | 500 |");
    expect(markdown).toContain("| hybrid | 1.0000 | 1.0000 | 1.0000 | 5.0000 | 2000 | 800 |");
    expect(markdown.indexOf("`alpha`")).toBeLessThan(markdown.indexOf("`zeta`"));
    expect(markdown).toContain("`code-symbol`: 1");
    expect(markdown).toContain("`english`: 1");
    expect(markdown).toContain("no-answer queries with any hit: 0");
  });
});
