import { describe, expect, it } from "vitest";

import { evaluateFtsBaseline, type FtsBaselineObservation } from "./ftsBaselineEvaluation.js";
import type { GoldenDataset } from "./goldenDataset.js";

const ARTIFACT_A = "artifact-a";
const ARTIFACT_B = "artifact-b";
const SOURCE_VERSION_A = "source-version-a";
const SOURCE_VERSION_B = "source-version-b";

function dataset(): GoldenDataset {
  return {
    schemaVersion: 1,
    corpus: [
      corpus("corpus-a", ARTIFACT_A, SOURCE_VERSION_A),
      corpus("corpus-b", ARTIFACT_B, SOURCE_VERSION_B),
    ],
    queries: [
      { schemaVersion: 1, id: "q-one", text: "first", split: "development", categories: ["exact-api"] },
      { schemaVersion: 1, id: "q-multi", text: "compare", split: "development", categories: ["multi-source", "conflict"] },
      { schemaVersion: 1, id: "q-miss", text: "missing hit", split: "development", categories: ["chinese"] },
      { schemaVersion: 1, id: "q-none", text: "not in corpus", split: "holdout", categories: ["no-answer", "english"] },
    ],
    labels: [
      label("l-one", "q-one", ARTIFACT_A, SOURCE_VERSION_A, 10, 20),
      label("l-multi-a", "q-multi", ARTIFACT_A, SOURCE_VERSION_A, 30, 40),
      label("l-multi-b", "q-multi", ARTIFACT_B, SOURCE_VERSION_B, 50, 60),
      label("l-miss", "q-miss", ARTIFACT_A, SOURCE_VERSION_A, 70, 80),
    ],
  };
}

describe("P2-T04 FTS baseline evaluation", () => {
  it("computes Recall@10, MRR, required-Evidence coverage, failures and resource diagnostics", () => {
    const observations: FtsBaselineObservation[] = [
      observation("q-one", 4, [
        hit(ARTIFACT_B, SOURCE_VERSION_B, 0, 5),
        hit(ARTIFACT_A, SOURCE_VERSION_A, 12, 18),
      ]),
      observation("q-multi", 10, [hit(ARTIFACT_A, SOURCE_VERSION_A, 30, 35)]),
      observation("q-miss", 2, [hit(ARTIFACT_B, SOURCE_VERSION_B, 70, 80)]),
      observation("q-none", 8, [hit(ARTIFACT_A, SOURCE_VERSION_A, 0, 5)]),
    ];

    const report = evaluateFtsBaseline(dataset(), observations, {
      peakRssBytes: 4096,
      indexBytes: 1024,
    });

    expect(report).toEqual({
      queryCount: 4,
      scoredAnswerableQueries: 3,
      noAnswerQueries: 1,
      noAnswerQueriesWithAnyHit: 1,
      recallAt10: 2 / 3,
      mrr: 0.5,
      allRequiredEvidenceCoverage: 1 / 3,
      categoryFailureCounts: { chinese: 1 },
      latencyMs: { median: 4, p95: 10, max: 10 },
      resources: { peakRssBytes: 4096, indexBytes: 1024 },
    });
  });

  it("requires one observation per fixed query and rejects invalid resource measurements", () => {
    expect(() => evaluateFtsBaseline(dataset(), [], { peakRssBytes: 0, indexBytes: 0 }))
      .toThrow("observations must cover every query");

    const observations = dataset().queries.map((query) => observation(query.id, 1, []));
    expect(() => evaluateFtsBaseline(dataset(), observations, { peakRssBytes: -1, indexBytes: 0 }))
      .toThrow("peakRssBytes must be a non-negative safe integer");
  });
});

function corpus(id: string, parsedArtifactId: string, sourceVersionId: string): GoldenDataset["corpus"][number] {
  return {
    schemaVersion: 1,
    id,
    relativePath: `${id}.md`,
    mediaType: "text/markdown",
    language: "en",
    source: {
      title: id,
      uri: `https://example.invalid/${id}`,
      capturedAt: "2026-09-09T00:00:00.000Z",
      version: "test",
    },
    parsedArtifact: {
      parsedArtifactId,
      sourceVersionId,
      parserFingerprint: "parser-test",
      normalizationFingerprint: "normalization-test",
      canonicalTextSha256: "0".repeat(64),
    },
  };
}

function label(
  id: string,
  queryId: string,
  parsedArtifactId: string,
  sourceVersionId: string,
  startByte: number,
  endByte: number,
): GoldenDataset["labels"][number] {
  return {
    schemaVersion: 1,
    id,
    queryId,
    importance: "required",
    parsedArtifactId,
    sourceVersionId,
    startByte,
    endByte,
    exactQuote: "evidence",
    quoteHash: "1".repeat(64),
  };
}

function observation(queryId: string, latencyMs: number, hits: FtsBaselineObservation["hits"]): FtsBaselineObservation {
  return { queryId, latencyMs, hits };
}

function hit(parsedArtifactId: string, sourceVersionId: string, startByte: number, endByte: number) {
  return {
    sourceVersionId,
    locator: { parsedArtifactId, startByte, endByte },
  };
}
