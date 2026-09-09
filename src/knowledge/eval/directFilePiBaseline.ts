import type { GoldenDataset, GoldenDatasetSplit, GoldenEvidenceLabel } from "./goldenDataset.js";
import { validateGoldenDataset } from "./goldenDataset.js";

export interface DirectFilePiTaskFile {
  relativePath: string;
  sourceVersionId: string;
  parsedArtifactId: string;
}

export interface DirectFilePiTask {
  queryId: string;
  query: string;
  split: GoldenDatasetSplit;
  files: readonly DirectFilePiTaskFile[];
}

export interface DirectFilePiCitation {
  sourceVersionId: string;
  parsedArtifactId: string;
  startByte: number;
  endByte: number;
}

export interface DirectFilePiObservation {
  queryId: string;
  latencyMs: number;
  insufficientEvidence: boolean;
  citations: readonly DirectFilePiCitation[];
  unmappedCitationCount: number;
}

export interface DirectFilePiBaselineReport {
  split: GoldenDatasetSplit;
  queryCount: number;
  answerableQueries: number;
  noAnswerQueries: number;
  anyRequiredEvidenceCoverage: number;
  allRequiredEvidenceCoverage: number;
  noAnswerCorrectAbstentionRate: number;
  citationPrecision: number;
  latencyMs: {
    median: number;
    p95: number;
    max: number;
  };
}

/**
 * Builds the direct-file product baseline without leaking Golden Evidence
 * labels into the model input. Every task receives the same fixed corpus
 * snapshots and the original user query, with no retrieval ranking.
 */
export function buildDirectFilePiTasks(
  dataset: GoldenDataset,
  split: GoldenDatasetSplit,
): DirectFilePiTask[] {
  validateGoldenDataset(dataset);
  const files = dataset.corpus
    .map((artifact) => ({
      relativePath: artifact.relativePath,
      sourceVersionId: artifact.parsedArtifact.sourceVersionId,
      parsedArtifactId: artifact.parsedArtifact.parsedArtifactId,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const queries = dataset.queries.filter((query) => query.split === split);
  if (queries.length === 0) throw new Error(`Golden Dataset contains no ${split} queries`);

  return queries.map((query) => ({
    queryId: query.id,
    query: query.text,
    split,
    files,
  }));
}

/**
 * Deterministic citation/abstention scoring for recorded direct-file Pi runs.
 * Semantic answer correctness remains a separate human-review dimension.
 */
export function evaluateDirectFilePiBaseline(
  dataset: GoldenDataset,
  split: GoldenDatasetSplit,
  observations: readonly DirectFilePiObservation[],
): DirectFilePiBaselineReport {
  validateGoldenDataset(dataset);
  const queries = dataset.queries.filter((query) => query.split === split);
  if (queries.length === 0) throw new Error(`Golden Dataset contains no ${split} queries`);
  const queryById = new Map(queries.map((query) => [query.id, query]));
  const labelsByQuery = new Map<string, GoldenEvidenceLabel[]>();
  for (const query of queries) labelsByQuery.set(query.id, []);
  for (const label of dataset.labels) {
    if (!queryById.has(label.queryId)) continue;
    const labels = labelsByQuery.get(label.queryId);
    if (labels !== undefined) labels.push(label);
  }

  const observationById = new Map<string, DirectFilePiObservation>();
  for (const observation of observations) {
    if (!queryById.has(observation.queryId)) {
      throw new Error(`Direct-file observation references unknown query: ${observation.queryId}`);
    }
    if (observationById.has(observation.queryId)) {
      throw new Error(`Duplicate direct-file observation: ${observation.queryId}`);
    }
    if (!Number.isFinite(observation.latencyMs) || observation.latencyMs < 0) {
      throw new TypeError(`Direct-file latency must be non-negative: ${observation.queryId}`);
    }
    if (!Number.isSafeInteger(observation.unmappedCitationCount) || observation.unmappedCitationCount < 0) {
      throw new TypeError(`Direct-file unmapped citation count must be a non-negative integer: ${observation.queryId}`);
    }
    for (const citation of observation.citations) validateCitation(citation);
    observationById.set(observation.queryId, observation);
  }

  if (observationById.size !== queries.length) {
    const missing = queries.find((query) => !observationById.has(query.id));
    throw new Error(`Direct-file observations must cover every ${split} query; missing ${missing?.id ?? "unknown"}`);
  }

  let answerableQueries = 0;
  let noAnswerQueries = 0;
  let anyRequiredCovered = 0;
  let allRequiredCovered = 0;
  let correctAbstentions = 0;
  let relevantCitations = 0;
  let totalCitations = 0;

  for (const query of queries) {
    const observation = observationById.get(query.id);
    if (observation === undefined) {
      throw new Error(`Direct-file observations must cover every ${split} query; missing ${query.id}`);
    }
    const labels = labelsByQuery.get(query.id) ?? [];
    const required = labels.filter((label) => label.importance === "required");

    if (query.categories.includes("no-answer")) {
      noAnswerQueries += 1;
      if (
        observation.insufficientEvidence
        && observation.citations.length === 0
        && observation.unmappedCitationCount === 0
      ) {
        correctAbstentions += 1;
      }
    } else {
      answerableQueries += 1;
      if (required.some((label) => observation.citations.some((citation) => citationOverlapsLabel(citation, label)))) {
        anyRequiredCovered += 1;
      }
      if (required.every((label) => observation.citations.some((citation) => citationOverlapsLabel(citation, label)))) {
        allRequiredCovered += 1;
      }
    }

    totalCitations += observation.citations.length + observation.unmappedCitationCount;
    for (const citation of observation.citations) {
      if (labels.some((label) => citationOverlapsLabel(citation, label))) relevantCitations += 1;
    }
  }

  const latencies = observations.map((observation) => observation.latencyMs).sort((left, right) => left - right);
  return {
    split,
    queryCount: queries.length,
    answerableQueries,
    noAnswerQueries,
    anyRequiredEvidenceCoverage: answerableQueries === 0 ? 0 : anyRequiredCovered / answerableQueries,
    allRequiredEvidenceCoverage: answerableQueries === 0 ? 0 : allRequiredCovered / answerableQueries,
    noAnswerCorrectAbstentionRate: noAnswerQueries === 0 ? 0 : correctAbstentions / noAnswerQueries,
    citationPrecision: totalCitations === 0 ? 0 : relevantCitations / totalCitations,
    latencyMs: {
      median: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.at(-1) ?? 0,
    },
  };
}

function citationOverlapsLabel(citation: DirectFilePiCitation, label: GoldenEvidenceLabel): boolean {
  return citation.sourceVersionId === label.sourceVersionId
    && citation.parsedArtifactId === label.parsedArtifactId
    && citation.startByte < label.endByte
    && citation.endByte > label.startByte;
}

function validateCitation(citation: DirectFilePiCitation): void {
  if (citation.sourceVersionId.trim().length === 0 || citation.parsedArtifactId.trim().length === 0) {
    throw new TypeError("Direct-file citation identities must not be empty");
  }
  if (
    !Number.isSafeInteger(citation.startByte)
    || !Number.isSafeInteger(citation.endByte)
    || citation.startByte < 0
    || citation.endByte <= citation.startByte
  ) {
    throw new TypeError("Direct-file citation has an invalid UTF-8 byte range");
  }
}

function percentile(sortedValues: readonly number[], quantile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(0, Math.ceil(sortedValues.length * quantile) - 1);
  return sortedValues[index] ?? 0;
}
