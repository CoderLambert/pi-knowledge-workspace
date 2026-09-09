import type { GoldenDataset, GoldenQueryCategory } from "./goldenDataset.js";
import { validateGoldenDataset } from "./goldenDataset.js";
import type { SearchQueryHit } from "../storage/searchQuery.js";

export interface FtsBaselineObservation {
  queryId: string;
  latencyMs: number;
  hits: readonly Pick<SearchQueryHit, "sourceVersionId" | "locator">[];
}

export interface FtsBaselineResources {
  peakRssBytes: number;
  indexBytes: number;
}

export interface FtsBaselineReport {
  queryCount: number;
  scoredAnswerableQueries: number;
  noAnswerQueries: number;
  noAnswerQueriesWithAnyHit: number;
  recallAt10: number;
  mrr: number;
  allRequiredEvidenceCoverage: number;
  categoryFailureCounts: Partial<Record<GoldenQueryCategory, number>>;
  latencyMs: {
    median: number;
    p95: number;
    max: number;
  };
  resources: FtsBaselineResources;
}

const TOP_K = 10;

/**
 * Computes the P2-T04 lexical baseline metrics from recorded SearchQuery API
 * observations. It deliberately does not own index construction, query tuning,
 * or generic benchmark orchestration; P2-T09 may automate those later.
 */
export function evaluateFtsBaseline(
  dataset: GoldenDataset,
  observations: readonly FtsBaselineObservation[],
  resources: FtsBaselineResources,
): FtsBaselineReport {
  validateGoldenDataset(dataset);
  validateResources(resources);

  const queries = new Map(dataset.queries.map((query) => [query.id, query]));
  const labelsByQuery = new Map<string, typeof dataset.labels>();
  for (const query of dataset.queries) labelsByQuery.set(query.id, []);
  for (const label of dataset.labels) {
    const current = labelsByQuery.get(label.queryId) ?? [];
    labelsByQuery.set(label.queryId, [...current, label]);
  }

  const observationByQuery = new Map<string, FtsBaselineObservation>();
  for (const observation of observations) {
    if (!queries.has(observation.queryId)) {
      throw new Error(`FTS observation references unknown query: ${observation.queryId}`);
    }
    if (observationByQuery.has(observation.queryId)) {
      throw new Error(`Duplicate FTS observation for query: ${observation.queryId}`);
    }
    if (!Number.isFinite(observation.latencyMs) || observation.latencyMs < 0) {
      throw new TypeError(`FTS observation latency must be a non-negative finite number: ${observation.queryId}`);
    }
    observationByQuery.set(observation.queryId, observation);
  }

  if (observationByQuery.size !== dataset.queries.length) {
    const missing = dataset.queries.find((query) => !observationByQuery.has(query.id));
    throw new Error(`FTS observations must cover every query; missing ${missing?.id ?? "unknown"}`);
  }

  let scoredAnswerableQueries = 0;
  let noAnswerQueries = 0;
  let noAnswerQueriesWithAnyHit = 0;
  let recalledQueries = 0;
  let reciprocalRankSum = 0;
  let allRequiredEvidenceQueries = 0;
  const categoryFailureCounts: Partial<Record<GoldenQueryCategory, number>> = {};

  for (const query of dataset.queries) {
    const observation = observationByQuery.get(query.id);
    if (observation === undefined) throw new Error(`Missing FTS observation: ${query.id}`);

    if (query.categories.includes("no-answer")) {
      noAnswerQueries += 1;
      if (observation.hits.length > 0) noAnswerQueriesWithAnyHit += 1;
      continue;
    }

    scoredAnswerableQueries += 1;
    const requiredLabels = (labelsByQuery.get(query.id) ?? []).filter((label) => label.importance === "required");
    const topHits = observation.hits.slice(0, TOP_K);
    const firstRelevantIndex = topHits.findIndex((hit) => requiredLabels.some((label) => hitCoversLabel(hit, label)));

    if (firstRelevantIndex >= 0) {
      recalledQueries += 1;
      reciprocalRankSum += 1 / (firstRelevantIndex + 1);
    } else {
      for (const category of query.categories) {
        categoryFailureCounts[category] = (categoryFailureCounts[category] ?? 0) + 1;
      }
    }

    if (requiredLabels.every((label) => topHits.some((hit) => hitCoversLabel(hit, label)))) {
      allRequiredEvidenceQueries += 1;
    }
  }

  const latencies = observations.map((observation) => observation.latencyMs).sort((left, right) => left - right);
  return {
    queryCount: dataset.queries.length,
    scoredAnswerableQueries,
    noAnswerQueries,
    noAnswerQueriesWithAnyHit,
    recallAt10: scoredAnswerableQueries === 0 ? 0 : recalledQueries / scoredAnswerableQueries,
    mrr: scoredAnswerableQueries === 0 ? 0 : reciprocalRankSum / scoredAnswerableQueries,
    allRequiredEvidenceCoverage: scoredAnswerableQueries === 0
      ? 0
      : allRequiredEvidenceQueries / scoredAnswerableQueries,
    categoryFailureCounts,
    latencyMs: {
      median: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.at(-1) ?? 0,
    },
    resources,
  };
}

function hitCoversLabel(
  hit: Pick<SearchQueryHit, "sourceVersionId" | "locator">,
  label: GoldenDataset["labels"][number],
): boolean {
  return hit.sourceVersionId === label.sourceVersionId
    && hit.locator.parsedArtifactId === label.parsedArtifactId
    && hit.locator.startByte < label.endByte
    && hit.locator.endByte > label.startByte;
}

function percentile(sortedValues: readonly number[], quantile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(0, Math.ceil(sortedValues.length * quantile) - 1);
  return sortedValues[index] ?? 0;
}

function validateResources(resources: FtsBaselineResources): void {
  for (const [name, value] of Object.entries(resources)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`${name} must be a non-negative safe integer`);
    }
  }
}
