import type { GoldenDataset, GoldenDatasetSplit, GoldenQueryCategory } from "./goldenDataset.js";
import {
  evaluateFtsBaseline,
  type FtsBaselineObservation,
  type FtsBaselineReport,
  type FtsBaselineResources,
} from "./ftsBaselineEvaluation.js";

export type BenchmarkConfigurationValue = string | number | boolean | null;

export interface RetrievalBenchmarkVariant {
  id: string;
  configuration: Readonly<Record<string, BenchmarkConfigurationValue>>;
  observations: readonly FtsBaselineObservation[];
  resources: FtsBaselineResources;
}

export interface RetrievalBenchmarkVariantReport {
  id: string;
  configuration: Readonly<Record<string, BenchmarkConfigurationValue>>;
  metrics: FtsBaselineReport;
}

export interface RetrievalBenchmarkReport {
  schemaVersion: 1;
  split: GoldenDatasetSplit;
  generatedAt: string;
  queryCount: number;
  variants: readonly RetrievalBenchmarkVariantReport[];
}

/**
 * Reproducible P2 report generator. It consumes already-recorded retrieval
 * observations and never runs retrieval or tunes configurations itself.
 */
export function runRetrievalBenchmark(
  dataset: GoldenDataset,
  split: GoldenDatasetSplit,
  generatedAt: string,
  variants: readonly RetrievalBenchmarkVariant[],
): RetrievalBenchmarkReport {
  requireTimestamp(generatedAt);
  if (variants.length === 0) throw new Error("Retrieval benchmark requires at least one variant");

  const selectedDataset = selectSplit(dataset, split);
  const seen = new Set<string>();
  const reports: RetrievalBenchmarkVariantReport[] = [];

  for (const variant of variants) {
    const id = requireNonEmpty(variant.id, "benchmark variant id");
    if (seen.has(id)) throw new Error(`Duplicate benchmark variant id: ${id}`);
    seen.add(id);
    validateConfiguration(variant.configuration, id);

    reports.push({
      id,
      configuration: canonicalConfiguration(variant.configuration),
      metrics: evaluateFtsBaseline(selectedDataset, variant.observations, variant.resources),
    });
  }

  return {
    schemaVersion: 1,
    split,
    generatedAt,
    queryCount: selectedDataset.queries.length,
    variants: reports,
  };
}

export function renderRetrievalBenchmarkMarkdown(report: RetrievalBenchmarkReport): string {
  requireTimestamp(report.generatedAt);
  const lines: string[] = [
    "# Retrieval Benchmark Report",
    "",
    `Split: **${report.split}**`,
    `Generated: \`${report.generatedAt}\``,
    `Queries: **${String(report.queryCount)}**`,
    "",
    "| Variant | Recall@10 | MRR | All required | p95 ms | Peak RSS bytes | Index bytes |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const variant of report.variants) {
    lines.push(
      `| ${escapeTable(variant.id)} | ${fixed(variant.metrics.recallAt10)} | ${fixed(variant.metrics.mrr)} | ${fixed(variant.metrics.allRequiredEvidenceCoverage)} | ${fixed(variant.metrics.latencyMs.p95)} | ${String(variant.metrics.resources.peakRssBytes)} | ${String(variant.metrics.resources.indexBytes)} |`,
    );
  }

  for (const variant of report.variants) {
    lines.push("", `## ${variant.id}`, "", "### Configuration", "");
    const entries = Object.entries(variant.configuration);
    if (entries.length === 0) lines.push("- none");
    else for (const [key, value] of entries) lines.push(`- \`${key}\`: \`${String(value)}\``);

    lines.push("", "### Failure counts", "");
    const failureEntries = orderedFailureEntries(variant.metrics.categoryFailureCounts);
    if (failureEntries.length === 0) lines.push("- none");
    else for (const [category, count] of failureEntries) lines.push(`- \`${category}\`: ${String(count)}`);

    lines.push(
      "",
      "### Diagnostics",
      "",
      `- answerable queries scored: ${String(variant.metrics.scoredAnswerableQueries)}`,
      `- no-answer queries: ${String(variant.metrics.noAnswerQueries)}`,
      `- no-answer queries with any hit: ${String(variant.metrics.noAnswerQueriesWithAnyHit)}`,
      `- latency median / p95 / max ms: ${fixed(variant.metrics.latencyMs.median)} / ${fixed(variant.metrics.latencyMs.p95)} / ${fixed(variant.metrics.latencyMs.max)}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function selectSplit(dataset: GoldenDataset, split: GoldenDatasetSplit): GoldenDataset {
  const queries = dataset.queries.filter((query) => query.split === split);
  if (queries.length === 0) throw new Error(`Golden Dataset contains no ${split} queries`);
  const queryIds = new Set(queries.map((query) => query.id));
  return {
    schemaVersion: dataset.schemaVersion,
    corpus: dataset.corpus,
    queries,
    labels: dataset.labels.filter((label) => queryIds.has(label.queryId)),
  };
}

function validateConfiguration(
  configuration: Readonly<Record<string, BenchmarkConfigurationValue>>,
  variantId: string,
): void {
  for (const [key, value] of Object.entries(configuration)) {
    requireNonEmpty(key, `configuration key for ${variantId}`);
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError(`configuration ${variantId}.${key} must be finite`);
    }
  }
}

function canonicalConfiguration(
  configuration: Readonly<Record<string, BenchmarkConfigurationValue>>,
): Readonly<Record<string, BenchmarkConfigurationValue>> {
  return Object.fromEntries(Object.entries(configuration).sort(([left], [right]) => left.localeCompare(right)));
}

function orderedFailureEntries(
  counts: Partial<Record<GoldenQueryCategory, number>>,
): [GoldenQueryCategory, number][] {
  return Object.entries(counts)
    .filter((entry): entry is [GoldenQueryCategory, number] => typeof entry[1] === "number" && entry[1] > 0)
    .sort(([left], [right]) => left.localeCompare(right));
}

function fixed(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError("Benchmark metric must be finite");
  return value.toFixed(4);
}

function escapeTable(value: string): string {
  return value.replace(/\|/gu, "\\|");
}

function requireTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError("generatedAt must be an ISO-compatible timestamp");
}

function requireNonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) throw new TypeError(`${label} must not be empty`);
  return value;
}
