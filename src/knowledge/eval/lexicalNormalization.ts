export type LexicalNormalizationProfileId =
  | "baseline"
  | "code-derived"
  | "code-cjk-bigram"
  | "code-cjk-bigram-trigram";

export interface LexicalNormalizationProfile {
  id: LexicalNormalizationProfileId;
  deriveCodeTerms: boolean;
  cjkNgramSizes: readonly number[];
}

export interface LexicalNormalizedText {
  profileId: LexicalNormalizationProfileId;
  originalText: string;
  derivedTerms: readonly string[];
  expandedText: string;
}

/**
 * Closed P2-T05 experiment matrix. This is intentionally not a tokenizer
 * plugin registry: the task compares only the smallest concrete variants
 * needed to decide whether lexical normalization is worth carrying forward.
 */
export const LEXICAL_NORMALIZATION_PROFILES: readonly LexicalNormalizationProfile[] = [
  { id: "baseline", deriveCodeTerms: false, cjkNgramSizes: [] },
  { id: "code-derived", deriveCodeTerms: true, cjkNgramSizes: [] },
  { id: "code-cjk-bigram", deriveCodeTerms: true, cjkNgramSizes: [2] },
  { id: "code-cjk-bigram-trigram", deriveCodeTerms: true, cjkNgramSizes: [2, 3] },
];

const ASCII_IDENTIFIER = /[A-Za-z][A-Za-z0-9._:/#_-]*/gu;
const VERSION = /\bv?\d+(?:\.\d+){1,3}\b/giu;
const HAN_RUN = /\p{Script=Han}+/gu;

export function normalizeLexicalText(
  text: string,
  profileId: LexicalNormalizationProfileId,
): LexicalNormalizedText {
  const profile = requireProfile(profileId);
  const derived = new Set<string>();

  if (profile.deriveCodeTerms) {
    addCodeDerivedTerms(text, derived);
    addVersionDerivedTerms(text, derived);
  }
  for (const size of profile.cjkNgramSizes) addCjkNgrams(text, size, derived);

  const derivedTerms = [...derived];
  return {
    profileId,
    originalText: text,
    derivedTerms,
    expandedText: derivedTerms.length === 0 ? text : `${text}\n${derivedTerms.join(" ")}`,
  };
}

function requireProfile(profileId: LexicalNormalizationProfileId): LexicalNormalizationProfile {
  const profile = LEXICAL_NORMALIZATION_PROFILES.find((candidate) => candidate.id === profileId);
  if (profile === undefined) throw new Error(`Unknown lexical normalization profile: ${profileId}`);
  return profile;
}

function addCodeDerivedTerms(text: string, output: Set<string>): void {
  for (const match of text.matchAll(ASCII_IDENTIFIER)) {
    const candidate = match[0];
    const pieces = splitAsciiIdentifier(candidate);
    if (pieces.length <= 1) continue;

    for (const piece of pieces) {
      if (piece.length > 0) output.add(piece);
    }
    output.add(pieces.join(""));
  }
}

function splitAsciiIdentifier(value: string): string[] {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[._:/#_-]+/gu, " ")
    .toLowerCase()
    .split(/\s+/u)
    .filter((piece) => piece.length > 0);
}

function addVersionDerivedTerms(text: string, output: Set<string>): void {
  for (const match of text.matchAll(VERSION)) {
    const raw = match[0].toLowerCase();
    const hasVPrefix = raw.startsWith("v");
    const numeric = hasVPrefix ? raw.slice(1) : raw;
    const pieces = numeric.split(".");
    if (pieces.length <= 1) continue;

    const joined = pieces.join("x");
    output.add(joined);
    if (hasVPrefix) output.add(`v${joined}`);
  }
}

function addCjkNgrams(text: string, size: number, output: Set<string>): void {
  if (!Number.isSafeInteger(size) || size < 2 || size > 3) {
    throw new TypeError("P2 lexical CJK n-gram size must be 2 or 3");
  }

  for (const match of text.matchAll(HAN_RUN)) {
    const characters = Array.from(match[0]);
    for (let index = 0; index + size <= characters.length; index += 1) {
      output.add(characters.slice(index, index + size).join(""));
    }
  }
}
