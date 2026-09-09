import { describe, expect, it } from "vitest";

import {
  LEXICAL_NORMALIZATION_PROFILES,
  normalizeLexicalText,
} from "./lexicalNormalization.js";

describe("P2 lexical normalization experiment", () => {
  it("keeps the baseline byte-for-byte unchanged", () => {
    const text = "Vue ref 与 fsPromises.cp";
    expect(normalizeLexicalText(text, "baseline")).toEqual({
      profileId: "baseline",
      originalText: text,
      derivedTerms: [],
      expandedText: text,
    });
  });

  it("derives camelCase, dotted and snake-case code terms without removing the original text", () => {
    const text = "fsPromises.cp AbortController ERR_INVALID_ARG_TYPE shallow_ref";
    const result = normalizeLexicalText(text, "code-derived");

    expect(result.originalText).toBe(text);
    expect(result.expandedText.startsWith(`${text}\n`)).toBe(true);
    expect(result.derivedTerms).toEqual(expect.arrayContaining([
      "fs",
      "promises",
      "cp",
      "fspromisescp",
      "abort",
      "controller",
      "abortcontroller",
      "err",
      "invalid",
      "arg",
      "type",
      "errinvalidargtype",
      "shallow",
      "ref",
      "shallowref",
    ]));
  });

  it("adds stable aliases for dotted versions used by version-sensitive queries", () => {
    const result = normalizeLexicalText("Node.js v16.7.0 and 22.3.0", "code-derived");

    expect(result.derivedTerms).toEqual(expect.arrayContaining([
      "16x7x0",
      "v16x7x0",
      "22x3x0",
    ]));
  });

  it("adds overlapping Han bigrams only in the bigram profile", () => {
    const codeOnly = normalizeLexicalText("响应式行为", "code-derived");
    const withBigrams = normalizeLexicalText("响应式行为", "code-cjk-bigram");

    expect(codeOnly.derivedTerms).toEqual([]);
    expect(withBigrams.derivedTerms).toEqual(["响应", "应式", "式行", "行为"]);
  });

  it("adds bigrams and trigrams deterministically without duplicate terms", () => {
    const first = normalizeLexicalText("读取读取", "code-cjk-bigram-trigram");
    const second = normalizeLexicalText("读取读取", "code-cjk-bigram-trigram");

    expect(first).toEqual(second);
    expect(first.derivedTerms).toEqual([
      "读取",
      "取读",
      "读取读",
      "取读取",
    ]);
  });

  it("keeps the experiment matrix closed and ordered from least to most normalization", () => {
    expect(LEXICAL_NORMALIZATION_PROFILES.map((profile) => profile.id)).toEqual([
      "baseline",
      "code-derived",
      "code-cjk-bigram",
      "code-cjk-bigram-trigram",
    ]);
  });
});
