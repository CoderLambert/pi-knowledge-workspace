export interface HybridRankedHit {
  sourceVersionId: string;
  parsedArtifactId: string;
  startByte: number;
  endByte: number;
}

export interface HybridRrfInput {
  lexicalHits: readonly HybridRankedHit[];
  denseHits: readonly HybridRankedHit[];
  allowedSourceVersionIds?: readonly string[];
  limit?: number;
  rrfK?: number;
}

export interface HybridRrfHit extends HybridRankedHit {
  rrfScore: number;
  lexicalRank: number | null;
  denseRank: number | null;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_RRF_K = 60;

/**
 * Reciprocal-rank fusion for the P2 experiment only. Cross-retriever identity
 * is the stable SourceVersion + ParsedArtifact UTF-8 range, never a Chunk id.
 */
export function reciprocalRankFusion(input: HybridRrfInput): HybridRrfHit[] {
  const limit = validatePositiveInteger(input.limit ?? DEFAULT_LIMIT, "limit", MAX_LIMIT);
  const rrfK = validatePositiveInteger(input.rrfK ?? DEFAULT_RRF_K, "rrfK", 10_000);
  const allowed = normalizeAllowedSourceVersions(input.allowedSourceVersionIds);

  if (allowed !== undefined && allowed.size === 0) return [];

  const fused = new Map<string, HybridRrfHit>();
  addRankedList(fused, input.lexicalHits, "lexical", rrfK, allowed);
  addRankedList(fused, input.denseHits, "dense", rrfK, allowed);

  return [...fused.values()]
    .sort((left, right) => {
      const scoreOrder = right.rrfScore - left.rrfScore;
      if (scoreOrder !== 0) return scoreOrder;
      const bestLeft = Math.min(left.lexicalRank ?? Number.POSITIVE_INFINITY, left.denseRank ?? Number.POSITIVE_INFINITY);
      const bestRight = Math.min(right.lexicalRank ?? Number.POSITIVE_INFINITY, right.denseRank ?? Number.POSITIVE_INFINITY);
      if (bestLeft !== bestRight) return bestLeft - bestRight;
      return stableLocatorKey(left).localeCompare(stableLocatorKey(right));
    })
    .slice(0, limit);
}

function addRankedList(
  fused: Map<string, HybridRrfHit>,
  hits: readonly HybridRankedHit[],
  kind: "lexical" | "dense",
  rrfK: number,
  allowed: ReadonlySet<string> | undefined,
): void {
  const seen = new Set<string>();
  for (let index = 0; index < hits.length; index += 1) {
    const hit = validateHit(hits[index], kind, index);
    if (allowed !== undefined && !allowed.has(hit.sourceVersionId)) continue;

    const key = stableLocatorKey(hit);
    if (seen.has(key)) throw new Error(`${kind} ranked list contains duplicate stable locator: ${key}`);
    seen.add(key);

    const rank = index + 1;
    const score = 1 / (rrfK + rank);
    const current = fused.get(key) ?? {
      ...hit,
      rrfScore: 0,
      lexicalRank: null,
      denseRank: null,
    };

    current.rrfScore += score;
    if (kind === "lexical") current.lexicalRank = rank;
    else current.denseRank = rank;
    fused.set(key, current);
  }
}

function validateHit(
  value: HybridRankedHit | undefined,
  kind: string,
  index: number,
): HybridRankedHit {
  if (value === undefined) throw new Error(`${kind} ranked hit ${String(index)} is missing`);
  requireNonEmpty(value.sourceVersionId, `${kind} sourceVersionId`);
  requireNonEmpty(value.parsedArtifactId, `${kind} parsedArtifactId`);
  if (
    !Number.isSafeInteger(value.startByte)
    || !Number.isSafeInteger(value.endByte)
    || value.startByte < 0
    || value.endByte <= value.startByte
  ) {
    throw new TypeError(`${kind} ranked hit has an invalid UTF-8 byte range`);
  }
  return value;
}

function stableLocatorKey(hit: HybridRankedHit): string {
  return `${hit.sourceVersionId}\0${hit.parsedArtifactId}\0${String(hit.startByte)}\0${String(hit.endByte)}`;
}

function normalizeAllowedSourceVersions(values: readonly string[] | undefined): ReadonlySet<string> | undefined {
  if (values === undefined) return undefined;
  const result = new Set<string>();
  for (const value of values) {
    requireNonEmpty(value, "allowedSourceVersionId");
    result.add(value);
  }
  return result;
}

function validatePositiveInteger(value: number, label: string, max: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new TypeError(`${label} must be an integer between 1 and ${String(max)}`);
  }
  return value;
}

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new TypeError(`${label} must not be empty`);
}
