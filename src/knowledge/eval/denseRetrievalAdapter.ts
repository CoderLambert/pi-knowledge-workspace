export type DenseInputKind = "query" | "document";

export interface DensePreprocessingMetadata {
  id: string;
  queryPrefix: string;
  documentPrefix: string;
  collapseWhitespace: boolean;
}

export interface DenseEmbeddingProfile {
  id: string;
  model: string;
  version: string;
  dimensions: number;
  preprocessing: DensePreprocessingMetadata;
}

export interface DenseEmbeddingAdapter {
  readonly profile: DenseEmbeddingProfile;
  embed(
    inputs: readonly string[],
    kind: DenseInputKind,
    signal: AbortSignal,
  ): Promise<readonly Float32Array[]>;
}

export interface DenseIndexedChunk {
  chunkId: string;
  sourceVersionId: string;
  parsedArtifactId: string;
  startByte: number;
  endByte: number;
  vector: Float32Array;
}

export interface DenseSearchInput {
  queryVector: Float32Array;
  allowedSourceVersionIds?: readonly string[];
  limit?: number;
}

export interface DenseSearchHit {
  chunkId: string;
  sourceVersionId: string;
  parsedArtifactId: string;
  startByte: number;
  endByte: number;
  score: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_EXPERIMENT_PROFILES = 2;

/**
 * Validates the intentionally small P2-T06 experiment set. The spike permits
 * at most two serious multilingual embedding profiles and deliberately does
 * not create a provider/model registry.
 */
export function validateDenseExperimentProfiles(
  profiles: readonly DenseEmbeddingProfile[],
): void {
  if (profiles.length === 0 || profiles.length > MAX_EXPERIMENT_PROFILES) {
    throw new Error(`Dense experiment requires between 1 and ${String(MAX_EXPERIMENT_PROFILES)} profiles`);
  }

  const ids = new Set<string>();
  for (const profile of profiles) {
    requireNonEmpty(profile.id, "profile id");
    requireNonEmpty(profile.model, `profile ${profile.id} model`);
    requireNonEmpty(profile.version, `profile ${profile.id} version`);
    if (!Number.isSafeInteger(profile.dimensions) || profile.dimensions <= 0 || profile.dimensions > 65_536) {
      throw new TypeError(`profile ${profile.id} dimensions must be an integer between 1 and 65536`);
    }
    requireNonEmpty(profile.preprocessing.id, `profile ${profile.id} preprocessing id`);
    if (ids.has(profile.id)) throw new Error(`Duplicate dense profile id: ${profile.id}`);
    ids.add(profile.id);
  }
}

export function prepareDenseInput(
  text: string,
  profile: DenseEmbeddingProfile,
  kind: DenseInputKind,
): string {
  requireNonEmpty(text, "dense input text");
  let normalized = text;
  if (profile.preprocessing.collapseWhitespace) {
    normalized = normalized.replace(/\s+/gu, " ").trim();
  }
  const prefix = kind === "query"
    ? profile.preprocessing.queryPrefix
    : profile.preprocessing.documentPrefix;
  return `${prefix}${normalized}`;
}

/**
 * Executes one adapter call while enforcing the explicit profile metadata and
 * dimensionality contract needed for comparable P2 evaluation.
 */
export async function embedDenseInputs(
  adapter: DenseEmbeddingAdapter,
  inputs: readonly string[],
  kind: DenseInputKind,
  signal: AbortSignal,
): Promise<readonly Float32Array[]> {
  validateDenseExperimentProfiles([adapter.profile]);
  if (signal.aborted) throw abortReason(signal);
  if (inputs.length === 0) return [];

  const prepared = inputs.map((input) => prepareDenseInput(input, adapter.profile, kind));
  const vectors = await adapter.embed(prepared, kind, signal);
  if (signal.aborted) throw abortReason(signal);
  if (vectors.length !== prepared.length) {
    throw new Error("Dense adapter returned a vector count that does not match the input count");
  }
  for (const vector of vectors) validateVector(vector, adapter.profile.dimensions, "dense adapter vector");
  return vectors;
}

/**
 * Brute-force in-memory index used only to evaluate embedding quality before
 * P2-T07 decides whether sqlite-vec is deployable. SourceVersion filtering is
 * applied before ranking and Top-K.
 */
export class InMemoryDenseEvaluationIndex {
  constructor(
    private readonly profile: DenseEmbeddingProfile,
    private readonly chunks: readonly DenseIndexedChunk[],
  ) {
    validateDenseExperimentProfiles([profile]);
    for (const chunk of chunks) {
      requireNonEmpty(chunk.chunkId, "chunkId");
      requireNonEmpty(chunk.sourceVersionId, "sourceVersionId");
      requireNonEmpty(chunk.parsedArtifactId, "parsedArtifactId");
      if (
        !Number.isSafeInteger(chunk.startByte)
        || !Number.isSafeInteger(chunk.endByte)
        || chunk.startByte < 0
        || chunk.endByte <= chunk.startByte
      ) {
        throw new TypeError(`Dense chunk ${chunk.chunkId} has an invalid UTF-8 byte range`);
      }
      validateVector(chunk.vector, profile.dimensions, `dense chunk ${chunk.chunkId} vector`);
    }
  }

  search(input: DenseSearchInput): DenseSearchHit[] {
    validateVector(input.queryVector, this.profile.dimensions, "dense query vector");
    const limit = input.limit ?? DEFAULT_LIMIT;
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > MAX_LIMIT) {
      throw new TypeError(`limit must be an integer between 1 and ${String(MAX_LIMIT)}`);
    }

    const allowed = input.allowedSourceVersionIds;
    if (allowed !== undefined && allowed.length === 0) return [];
    const allowedSet = allowed === undefined ? undefined : new Set(allowed.map((id) => requireIdentity(id)));

    return this.chunks
      .filter((chunk) => allowedSet === undefined || allowedSet.has(chunk.sourceVersionId))
      .map((chunk) => ({
        chunkId: chunk.chunkId,
        sourceVersionId: chunk.sourceVersionId,
        parsedArtifactId: chunk.parsedArtifactId,
        startByte: chunk.startByte,
        endByte: chunk.endByte,
        score: cosineSimilarity(input.queryVector, chunk.vector),
      }))
      .sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId))
      .slice(0, limit);
  }
}

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  if (leftNorm === 0 || rightNorm === 0) throw new Error("Dense cosine similarity requires non-zero vectors");
  return dot / Math.sqrt(leftNorm * rightNorm);
}

function validateVector(vector: Float32Array, dimensions: number, label: string): void {
  if (vector.length !== dimensions) {
    throw new Error(`${label} dimension mismatch: expected ${String(dimensions)}, received ${String(vector.length)}`);
  }
  let nonZero = false;
  for (const value of vector) {
    if (!Number.isFinite(value)) throw new TypeError(`${label} must contain only finite values`);
    if (value !== 0) nonZero = true;
  }
  if (!nonZero) throw new Error(`${label} must not be the zero vector`);
}

function requireIdentity(value: string): string {
  requireNonEmpty(value, "allowedSourceVersionId");
  return value;
}

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new TypeError(`${label} must not be empty`);
}

function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new Error("Dense embedding operation was cancelled", { cause: reason });
}
