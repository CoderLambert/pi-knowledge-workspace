import type { GoldenDataset, GoldenDatasetSplit, GoldenQueryCategory } from "./goldenDataset.js";
import {
  evaluateFtsBaseline,
  type FtsBaselineObservation,
  type FtsBaselineResources,
  type FtsBaselineReport,
} from "./ftsBaselineEvaluation.js";

export interface RetrievalBenchmarkVariant {
  id: string;
  label: string;
  configRevision: string;
  observations: readonly FtsBaselineObservation[];
  resources: FtsBaselineResources;
}

export interface RetrievalBenchmarkVariantReport {
  id: string;
  label: string;
  configRevision: string;
  metrics: FtsBaselineReport;
  missedAnswerableQueryIds: readonly string[];
  noAnswerQueryIdsWithAnyHit: readonly string[];
}

export interface RetrievalBenchmarkReport {
  schemaVersion: 1;
  split: GoldenDatasetSplit;
  queryCount: number;
  variants: readonly RetrievalBenchmarkVariantReport[];
}

/**
 * P2-T09 backend-agnostic benchmark orchestration. Ground truth remains
 * Stable Evidence byte ranges from the Golden Dataset. The caller supplies
 * already-recorded ranked retrieval observations; this runner owns validation,
 * metric computation and deterministic report rendering only.
 */
export function runRetrievalBenchmark(
  dataset: GoldenDataset,
  split: GoldenDatasetSplit,
  variants: readonly RetrievalBenchmarkVariant[],
): RetrievalBenchmarkReport {
  if (variants.length === 0) throw new Error("Retrieval benchmark requires at least one variant");

  const scopedDataset = datasetForSplit(dataset, split);
  const seenVariantIds = new Set<string>();
  const reports = variants.map((variant) => {
    requireNonEmpty(variant.id, "variant id");
    requireNonEmpty(variant.label, "variant label");
    requireNonEmpty(variant.configRevision, "variant configRevision");
    if (seenVariantIds.has(variant.id)) throw new Error(`Duplicate retrieval benchmark variant: ${variant.id}`);
    seenVariantIds.add(variant.id);

    const allowedQueryIds = new Set(scopedDataset.queries.map((query) => query.id));
    for (const observation of variant.observations) {
      if (!allowedQueryIds.has(observation.queryId)) {
        throw new Error(`Variant ${variant.id} contains observation outside ${split} split: ${observation.queryId}`);
      }
    }

    const metrics = evaluateFtsBaseline(scopedDataset, variant.observations, variant.resources);
    return {
      id: variant.id,
      label: variant.label,
      configRevision: variant.configRevision,
      metrics,
      missedAnswerableQueryIds: collectMissedAnswerableQueries(scopedDataset, variant.observations),
      noAnswerQueryIdsWithAnyHit: scopedDataset.queries
        .filter((query) => query.categories.includes("no-answer"))
        .filter((query) => observationFor(variant.observations, query.id).hits.length > 0)
        .map((query) => query.id),
    } satisfies RetrievalBenchmarkVariantReport;
  });

  return {
    schemaVersion: 1,
    split,
    queryCount: scopedDataset.queries.length,
    variants: reports,
  };
}

export function renderRetrievalBenchmarkMarkdown(report: RetrievalBenchmarkReport): string {
  const lines = [
    "# Retrieval benchmark report",
    "",
    `Split: **${report.split}**`,
    `Queries: **${String(report.queryCount)}**`,
    "",
    "| Variant | Revision | Recall@10 | MRR | All-required coverage | p95 ms | Peak RSS bytes | Index bytes |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const variant of report.variants) {
    const metrics = variant.metrics;
    lines.push(
      `| ${escapeCell(variant.label)} | ${escapeCell(variant.configRevision)} | ${formatRatio(metrics.recallAt10)} | ${formatRatio(metrics.mrr)} | ${formatRatio(metrics.allRequiredEvidenceCoverage)} | ${formatNumber(metrics.latencyMs.p95)} | ${String(metrics.resources.peakRssBytes)} | ${String(metrics.resources.indexBytes)} |`,
    );
  }

  for (const variant of report.variants) {
    lines.push("", `## ${variant.label}`, "", `Variant id: \`${variant.id}\``, `Revision: \`${variant.configRevision}\``);
    lines.push("", "### Category failures", "");
    const failures = sortedCategoryFailures(variant.metrics.categoryFailureCounts);
    if (failures.length === 0) {
      lines.push("None.");
    } else {
      for (const [category, count] of failures) lines.push(`- ${category}: ${String(count)}`);
    }
    lines.push("", "### Missed answerable queries", "");
    lines.push(variant.missedAnswerableQueryIds.length === 0 ? "None." : variant.missedAnswerableQueryIds.map((id) => `- ${id}`).join("\n"));
    lines.push("", "### No-answer queries with lexical/vector hits", "");
    lines.push(variant.noAnswerQueryIdsWithAnyHit.length === 0 ? "None." : variant.noAnswerQueryIdsWithAnyHit.map((id) => `- ${id}`).join("\n"));
  }

  return `${lines.join("\n")}\n`;
}

function datasetForSplit(dataset: GoldenDataset, split: GoldenDatasetSplit): GoldenDataset {
  const queries = dataset.queries.filter((query) => query.split === split);
  if (queries.length === 0) throw new Error(`Golden Dataset has no ${split} queries`);
  const queryIds = new Set(queries.map((query) => query.id));
  return {
    schemaVersion: dataset.schemaVersion,
    corpus: dataset.corpus,
    queries,
    labels: dataset.labels.filter((label) => queryIds.has(label.queryId)),
  };
}

function collectMissedAnswerableQueries(
  dataset: GoldenDataset,
  observations: readonly FtsBaselineObservation[],
): string[] {
  const labelsByQuery = new Map<string, GoldenDataset["labels"]>();
  for (const query of dataset.queries) labelsByQuery.set(query.id, []);
  for (const label of dataset.labels) {
    labelsByQuery.set(label.queryId, [...(labelsByQuery.get(label.queryId) ?? []), label]);
  }

  return dataset.queries
    .filter((query) => !query.categories.includes("no-answer"))
    .filter((query) => {
      const required = (labelsByQuery.get(query.id) ?? []).filter((label) => label.importance === "required");
      return !observationFor(observations, query.id).hits.slice(0, 10).some((hit) => required.some((label) => (
        hit.sourceVersionId === label.sourceVersionId
        && hit.locator.parsedArtifactId === label.parsedArtifactId
        && hit.locator.startByte < label.endByte
        && hit.locator.endByte > label.startByte
      )));
    })
    .map((query) => query.id);
}

function observationFor(observations: readonly FtsBaselineObservation[], queryId: string): FtsBaselineObservation {
  const observation = observations.find((candidate) => candidate.queryId === queryId);
  if (observation === undefined) throw new Error(`Missing retrieval observation: ${queryId}`);
  return observation;
}

function sortedCategoryFailures(
  failures: Partial<Record<GoldenQueryCategory, number>>,
): [GoldenQueryCategory, number][] {
  return (Object.entries(failures) as [GoldenQueryCategory, number][])
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right));
}

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new TypeError(`${label} must be non-empty`);
}

function formatRatio(value: number): string {
  return value.toFixed(4);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
