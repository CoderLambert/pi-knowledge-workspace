import { describe, expect, it } from "vitest";

import type { GoldenDataset } from "./goldenDataset.js";
import {
  buildDirectFilePiTasks,
  evaluateDirectFilePiBaseline,
  type DirectFilePiObservation,
} from "./directFilePiBaseline.js";

const HASH = "a".repeat(64);

function dataset(): GoldenDataset {
  return {
    schemaVersion: 1,
    corpus: [
      {
        schemaVersion: 1,
        id: "corpus-b",
        relativePath: "corpus/b.md",
        mediaType: "text/markdown",
        language: "en",
        source: {
          title: "B",
          uri: "https://example.test/b",
          capturedAt: "2026-09-09T00:00:00.000Z",
          version: "v2",
        },
        parsedArtifact: {
          parsedArtifactId: "artifact-b",
          sourceVersionId: "sv-b",
          parserFingerprint: "parser-v1",
          normalizationFingerprint: "normalizer-v1",
          canonicalTextSha256: HASH,
        },
      },
      {
        schemaVersion: 1,
        id: "corpus-a",
        relativePath: "corpus/a.md",
        mediaType: "text/markdown",
        language: "zh",
        source: {
          title: "A",
          uri: "https://example.test/a",
          capturedAt: "2026-09-09T00:00:00.000Z",
          version: "v1",
        },
        parsedArtifact: {
          parsedArtifactId: "artifact-a",
          sourceVersionId: "sv-a",
          parserFingerprint: "parser-v1",
          normalizationFingerprint: "normalizer-v1",
          canonicalTextSha256: HASH,
        },
      },
    ],
    queries: [
      {
        schemaVersion: 1,
        id: "dev-answerable",
        text: "compare the two sources",
        split: "development",
        categories: ["multi-source", "english"],
      },
      {
        schemaVersion: 1,
        id: "dev-no-answer",
        text: "missing fact",
        split: "development",
        categories: ["no-answer", "english"],
      },
      {
        schemaVersion: 1,
        id: "holdout-answerable",
        text: "holdout",
        split: "holdout",
        categories: ["english"],
      },
    ],
    labels: [
      {
        schemaVersion: 1,
        id: "label-a",
        queryId: "dev-answerable",
        importance: "required",
        parsedArtifactId: "artifact-a",
        sourceVersionId: "sv-a",
        startByte: 10,
        endByte: 20,
        exactQuote: "quote a",
        quoteHash: HASH,
      },
      {
        schemaVersion: 1,
        id: "label-b",
        queryId: "dev-answerable",
        importance: "required",
        parsedArtifactId: "artifact-b",
        sourceVersionId: "sv-b",
        startByte: 30,
        endByte: 40,
        exactQuote: "quote b",
        quoteHash: HASH,
      },
      {
        schemaVersion: 1,
        id: "label-holdout",
        queryId: "holdout-answerable",
        importance: "required",
        parsedArtifactId: "artifact-a",
        sourceVersionId: "sv-a",
        startByte: 50,
        endByte: 60,
        exactQuote: "holdout",
        quoteHash: HASH,
      },
    ],
  };
}

function citation(
  sourceVersionId: string,
  parsedArtifactId: string,
  startByte: number,
  endByte: number,
) {
  return { sourceVersionId, parsedArtifactId, startByte, endByte };
}

describe("direct-file Pi baseline", () => {
  it("builds the same fixed corpus file set for every query without labels", () => {
    const tasks = buildDirectFilePiTasks(dataset(), "development");

    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.queryId)).toEqual(["dev-answerable", "dev-no-answer"]);
    expect(tasks[0]!.files.map((file) => file.relativePath)).toEqual(["corpus/a.md", "corpus/b.md"]);
    expect(tasks[1]!.files).toEqual(tasks[0]!.files);
    expect(Object.keys(tasks[0]!)).toEqual(["queryId", "query", "split", "files"]);
  });

  it("scores required Evidence coverage, citation precision and no-answer abstention deterministically", () => {
    const observations: DirectFilePiObservation[] = [
      {
        queryId: "dev-answerable",
        latencyMs: 20,
        insufficientEvidence: false,
        citations: [
          citation("sv-a", "artifact-a", 9, 21),
          citation("sv-b", "artifact-b", 29, 41),
          citation("sv-a", "artifact-a", 70, 80),
        ],
      },
      {
        queryId: "dev-no-answer",
        latencyMs: 10,
        insufficientEvidence: true,
        citations: [],
      },
    ];

    const report = evaluateDirectFilePiBaseline(dataset(), "development", observations);
    expect(report).toMatchObject({
      split: "development",
      queryCount: 2,
      answerableQueries: 1,
      noAnswerQueries: 1,
      anyRequiredEvidenceCoverage: 1,
      allRequiredEvidenceCoverage: 1,
      noAnswerCorrectAbstentionRate: 1,
      citationPrecision: 2 / 3,
      latencyMs: {
        median: 10,
        p95: 20,
        max: 20,
      },
    });
  });

  it("distinguishes any-required from all-required coverage for multi-source tasks", () => {
    const report = evaluateDirectFilePiBaseline(dataset(), "development", [
      {
        queryId: "dev-answerable",
        latencyMs: 1,
        insufficientEvidence: false,
        citations: [citation("sv-a", "artifact-a", 10, 20)],
      },
      {
        queryId: "dev-no-answer",
        latencyMs: 1,
        insufficientEvidence: false,
        citations: [],
      },
    ]);

    expect(report.anyRequiredEvidenceCoverage).toBe(1);
    expect(report.allRequiredEvidenceCoverage).toBe(0);
    expect(report.noAnswerCorrectAbstentionRate).toBe(0);
  });

  it("rejects cross-split, duplicate and incomplete observations", () => {
    expect(() => {
      evaluateDirectFilePiBaseline(dataset(), "development", [{
        queryId: "holdout-answerable",
        latencyMs: 1,
        insufficientEvidence: false,
        citations: [],
      }]);
    }).toThrow("unknown query: holdout-answerable");

    const duplicate: DirectFilePiObservation = {
      queryId: "dev-answerable",
      latencyMs: 1,
      insufficientEvidence: false,
      citations: [],
    };
    expect(() => {
      evaluateDirectFilePiBaseline(dataset(), "development", [duplicate, duplicate]);
    }).toThrow("Duplicate direct-file observation");

    expect(() => {
      evaluateDirectFilePiBaseline(dataset(), "development", [duplicate]);
    }).toThrow("missing dev-no-answer");
  });
});
