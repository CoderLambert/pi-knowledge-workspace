import { describe, expect, it } from "vitest";

import { canonicalizeParsedArtifact, type ParsedArtifactCanonical } from "./parsedArtifact.js";
import { chunkParsedArtifact } from "./chunker.js";

function artifact(text: string, kind: "md" | "txt" = "md"): ParsedArtifactCanonical {
  return canonicalizeParsedArtifact("source-version-1", Buffer.from(text, "utf8"), kind);
}

describe("structure-aware chunker", () => {
  it("keeps a heading-delimited section intact when it fits the budget", () => {
    const input = artifact("# Heading\nParagraph one.\nParagraph two.\n");
    const chunks = chunkParsedArtifact(input, { targetBytes: 200 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ ordinal: 0, startByte: 0, nodeKinds: ["heading", "paragraph"] });
    expect(chunks[0]!.text).toBe("# Heading\nParagraph one.\nParagraph two.");
  });

  it("starts a new chunk at a heading boundary when both sections fit independently", () => {
    const input = artifact("# One\nAlpha\n\n# Two\nBeta\n");
    const chunks = chunkParsedArtifact(input, { targetBytes: 100 });

    expect(chunks.map((chunk) => chunk.text)).toEqual(["# One\nAlpha", "# Two\nBeta"]);
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual([0, 1]);
  });

  it("splits an oversized section at structural-node boundaries before splitting nodes", () => {
    const input = artifact("# H\n- first item\n- second item\n- third item\n");
    const chunks = chunkParsedArtifact(input, { targetBytes: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.nodeKinds).toContain("heading");
    expect(chunks.every((chunk) => Buffer.byteLength(chunk.text, "utf8") <= 20)).toBe(true);
    expect(chunks.flatMap((chunk) => chunk.nodeKinds)).toContain("list-item");
  });

  it("splits only an individually oversized code block inside the node on UTF-8 boundaries", () => {
    const input = artifact("```txt\n中文😀中文😀中文😀\n```\n");
    const chunks = chunkParsedArtifact(input, { targetBytes: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.nodeKinds.length === 1 && chunk.nodeKinds[0] === "code-block")).toBe(true);
    for (const chunk of chunks) {
      expect(chunk.endByte).toBeGreaterThan(chunk.startByte);
      expect(Buffer.from(chunk.text, "utf8").byteLength).toBeLessThanOrEqual(10);
    }
  });

  it("makes progress when the byte budget is smaller than one multibyte code point", () => {
    const input = artifact("中文😀", "txt");
    const chunks = chunkParsedArtifact(input, { targetBytes: 1 });

    expect(chunks.map((chunk) => chunk.text).join("")).toBe("中文😀");
    expect(chunks.map((chunk) => chunk.text)).toEqual(["中", "文", "😀"]);
  });

  it("chunks non-structural whitespace-only canonical bytes without inventing structure", () => {
    const input = artifact("   \n\n", "txt");
    const chunks = chunkParsedArtifact(input, { targetBytes: 2 });

    expect(chunks.map((chunk) => chunk.text).join("")).toBe("   \n\n");
    expect(chunks.every((chunk) => chunk.nodeKinds.length === 0)).toBe(true);
  });

  it("fails closed for malformed structure or an invalid target budget", () => {
    const input = artifact("Alpha 😀 beta", "txt");
    const malformed: ParsedArtifactCanonical = {
      ...input,
      documentStructure: [{ kind: "paragraph", startByte: 7, endByte: input.canonicalBytes.byteLength }],
    };

    expect(() => chunkParsedArtifact(malformed, { targetBytes: 20 })).toThrow(/invalid canonical UTF-8 byte range/);
    expect(() => chunkParsedArtifact(input, { targetBytes: 0 })).toThrow(/positive safe integer/);
  });
});
