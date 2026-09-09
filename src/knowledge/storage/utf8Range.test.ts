import { describe, expect, it } from "vitest";

import {
  InvalidUtf8RangeError,
  assertValidUtf8Range,
  extractExactQuote,
  hashUtf8Range,
  sliceUtf8Range,
  verifyExactQuote,
} from "./utf8Range.js";

function bytes(text: string): Uint8Array {
  return Buffer.from(text, "utf8");
}

describe("UTF-8 stable byte ranges", () => {
  it("addresses ASCII with half-open byte ranges", () => {
    const input = bytes("alpha beta");
    const range = { startByte: 0, endByte: 5 };

    expect(extractExactQuote(input, range)).toBe("alpha");
    expect(Buffer.from(sliceUtf8Range(input, range)).toString("utf8")).toBe("alpha");
  });

  it("addresses Chinese by UTF-8 bytes rather than JS string indexes", () => {
    const input = bytes("甲乙丙");
    const range = { startByte: 3, endByte: 6 };

    expect(extractExactQuote(input, range)).toBe("乙");
    expect(range.endByte - range.startByte).toBe(3);
  });

  it("addresses emoji only on complete UTF-8 boundaries", () => {
    const input = bytes("A😀B");
    const range = { startByte: 1, endByte: 5 };

    expect(extractExactQuote(input, range)).toBe("😀");
    expect(() => {
      assertValidUtf8Range(input, { startByte: 2, endByte: 5 });
    }).toThrow(InvalidUtf8RangeError);
    expect(() => {
      assertValidUtf8Range(input, { startByte: 1, endByte: 4 });
    }).toThrow(InvalidUtf8RangeError);
  });

  it("preserves combining characters without grapheme or Unicode normalization", () => {
    const input = bytes("e\u0301 é");
    const decomposed = { startByte: 0, endByte: 3 };
    const composed = { startByte: 4, endByte: 6 };

    expect(extractExactQuote(input, decomposed)).toBe("e\u0301");
    expect(extractExactQuote(input, composed)).toBe("é");
    expect(hashUtf8Range(input, decomposed)).not.toBe(hashUtf8Range(input, composed));
  });

  it("uses the explicit byte range to disambiguate duplicated quotes", () => {
    const input = bytes("same | same | same");
    const first = { startByte: 0, endByte: 4 };
    const second = { startByte: 7, endByte: 11 };

    expect(extractExactQuote(input, first)).toBe("same");
    expect(extractExactQuote(input, second)).toBe("same");
    expect(hashUtf8Range(input, first)).toBe(hashUtf8Range(input, second));
  });

  it("verifies exact quote bytes and SHA-256 without fuzzy matching", () => {
    const input = bytes("前缀\nExact 😀 quote\n后缀");
    const startByte = Buffer.byteLength("前缀\n", "utf8");
    const endByte = startByte + Buffer.byteLength("Exact 😀 quote", "utf8");
    const range = { startByte, endByte };
    const hash = hashUtf8Range(input, range);

    expect(verifyExactQuote(input, range, "Exact 😀 quote", hash)).toBe(true);
    expect(verifyExactQuote(input, range, "Exact 😀 Quote", hash)).toBe(false);
    expect(verifyExactQuote(input, range, "Exact 😀 quote", "0".repeat(64))).toBe(false);
  });

  it("rejects invalid offsets, invalid boundaries and invalid canonical UTF-8", () => {
    const input = bytes("中文");

    expect(() => {
      assertValidUtf8Range(input, { startByte: -1, endByte: 3 });
    }).toThrow(InvalidUtf8RangeError);
    expect(() => {
      assertValidUtf8Range(input, { startByte: 3, endByte: 7 });
    }).toThrow(InvalidUtf8RangeError);
    expect(() => {
      assertValidUtf8Range(input, { startByte: 4, endByte: 6 });
    }).toThrow(InvalidUtf8RangeError);
    expect(() => {
      assertValidUtf8Range(Uint8Array.from([0xc3, 0x28]), { startByte: 0, endByte: 2 });
    }).toThrow(InvalidUtf8RangeError);
  });
});
