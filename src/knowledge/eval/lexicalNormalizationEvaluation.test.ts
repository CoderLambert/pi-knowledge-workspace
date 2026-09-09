import { describe, expect, it } from "vitest";

import type { GoldenDataset } from "./goldenDataset.js";
import {
  evaluateLexicalNormalizationDevelopment,
  type LexicalNormalizationRun,
} from "./lexicalNormalizationEvaluation.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

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
        canonicalTextSha256: HASH_A,
      },
    }],
    queries: [
      {
        schemaVersion: 1,
        id: "dev-answerable",
        text: "fsPromises.cp 稳定性",
        split: "development",
        categories: ["code-symbol", "chinese-english-mixed"],
      },
      {
        schemaVersion: 1,
        id: "dev-no-answer",
        text: "missing option",
        split: "development",
        categories: ["no-answer", "english"],
      },
      {
        schemaVersion: 1,
        id: "holdout-answerable",
        text: "holdout query",
        split: "holdout",
        categories: ["english"],
      },
    ],
    labels: [
      {
        schemaVersion: 1,
        id: "label-dev",
        queryId: "dev-answerable",
        importance: "required",
        parsedArtifactId: "artifact-1",
        sourceVersionId: "sv-1",
        startByte: 10,
        endByte: 20,
        exactQuote: "dev quote",
        quoteHash: HASH_B,
      },
      {
        schemaVersion: 1,
        id: "label-holdout",
        queryId: "holdout-answerable",
        importance: "required",
        parsedArtifactId: "artifact-1",
        sourceVersionId: "sv-1",
        startByte: 30,
        endByte: 40,
        exactQuote: "holdout quote",
        quoteHash: HASH_B,
      },
    ],
  };
}

function hit(startByte: number, endByte: number) {
  return {
    sourceVersionId: "sv-1",
    locator: {
      parsedArtifactId: "artifact-1",
      startByte,
      endByte,
    },
  };
}

function run(
  profileId: LexicalNormalizationRun["profileId"],
  relevant: boolean,
  p95LatencyMs: number,
  indexBytes: number,
): LexicalNormalizationRun {
  return {
    profileId,
    observations: [
      {
        queryId: "dev-answerable",
        latencyMs: p95LatencyMs,
        hits: relevant ? [hit(8, 22)] : [hit(40, 50)],
      },
      {
        queryId: "dev-no-answer",
        latencyMs: 1,
        hits: [],
      },
    ],
    resources: {
      peakRssBytes: 1_000,
      indexBytes,
    },
  };
}

describe("lexical normalization development evaluation", () => {
  it("compares candidate deltas against baseline using development queries only", () => {
    const report = evaluateLexicalNormalizationDevelopment(dataset(), [
      run("baseline", false, 10, 100),
      run("code-derived", true, 12, 140),
    ]);

    expect(report.split).toBe("development");
    expect(report.queryCount).toBe(2);
    expect(report.comparisons.map((comparison) => comparison.profileId)).toEqual([
      "baseline",
      "code-derived",
    ]);

    const baseline = report.comparisons[0]!;
    const candidate = report.comparisons[1]!;
    expect(baseline.report.recallAt10).toBe(0);
    expect(candidate.report.recallAt10).toBe(1);
    expect(candidate.deltaFromBaseline).toMatchObject({
      recallAt10: 1,
      mrr: 1,
      allRequiredEvidenceCoverage: 1,
      p95LatencyMs: 2,
      indexBytes: 40,
    });
  });

  it("requires a baseline run", () => {
    expect(() => {
      evaluateLexicalNormalizationDevelopment(dataset(), [
        run("code-derived", true, 10, 100),
      ]);
    }).toThrow("requires a baseline run");
  });

  it("rejects duplicate profile runs", () => {
    expect(() => {
      evaluateLexicalNormalizationDevelopment(dataset(), [
        run("baseline", false, 10, 100),
        run("baseline", true, 11, 110),
      ]);
    }).toThrow("Duplicate lexical normalization run: baseline");
  });

  it("rejects holdout observations during development-set profile selection", () => {
    const baseline = run("baseline", false, 10, 100);
    const withHoldout: LexicalNormalizationRun = {
      ...baseline,
      observations: [
        ...baseline.observations,
        {
          queryId: "holdout-answerable",
          latencyMs: 2,
          hits: [hit(28, 42)],
        },
      ],
    };

    expect(() => {
      evaluateLexicalNormalizationDevelopment(dataset(), [withHoldout]);
    }).toThrow("unknown query: holdout-answerable");
  });
});
