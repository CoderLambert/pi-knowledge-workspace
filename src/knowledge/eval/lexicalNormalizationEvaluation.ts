import type { GoldenDataset } from "./goldenDataset.js";
import {
  evaluateFtsBaseline,
  type FtsBaselineObservation,
  type FtsBaselineReport,
  type FtsBaselineResources,
} from "./ftsBaselineEvaluation.js";
import {
  LEXICAL_NORMALIZATION_PROFILES,
  type LexicalNormalizationProfileId,
} from "./lexicalNormalization.js";

export interface LexicalNormalizationRun {
  profileId: LexicalNormalizationProfileId;
  observations: readonly FtsBaselineObservation[];
  resources: FtsBaselineResources;
}

export interface LexicalNormalizationComparison {
  profileId: LexicalNormalizationProfileId;
  report: FtsBaselineReport;
  deltaFromBaseline: {
    recallAt10: number;
    mrr: number;
    allRequiredEvidenceCoverage: number;
    p95LatencyMs: number;
    indexBytes: number;
  };
}

export interface LexicalNormalizationExperimentReport {
  split: "development";
  queryCount: number;
  comparisons: readonly LexicalNormalizationComparison[];
}

/**
 * Compares P2-T05 profiles on the development split only. Holdout data is
 * deliberately excluded so profile selection cannot tune against it.
 */
export function evaluateLexicalNormalizationDevelopment(
  dataset: GoldenDataset,
  runs: readonly LexicalNormalizationRun[],
): LexicalNormalizationExperimentReport {
  const developmentDataset = selectDevelopmentDataset(dataset);
  const runsByProfile = new Map<LexicalNormalizationProfileId, LexicalNormalizationRun>();

  for (const run of runs) {
    if (runsByProfile.has(run.profileId)) {
      throw new Error(`Duplicate lexical normalization run: ${run.profileId}`);
    }
    runsByProfile.set(run.profileId, run);
  }

  const baselineRun = runsByProfile.get("baseline");
  if (baselineRun === undefined) throw new Error("Lexical normalization experiment requires a baseline run");

  const baseline = evaluateFtsBaseline(
    developmentDataset,
    baselineRun.observations,
    baselineRun.resources,
  );

  const comparisons: LexicalNormalizationComparison[] = [];
  for (const profile of LEXICAL_NORMALIZATION_PROFILES) {
    const run = runsByProfile.get(profile.id);
    if (run === undefined) continue;

    const report = profile.id === "baseline"
      ? baseline
      : evaluateFtsBaseline(developmentDataset, run.observations, run.resources);

    comparisons.push({
      profileId: profile.id,
      report,
      deltaFromBaseline: {
        recallAt10: report.recallAt10 - baseline.recallAt10,
        mrr: report.mrr - baseline.mrr,
        allRequiredEvidenceCoverage:
          report.allRequiredEvidenceCoverage - baseline.allRequiredEvidenceCoverage,
        p95LatencyMs: report.latencyMs.p95 - baseline.latencyMs.p95,
        indexBytes: report.resources.indexBytes - baseline.resources.indexBytes,
      },
    });
  }

  return {
    split: "development",
    queryCount: developmentDataset.queries.length,
    comparisons,
  };
}

function selectDevelopmentDataset(dataset: GoldenDataset): GoldenDataset {
  const queries = dataset.queries.filter((query) => query.split === "development");
  if (queries.length === 0) throw new Error("Lexical normalization experiment requires development queries");
  const queryIds = new Set(queries.map((query) => query.id));

  return {
    schemaVersion: dataset.schemaVersion,
    corpus: dataset.corpus,
    queries,
    labels: dataset.labels.filter((label) => queryIds.has(label.queryId)),
  };
}
