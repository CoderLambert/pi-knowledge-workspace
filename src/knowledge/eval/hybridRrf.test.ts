import { describe, expect, it } from "vitest";

import { reciprocalRankFusion, type HybridRankedHit } from "./hybridRrf.js";

function hit(id: string, sourceVersionId: string = "sv-1"): HybridRankedHit {
  const ordinal = Number(id.replace(/\D/gu, "")) || 1;
  return {
    sourceVersionId,
    parsedArtifactId: `artifact-${sourceVersionId}`,
    startByte: ordinal * 10,
    endByte: ordinal * 10 + 5,
  };
}

describe("P2 hybrid RRF", () => {
  it("boosts the same stable locator retrieved by both lexical and dense lists", () => {
    const shared = hit("1");
    const lexicalOnly = hit("2");
    const denseOnly = hit("3");

    const result = reciprocalRankFusion({
      lexicalHits: [lexicalOnly, shared],
      denseHits: [denseOnly, shared],
      rrfK: 60,
    });

    expect(result[0]).toMatchObject({
      ...shared,
      lexicalRank: 2,
      denseRank: 2,
    });
    expect(result[0]!.rrfScore).toBeCloseTo(2 / 62);
  });

  it("preserves lexical-only and dense-only results", () => {
    const lexical = hit("1");
    const dense = hit("2");
    const result = reciprocalRankFusion({ lexicalHits: [lexical], denseHits: [dense] });

    expect(result).toHaveLength(2);
    expect(result.some((candidate) => candidate.lexicalRank === 1 && candidate.denseRank === null)).toBe(true);
    expect(result.some((candidate) => candidate.lexicalRank === null && candidate.denseRank === 1)).toBe(true);
  });

  it("applies SourceVersion scope before fusion and Top-K", () => {
    const disallowedBest = hit("1", "sv-b");
    const allowed = hit("2", "sv-a");

    const result = reciprocalRankFusion({
      lexicalHits: [disallowedBest, allowed],
      denseHits: [disallowedBest, allowed],
      allowedSourceVersionIds: ["sv-a"],
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.sourceVersionId).toBe("sv-a");
  });

  it("returns no results for an explicit empty SourceVersion scope", () => {
    expect(reciprocalRankFusion({
      lexicalHits: [hit("1")],
      denseHits: [hit("1")],
      allowedSourceVersionIds: [],
    })).toEqual([]);
  });

  it("uses stable locator identity rather than retrieval-system chunk identity", () => {
    const sameLocatorA = hit("1");
    const sameLocatorB = { ...sameLocatorA };
    const result = reciprocalRankFusion({
      lexicalHits: [sameLocatorA],
      denseHits: [sameLocatorB],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ lexicalRank: 1, denseRank: 1 });
  });

  it("rejects duplicate locators inside one ranked list", () => {
    const duplicate = hit("1");
    expect(() => {
      reciprocalRankFusion({
        lexicalHits: [duplicate, { ...duplicate }],
        denseHits: [],
      });
    }).toThrow("duplicate stable locator");
  });

  it("orders score ties deterministically by best rank then stable locator", () => {
    const first = hit("1");
    const second = hit("2");
    const result = reciprocalRankFusion({
      lexicalHits: [first, second],
      denseHits: [second, first],
      rrfK: 60,
    });

    expect(result.map((candidate) => candidate.startByte)).toEqual([10, 20]);
  });
});
