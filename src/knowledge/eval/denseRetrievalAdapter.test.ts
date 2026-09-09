import { describe, expect, it } from "vitest";

import {
  embedDenseInputs,
  InMemoryDenseEvaluationIndex,
  prepareDenseInput,
  validateDenseExperimentProfiles,
  type DenseEmbeddingAdapter,
  type DenseEmbeddingProfile,
} from "./denseRetrievalAdapter.js";

function profile(id = "multilingual-a"): DenseEmbeddingProfile {
  return {
    id,
    model: "example/multilingual-embedding",
    version: "2026-09-fixed",
    dimensions: 2,
    preprocessing: {
      id: "prefix-collapse-v1",
      queryPrefix: "query: ",
      documentPrefix: "passage: ",
      collapseWhitespace: true,
    },
  };
}

describe("dense retrieval adapter spike", () => {
  it("limits the experiment to at most two explicit profiles", () => {
    expect(() => {
      validateDenseExperimentProfiles([profile("a"), profile("b")]);
    }).not.toThrow();

    expect(() => {
      validateDenseExperimentProfiles([profile("a"), profile("b"), profile("c")]);
    }).toThrow("between 1 and 2 profiles");

    expect(() => {
      validateDenseExperimentProfiles([profile("same"), profile("same")]);
    }).toThrow("Duplicate dense profile id: same");
  });

  it("applies recorded query/document preprocessing deterministically", () => {
    const selected = profile();
    expect(prepareDenseInput("  Vue   ref() 中文  ", selected, "query"))
      .toBe("query: Vue ref() 中文");
    expect(prepareDenseInput("  Vue   ref() 中文  ", selected, "document"))
      .toBe("passage: Vue ref() 中文");
  });

  it("validates adapter output count and dimensions", async () => {
    const selected = profile();
    const seen: string[] = [];
    const adapter: DenseEmbeddingAdapter = {
      profile: selected,
      embed(inputs) {
        seen.push(...inputs);
        return Promise.resolve(inputs.map(() => Float32Array.from([1, 0])));
      },
    };

    const vectors = await embedDenseInputs(
      adapter,
      ["fsPromises.cp", "响应式"],
      "query",
      new AbortController().signal,
    );
    expect(seen).toEqual(["query: fsPromises.cp", "query: 响应式"]);
    expect(vectors).toHaveLength(2);

    const invalid: DenseEmbeddingAdapter = {
      profile: selected,
      embed() {
        return Promise.resolve([Float32Array.from([1, 0, 0])]);
      },
    };
    await expect(embedDenseInputs(
      invalid,
      ["one"],
      "query",
      new AbortController().signal,
    )).rejects.toThrow("dimension mismatch");
  });

  it("propagates caller cancellation before provider work", async () => {
    let calls = 0;
    const adapter: DenseEmbeddingAdapter = {
      profile: profile(),
      embed() {
        calls += 1;
        return Promise.resolve([Float32Array.from([1, 0])]);
      },
    };
    const controller = new AbortController();
    controller.abort(new Error("cancelled by evaluation deadline"));

    await expect(embedDenseInputs(adapter, ["query"], "query", controller.signal))
      .rejects.toThrow("cancelled by evaluation deadline");
    expect(calls).toBe(0);
  });

  it("filters SourceVersions before dense ranking and Top-K", () => {
    const index = new InMemoryDenseEvaluationIndex(profile(), [
      {
        chunkId: "chunk-a",
        sourceVersionId: "sv-a",
        parsedArtifactId: "artifact-a",
        startByte: 0,
        endByte: 10,
        vector: Float32Array.from([0.8, 0.2]),
      },
      {
        chunkId: "chunk-b",
        sourceVersionId: "sv-b",
        parsedArtifactId: "artifact-b",
        startByte: 0,
        endByte: 10,
        vector: Float32Array.from([1, 0]),
      },
    ]);

    const hits = index.search({
      queryVector: Float32Array.from([1, 0]),
      allowedSourceVersionIds: ["sv-a"],
      limit: 1,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      chunkId: "chunk-a",
      sourceVersionId: "sv-a",
      parsedArtifactId: "artifact-a",
      startByte: 0,
      endByte: 10,
    });
  });

  it("returns an empty result for an explicit empty SourceVersion scope", () => {
    const index = new InMemoryDenseEvaluationIndex(profile(), [{
      chunkId: "chunk-a",
      sourceVersionId: "sv-a",
      parsedArtifactId: "artifact-a",
      startByte: 0,
      endByte: 10,
      vector: Float32Array.from([1, 0]),
    }]);

    expect(index.search({
      queryVector: Float32Array.from([1, 0]),
      allowedSourceVersionIds: [],
    })).toEqual([]);
  });
});
