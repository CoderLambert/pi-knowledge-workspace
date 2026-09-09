export const GOLDEN_DATASET_SCHEMA_VERSION = 1 as const;

export type GoldenDatasetSplit = "development" | "holdout";
export type GoldenLanguage = "zh" | "en" | "mixed";
export type GoldenEvidenceImportance = "required" | "supporting";

export const GOLDEN_QUERY_CATEGORIES = [
  "exact-api",
  "version-error-code",
  "semantic",
  "chinese",
  "english",
  "chinese-english-mixed",
  "code-symbol",
  "multi-source",
  "conflict",
  "no-answer",
] as const;

export type GoldenQueryCategory = (typeof GOLDEN_QUERY_CATEGORIES)[number];

export interface GoldenCorpusArtifact {
  schemaVersion: 1;
  id: string;
  relativePath: string;
  mediaType: "text/markdown" | "text/plain";
  language: GoldenLanguage;
  source: {
    title: string;
    uri: string;
    capturedAt: string;
    version: string;
  };
  parsedArtifact: {
    parsedArtifactId: string;
    sourceVersionId: string;
    parserFingerprint: string;
    normalizationFingerprint: string;
    canonicalTextSha256: string;
  };
}

export interface GoldenQuery {
  schemaVersion: 1;
  id: string;
  text: string;
  split: GoldenDatasetSplit;
  categories: readonly GoldenQueryCategory[];
  notes?: string;
}

export interface GoldenEvidenceLabel {
  schemaVersion: 1;
  id: string;
  queryId: string;
  importance: GoldenEvidenceImportance;
  parsedArtifactId: string;
  sourceVersionId: string;
  startByte: number;
  endByte: number;
  exactQuote: string;
  quoteHash: string;
  notes?: string;
}

export interface GoldenDataset {
  schemaVersion: 1;
  corpus: readonly GoldenCorpusArtifact[];
  queries: readonly GoldenQuery[];
  labels: readonly GoldenEvidenceLabel[];
}

const SHA256 = /^[0-9a-f]{64}$/u;
const CATEGORY_SET = new Set<string>(GOLDEN_QUERY_CATEGORIES);

/**
 * Validates the committed retrieval-evaluation contract without depending on
 * a retrieval implementation. Labels address immutable ParsedArtifact UTF-8
 * byte ranges and intentionally have no Chunk identity.
 */
export function validateGoldenDataset(input: GoldenDataset): void {
  if (input.schemaVersion !== GOLDEN_DATASET_SCHEMA_VERSION) {
    throw new Error(`Unsupported Golden Dataset schema version: ${String(input.schemaVersion)}`);
  }

  const corpusIds = new Set<string>();
  const artifacts = new Map<string, GoldenCorpusArtifact>();
  for (const artifact of input.corpus) {
    validateCorpusArtifact(artifact);
    unique(corpusIds, artifact.id, "corpus id");
    if (artifacts.has(artifact.parsedArtifact.parsedArtifactId)) {
      throw new Error(`Duplicate ParsedArtifact id: ${artifact.parsedArtifact.parsedArtifactId}`);
    }
    artifacts.set(artifact.parsedArtifact.parsedArtifactId, artifact);
  }

  const queries = new Map<string, GoldenQuery>();
  for (const query of input.queries) {
    validateQuery(query);
    if (queries.has(query.id)) throw new Error(`Duplicate query id: ${query.id}`);
    queries.set(query.id, query);
  }

  const labelIds = new Set<string>();
  const labelsByQuery = new Map<string, GoldenEvidenceLabel[]>();
  for (const label of input.labels) {
    validateLabel(label);
    unique(labelIds, label.id, "label id");

    const query = queries.get(label.queryId);
    if (query === undefined) throw new Error(`Label ${label.id} references unknown query: ${label.queryId}`);
    if (query.categories.includes("no-answer")) {
      throw new Error(`No-answer query ${query.id} must not have Evidence labels`);
    }

    const artifact = artifacts.get(label.parsedArtifactId);
    if (artifact === undefined) {
      throw new Error(`Label ${label.id} references unknown ParsedArtifact: ${label.parsedArtifactId}`);
    }
    if (artifact.parsedArtifact.sourceVersionId !== label.sourceVersionId) {
      throw new Error(`Label ${label.id} SourceVersion does not match its ParsedArtifact lineage`);
    }

    const labels = labelsByQuery.get(label.queryId) ?? [];
    labels.push(label);
    labelsByQuery.set(label.queryId, labels);
  }

  for (const query of input.queries) {
    const labels = labelsByQuery.get(query.id) ?? [];
    if (query.categories.includes("no-answer")) continue;
    if (!labels.some((label) => label.importance === "required")) {
      throw new Error(`Answerable query ${query.id} must have at least one required Evidence label`);
    }
  }
}

function validateCorpusArtifact(artifact: GoldenCorpusArtifact): void {
  requireVersion(artifact.schemaVersion, "Corpus artifact");
  nonEmpty(artifact.id, "corpus id");
  safeRelativePath(artifact.relativePath, "corpus relativePath");
  if (artifact.mediaType !== "text/markdown" && artifact.mediaType !== "text/plain") {
    throw new Error(`Unsupported corpus mediaType: ${String(artifact.mediaType)}`);
  }
  if (artifact.language !== "zh" && artifact.language !== "en" && artifact.language !== "mixed") {
    throw new Error(`Unsupported corpus language: ${String(artifact.language)}`);
  }
  nonEmpty(artifact.source.title, "source title");
  nonEmpty(artifact.source.uri, "source uri");
  nonEmpty(artifact.source.version, "source version");
  timestamp(artifact.source.capturedAt, "source capturedAt");
  nonEmpty(artifact.parsedArtifact.parsedArtifactId, "parsedArtifactId");
  nonEmpty(artifact.parsedArtifact.sourceVersionId, "sourceVersionId");
  nonEmpty(artifact.parsedArtifact.parserFingerprint, "parserFingerprint");
  nonEmpty(artifact.parsedArtifact.normalizationFingerprint, "normalizationFingerprint");
  sha256(artifact.parsedArtifact.canonicalTextSha256, "canonicalTextSha256");
  rejectChunkIdentity(artifact as unknown as Record<string, unknown>, `Corpus artifact ${artifact.id}`);
}

function validateQuery(query: GoldenQuery): void {
  requireVersion(query.schemaVersion, "Query");
  nonEmpty(query.id, "query id");
  nonEmpty(query.text, "query text");
  if (query.split !== "development" && query.split !== "holdout") {
    throw new Error(`Unsupported query split: ${String(query.split)}`);
  }
  if (query.categories.length === 0) throw new Error(`Query ${query.id} must have at least one category`);
  const seen = new Set<string>();
  for (const category of query.categories) {
    if (!CATEGORY_SET.has(category)) throw new Error(`Unsupported query category: ${String(category)}`);
    unique(seen, category, `query ${query.id} category`);
  }
  if (query.categories.includes("no-answer") && query.categories.includes("conflict")) {
    throw new Error(`Query ${query.id} cannot be both conflict and no-answer`);
  }
  optionalNonEmpty(query.notes, "query notes");
  rejectChunkIdentity(query as unknown as Record<string, unknown>, `Query ${query.id}`);
}

function validateLabel(label: GoldenEvidenceLabel): void {
  requireVersion(label.schemaVersion, "Evidence label");
  nonEmpty(label.id, "label id");
  nonEmpty(label.queryId, "label queryId");
  if (label.importance !== "required" && label.importance !== "supporting") {
    throw new Error(`Unsupported Evidence label importance: ${String(label.importance)}`);
  }
  nonEmpty(label.parsedArtifactId, "label parsedArtifactId");
  nonEmpty(label.sourceVersionId, "label sourceVersionId");
  if (!Number.isSafeInteger(label.startByte) || label.startByte < 0) {
    throw new Error(`Label ${label.id} startByte must be a non-negative safe integer`);
  }
  if (!Number.isSafeInteger(label.endByte) || label.endByte <= label.startByte) {
    throw new Error(`Label ${label.id} endByte must be greater than startByte`);
  }
  nonEmpty(label.exactQuote, "label exactQuote");
  sha256(label.quoteHash, "label quoteHash");
  optionalNonEmpty(label.notes, "label notes");
  rejectChunkIdentity(label as unknown as Record<string, unknown>, `Evidence label ${label.id}`);
}

function rejectChunkIdentity(record: Record<string, unknown>, label: string): void {
  for (const key of Object.keys(record)) {
    if (/^chunk(?:Id|_id)$/iu.test(key)) {
      throw new Error(`${label} must not persist Chunk identity`);
    }
  }
}

function requireVersion(value: number, label: string): void {
  if (value !== GOLDEN_DATASET_SCHEMA_VERSION) {
    throw new Error(`${label} schemaVersion must be ${String(GOLDEN_DATASET_SCHEMA_VERSION)}`);
  }
}

function nonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must be non-empty`);
}

function optionalNonEmpty(value: string | undefined, label: string): void {
  if (value !== undefined) nonEmpty(value, label);
}

function timestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be an ISO-compatible timestamp`);
}

function sha256(value: string, label: string): void {
  if (!SHA256.test(value)) throw new Error(`${label} must be a lowercase SHA-256 hash`);
}

function safeRelativePath(value: string, label: string): void {
  nonEmpty(value, label);
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${label} must be a canonical safe relative path`);
  }
}

function unique(values: Set<string>, value: string, label: string): void {
  if (values.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
  values.add(value);
}
