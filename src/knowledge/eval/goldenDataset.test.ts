import { describe, expect, it } from "vitest";

import {
  validateGoldenDataset,
  type GoldenCorpusArtifact,
  type GoldenDataset,
  type GoldenEvidenceLabel,
  type GoldenQuery,
} from "./goldenDataset.js";

const HASH = "a".repeat(64);

function corpus(overrides: Partial<GoldenCorpusArtifact> = {}): GoldenCorpusArtifact {
  return {
    schemaVersion: 1,
    id: "corpus-1",
    relativePath: "corpus/guide-v1.md",
    mediaType: "text/markdown",
    language: "mixed",
    source: {
      title: "Guide v1",
      uri: "https://example.test/guide/v1",
      capturedAt: "2026-09-09T00:00:00.000Z",
      version: "v1",
    },
    parsedArtifact: {
      parsedArtifactId: "artifact-guide-v1",
      sourceVersionId: "source-version-guide-v1",
      parserFingerprint: "md-txt-parser-v1",
      normalizationFingerprint: "utf8-bom-strip+newline-lf-v1",
      canonicalTextSha256: HASH,
    },
    ...overrides,
  };
}

function query(overrides: Partial<GoldenQuery> = {}): GoldenQuery {
  return {
    schemaVersion: 1,
    id: "query-1",
    text: "What does the API return?",
    split: "development",
    categories: ["exact-api", "english"],
    ...overrides,
  };
}

function label(overrides: Partial<GoldenEvidenceLabel> = {}): GoldenEvidenceLabel {
  return {
    schemaVersion: 1,
    id: "label-1",
    queryId: "query-1",
    importance: "required",
    parsedArtifactId: "artifact-guide-v1",
    sourceVersionId: "source-version-guide-v1",
    startByte: 10,
    endByte: 30,
    exactQuote: "authoritative answer",
    quoteHash: HASH,
    ...overrides,
  };
}

function dataset(overrides: Partial<GoldenDataset> = {}): GoldenDataset {
  return {
    schemaVersion: 1,
    corpus: [corpus()],
    queries: [query()],
    labels: [label()],
    ...overrides,
  };
}

describe("P2 Golden Dataset schema", () => {
  it("accepts stable ParsedArtifact byte-range labels across development and holdout splits", () => {
    const holdout = query({
      id: "query-holdout",
      text: "这个错误码表示什么？",
      split: "holdout",
      categories: ["version-error-code", "chinese"],
    });
    const holdoutLabel = label({
      id: "label-holdout",
      queryId: holdout.id,
      startByte: 40,
      endByte: 64,
      exactQuote: "错误码 E123 表示权限不足",
    });

    expect(() => validateGoldenDataset(dataset({
      queries: [query(), holdout],
      labels: [label(), holdoutLabel],
    }))).not.toThrow();
  });

  it("rejects persisted Chunk identity even if an untyped fixture injects it", () => {
    const invalidLabel = {
      ...label(),
      chunkId: "chunk-derived-address-must-not-be-stable",
    } as GoldenEvidenceLabel;

    expect(() => validateGoldenDataset(dataset({ labels: [invalidLabel] })))
      .toThrow("must not persist Chunk identity");
  });

  it("rejects a label whose SourceVersion does not match ParsedArtifact lineage", () => {
    expect(() => validateGoldenDataset(dataset({
      labels: [label({ sourceVersionId: "source-version-current" })],
    }))).toThrow("SourceVersion does not match its ParsedArtifact lineage");
  });

  it("requires at least one required Evidence label for every answerable query", () => {
    expect(() => validateGoldenDataset(dataset({
      labels: [label({ importance: "supporting" })],
    }))).toThrow("must have at least one required Evidence label");
  });

  it("represents no-answer queries with zero labels rather than a fabricated Evidence range", () => {
    const noAnswer = query({
      categories: ["no-answer", "english"],
      text: "What is the undocumented secret value?",
    });
    expect(() => validateGoldenDataset(dataset({
      queries: [noAnswer],
      labels: [],
    }))).not.toThrow();

    expect(() => validateGoldenDataset(dataset({
      queries: [noAnswer],
      labels: [label()],
    }))).toThrow("must not have Evidence labels");
  });

  it("rejects unsafe corpus paths and invalid canonical hashes", () => {
    expect(() => validateGoldenDataset(dataset({
      corpus: [corpus({ relativePath: "../outside.md" })],
    }))).toThrow("canonical safe relative path");

    expect(() => validateGoldenDataset(dataset({
      corpus: [corpus({
        parsedArtifact: {
          ...corpus().parsedArtifact,
          canonicalTextSha256: "not-a-hash",
        },
      })],
    }))).toThrow("lowercase SHA-256 hash");
  });
});
