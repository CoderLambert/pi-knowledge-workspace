import { describe, expect, it } from "vitest";

import { createPiModelGroundedAskAdapter, parseGroundedModelResponse } from "./piModelProvider.js";

describe("Grounded Ask Pi model provider", () => {
  it("accepts strict JSON and fenced JSON with durable Evidence ids", () => {
    expect(parseGroundedModelResponse('{"answer":"Alpha uses blue.","citations":[{"label":"[1]","evidenceId":"evidence-1"}]}'))
      .toEqual({ text: "Alpha uses blue.", citations: [{ label: "[1]", evidenceId: "evidence-1" }] });
    expect(parseGroundedModelResponse('```json\n{"answer":"Blue.","citations":[{"evidenceId":"evidence-1"}]}\n```'))
      .toEqual({ text: "Blue.", citations: [{ label: "[1]", evidenceId: "evidence-1" }] });
  });

  it("fails closed on prose, empty answers, or missing citations", () => {
    expect(() => parseGroundedModelResponse("Blue.")).toThrow(/valid JSON/);
    expect(() => parseGroundedModelResponse('{"answer":"","citations":[]}')).toThrow(/answer text/);
    expect(() => parseGroundedModelResponse('{"answer":"Blue.","citations":[]}')).toThrow(/Evidence citations/);
  });

  it("fails closed when the configured server model is unavailable", () => {
    expect(() => createPiModelGroundedAskAdapter({
      runtime: {
        getModel: () => undefined,
        completeSimple: () => Promise.reject(new Error("must not run")),
      },
      provider: "missing-provider",
      model: "missing-model",
      modelRevision: "revision-1",
    })).toThrow(/model is not available/);
  });
});
