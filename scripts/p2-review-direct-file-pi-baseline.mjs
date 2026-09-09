#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

const EXPECTED_DATASET_HASH = "949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3";
const EXPECTED_QUERY_COUNT = 50;
const CORPUS_RECORDS = [
  "vue-reactivity-core-zh",
  "node-fspromises-cp-v16.7.0",
  "node-fspromises-cp-v22.3.0",
  "challenge-vue-reactivity-neighbors",
  "challenge-node-fspromises-neighbors-a",
  "challenge-node-fspromises-neighbors-b",
];

const repoRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(
  process.env.P2_T10_EVIDENCE_OUT_DIR ?? "/tmp/pi-knowledge-p2-evidence/p2-t10",
);
const progressPath = path.join(outDir, "human-review-development.json");
const markdownPath = path.join(outDir, "human-review-development.md");
const summaryPath = path.join(outDir, "human-review-summary.json");

if (process.argv.length > 2) {
  throw new Error("This helper takes no arguments. Set P2_T10_EVIDENCE_OUT_DIR only when using a non-default evidence directory.");
}
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  throw new Error("P2-T10 assisted review must run in an interactive terminal.");
}

const queries = await readJsonLines(path.join(repoRoot, "eval/queries/development.jsonl"));
const labels = await readJsonLines(path.join(repoRoot, "eval/labels/development.jsonl"));
const corpus = await Promise.all(
  CORPUS_RECORDS.map(async (name) => JSON.parse(await readFile(
    path.join(repoRoot, "eval/corpus", `${name}.meta.json`),
    "utf8",
  ))),
);
const provenance = await readRequiredJson(
  path.join(outDir, "direct-file-pi-development.json"),
  "Run the P2-T10 direct-file baseline first; the existing model evidence bundle is required.",
);
const answers = await readJsonLinesRequired(
  path.join(outDir, "answers-development.jsonl"),
  "Run the P2-T10 direct-file baseline first; answers-development.jsonl is missing.",
);

validateEvidenceBundle({ queries, answers, provenance });
const sourceByLineage = new Map(
  corpus.map((record) => [
    `${record.parsedArtifact.sourceVersionId}:${record.parsedArtifact.parsedArtifactId}`,
    record,
  ]),
);
const labelsByQuery = groupBy(labels, (label) => label.queryId);
const answerByQuery = new Map(answers.map((answer) => [answer.queryId, answer]));
const cases = queries.map((query) => buildReviewCase(
  query,
  answerByQuery.get(query.id),
  labelsByQuery.get(query.id) ?? [],
  sourceByLineage,
));

const progress = await loadProgress(progressPath, provenance);
const reviewedById = new Map(progress.decisions.map((decision) => [decision.queryId, decision]));
const remaining = cases.filter((reviewCase) => !reviewedById.has(reviewCase.queryId));

console.log("===== P2-T10 ASSISTED HUMAN REVIEW =====");
console.log(`Evidence: ${outDir}`);
console.log(`Runtime: ${provenance.piVersion} / ${provenance.runtime?.provider ?? "unknown"} / ${provenance.runtime?.model ?? "unknown"}`);
console.log(`Progress: ${String(reviewedById.size)}/${String(cases.length)} already reviewed`);
console.log("\nControls: Enter = accept rule-based suggestion; c = correct; p = partially correct; i = incorrect; q = save and quit.");
console.log("The suggestion is deterministic triage only. You are the independent semantic reviewer.\n");

const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  for (let index = 0; index < remaining.length; index += 1) {
    const reviewCase = remaining[index];
    renderCase(reviewCase, reviewedById.size + 1, cases.length);

    const decisionInput = await askDecision(rl, reviewCase.suggestedClassification);
    if (decisionInput === "quit") {
      await persistProgress(progressPath, provenance, reviewedById);
      console.log(`\nSaved progress: ${reviewedById.size}/${cases.length}`);
      process.exit(0);
    }

    const finalClassification = decisionInput;
    let issues = emptyIssues();
    let note = "";
    if (finalClassification !== "correct") {
      const issueResult = await askIssues(rl, reviewCase.suggestedIssues);
      issues = issueResult.issues;
      note = issueResult.note;
    }

    const decision = {
      queryId: reviewCase.queryId,
      suggestedClassification: reviewCase.suggestedClassification,
      classification: finalClassification,
      acceptedSuggestion: finalClassification === reviewCase.suggestedClassification,
      issues,
      note,
      deterministicWarnings: reviewCase.deterministicWarnings,
      reviewedAt: new Date().toISOString(),
    };
    reviewedById.set(reviewCase.queryId, decision);
    await persistProgress(progressPath, provenance, reviewedById);
  }
} finally {
  rl.close();
}

const orderedDecisions = cases.map((reviewCase) => reviewedById.get(reviewCase.queryId));
if (orderedDecisions.some((decision) => decision === undefined)) {
  throw new Error("Review ended with incomplete decisions; rerun the helper to resume.");
}

const summary = buildSummary(provenance, orderedDecisions);
await writeJson(summaryPath, summary);
await writeFile(markdownPath, renderCompletedMarkdown(cases, orderedDecisions, summary), "utf8");
await writeJson(progressPath, {
  schemaVersion: 1,
  status: "COMPLETE",
  datasetHash: provenance.datasetHash,
  evidenceRepoSha: provenance.repoSha,
  completedAt: summary.completedAt,
  reviewDigest: summary.reviewDigest,
  decisions: orderedDecisions,
});

console.log("\n===== P2-T10 HUMAN REVIEW COMPLETE =====");
console.log(JSON.stringify(summary, null, 2));
console.log(`Detailed review: ${markdownPath}`);
console.log(`Machine summary: ${summaryPath}`);

function validateEvidenceBundle({ queries: queryRows, answers: answerRows, provenance: proof }) {
  if (proof.datasetHash !== EXPECTED_DATASET_HASH) {
    throw new Error(`Evidence dataset hash mismatch: ${String(proof.datasetHash)}`);
  }
  if (queryRows.length !== EXPECTED_QUERY_COUNT || answerRows.length !== EXPECTED_QUERY_COUNT) {
    throw new Error(
      `Expected ${String(EXPECTED_QUERY_COUNT)} queries/answers; got ${String(queryRows.length)}/${String(answerRows.length)}`,
    );
  }
  const queryIds = queryRows.map((query) => query.id);
  const answerIds = answerRows.map((answer) => answer.queryId);
  if (new Set(queryIds).size !== EXPECTED_QUERY_COUNT || new Set(answerIds).size !== EXPECTED_QUERY_COUNT) {
    throw new Error("Duplicate query or answer ids in evidence bundle");
  }
  for (const queryId of queryIds) {
    if (!answerIds.includes(queryId)) throw new Error(`Missing answer for ${queryId}`);
  }
}

function buildReviewCase(query, answer, queryLabels, lineageMap) {
  if (answer === undefined) throw new Error(`Missing answer for ${query.id}`);
  const required = queryLabels.filter((label) => label.importance === "required");
  const answerable = required.length > 0;
  const requiredCoverage = required.map((label) => ({
    label,
    covered: answer.mappedCitations.some((citation) => citationOverlapsLabel(citation, label)),
  }));
  const anyRequiredCovered = requiredCoverage.some((entry) => entry.covered);
  const allRequiredCovered = requiredCoverage.length === 0 || requiredCoverage.every((entry) => entry.covered);
  const deterministicWarnings = [];

  if (answerable && answer.insufficientEvidence) deterministicWarnings.push("answerable query was marked insufficientEvidence");
  if (!answerable && !answer.insufficientEvidence) deterministicWarnings.push("no-answer query did not abstain");
  if (answer.unmappedCitations.length > 0) {
    deterministicWarnings.push(`${String(answer.unmappedCitations.length)} citation(s) could not map to frozen source text`);
  }
  if (answerable && !allRequiredCovered) deterministicWarnings.push("not all required Evidence was cited");

  let suggestedClassification;
  if (!answerable) {
    suggestedClassification = answer.insufficientEvidence ? "correct" : "incorrect";
  } else if (answer.insufficientEvidence) {
    suggestedClassification = "incorrect";
  } else if (allRequiredCovered) {
    suggestedClassification = "correct";
  } else if (anyRequiredCovered) {
    suggestedClassification = "partially correct";
  } else {
    suggestedClassification = "partially correct";
  }

  const suggestedIssues = emptyIssues();
  if (answerable && !allRequiredCovered) suggestedIssues.evidenceOmission = true;
  if (!answerable && !answer.insufficientEvidence) suggestedIssues.noAnswerHallucination = true;

  return {
    queryId: query.id,
    query: query.query,
    categories: query.categories ?? [],
    answerable,
    answer,
    requiredCoverage,
    sourceByLineage: lineageMap,
    deterministicWarnings,
    suggestedClassification,
    suggestedIssues,
  };
}

function renderCase(reviewCase, ordinal, total) {
  console.log("\n" + "=".repeat(88));
  console.log(`[${String(ordinal)}/${String(total)}] ${reviewCase.queryId} — suggested: ${reviewCase.suggestedClassification}`);
  console.log(`Categories: ${reviewCase.categories.join(", ") || "none"}`);
  console.log(`Expected: ${reviewCase.answerable ? "answerable" : "no-answer"}`);
  console.log("\nQUERY\n" + reviewCase.query);
  console.log("\nPI ANSWER\n" + reviewCase.answer.answer);
  console.log(`\nModel insufficientEvidence: ${String(reviewCase.answer.insufficientEvidence)}`);

  console.log("\nEXPECTED REQUIRED EVIDENCE");
  if (reviewCase.requiredCoverage.length === 0) {
    console.log("  (none — Golden Dataset expects no answer from supplied files)");
  } else {
    for (const entry of reviewCase.requiredCoverage) {
      const key = `${entry.label.sourceVersionId}:${entry.label.parsedArtifactId}`;
      const source = reviewCase.sourceByLineage.get(key);
      console.log(`  ${entry.covered ? "✓" : "✗"} ${source?.relativePath ?? key}`);
      console.log(`    ${entry.label.exactQuote}`);
    }
  }

  console.log("\nMODEL CITATIONS");
  if (reviewCase.answer.requestedCitations.length === 0) {
    console.log("  (none)");
  } else {
    for (const citation of reviewCase.answer.requestedCitations) {
      const unmapped = reviewCase.answer.unmappedCitations.find(
        (candidate) => candidate.path === citation.path && candidate.exactQuote === citation.exactQuote,
      );
      console.log(`  ${unmapped === undefined ? "✓ mapped" : `✗ ${unmapped.reason}`}: ${citation.path}`);
      console.log(`    ${citation.exactQuote}`);
    }
  }

  console.log("\nDETERMINISTIC WARNINGS");
  if (reviewCase.deterministicWarnings.length === 0) console.log("  none");
  else for (const warning of reviewCase.deterministicWarnings) console.log(`  - ${warning}`);
  console.log("\nHuman check still required: answer meaning, unsupported claims, version/conflict handling, and material omissions.");
}

async function askDecision(rl, suggested) {
  while (true) {
    const raw = (await rl.question(`\nDecision [Enter=${suggested} | c=correct | p=partially correct | i=incorrect | q=quit]: `))
      .trim()
      .toLowerCase();
    if (raw === "") return suggested;
    if (raw === "c") return "correct";
    if (raw === "p") return "partially correct";
    if (raw === "i") return "incorrect";
    if (raw === "q") return "quit";
    console.log("Use Enter, c, p, i, or q.");
  }
}

async function askIssues(rl, suggested) {
  const defaultCodes = issueCodes(suggested);
  while (true) {
    const raw = (await rl.question(
      `Issues [Enter=${defaultCodes || "none"} | -=none | u=unsupported | v=version/conflict | o=evidence omitted | h=no-answer hallucination | x=other; combine letters]: `,
    )).trim().toLowerCase();
    const codes = raw === "" ? defaultCodes : raw;
    if (codes === "-") return { issues: emptyIssues(), note: "" };
    if (!/^[uvohx]*$/u.test(codes)) {
      console.log("Use only u, v, o, h, x, '-' or Enter.");
      continue;
    }
    const issues = {
      unsupportedClaims: codes.includes("u"),
      versionConflictMistake: codes.includes("v"),
      evidenceOmission: codes.includes("o"),
      noAnswerHallucination: codes.includes("h"),
      other: codes.includes("x"),
    };
    const note = issues.other ? (await rl.question("Short note for other issue: ")).trim() : "";
    return { issues, note };
  }
}

async function loadProgress(targetPath, proof) {
  const value = await readJsonIfExists(targetPath);
  if (value === null || value.status === "PENDING") {
    return { decisions: [] };
  }
  if (value.datasetHash !== proof.datasetHash || value.evidenceRepoSha !== proof.repoSha) {
    throw new Error("Existing human review progress belongs to a different P2-T10 evidence bundle");
  }
  if (!Array.isArray(value.decisions)) throw new Error("Invalid human review progress file");
  if (value.status === "COMPLETE") {
    console.log("Human review is already complete for this exact evidence bundle.");
    console.log(`Review digest: ${String(value.reviewDigest)}`);
    process.exit(0);
  }
  return value;
}

async function persistProgress(targetPath, proof, reviewedById) {
  await writeJson(targetPath, {
    schemaVersion: 1,
    status: "IN_PROGRESS",
    datasetHash: proof.datasetHash,
    evidenceRepoSha: proof.repoSha,
    decisions: [...reviewedById.values()],
  });
}

function buildSummary(proof, decisions) {
  const counts = {
    correct: decisions.filter((decision) => decision.classification === "correct").length,
    partiallyCorrect: decisions.filter((decision) => decision.classification === "partially correct").length,
    incorrect: decisions.filter((decision) => decision.classification === "incorrect").length,
  };
  const issueCounts = {
    unsupportedClaims: decisions.filter((decision) => decision.issues.unsupportedClaims).length,
    versionConflictMistakes: decisions.filter((decision) => decision.issues.versionConflictMistake).length,
    noAnswerHallucinations: decisions.filter((decision) => decision.issues.noAnswerHallucination).length,
    evidenceOmissions: decisions.filter((decision) => decision.issues.evidenceOmission).length,
    other: decisions.filter((decision) => decision.issues.other).length,
  };
  const digestPayload = {
    datasetHash: proof.datasetHash,
    evidenceRepoSha: proof.repoSha,
    decisions: decisions.map((decision) => ({
      queryId: decision.queryId,
      classification: decision.classification,
      issues: decision.issues,
      note: decision.note,
    })),
  };
  return {
    schemaVersion: 1,
    status: "COMPLETE",
    datasetHash: proof.datasetHash,
    evidenceRepoSha: proof.repoSha,
    queryCount: decisions.length,
    counts,
    issueCounts,
    acceptedRuleSuggestionCount: decisions.filter((decision) => decision.acceptedSuggestion).length,
    overriddenRuleSuggestionCount: decisions.filter((decision) => !decision.acceptedSuggestion).length,
    completedAt: new Date().toISOString(),
    reviewDigest: sha256(Buffer.from(JSON.stringify(digestPayload), "utf8")),
  };
}

function renderCompletedMarkdown(reviewCases, decisions, summary) {
  const decisionById = new Map(decisions.map((decision) => [decision.queryId, decision]));
  const lines = [
    "# P2-T10 human answer-quality review — development",
    "",
    "Status: **COMPLETE — independent human review recorded**",
    "",
    `Evidence repository SHA: \`${summary.evidenceRepoSha}\``,
    `Dataset hash: \`${summary.datasetHash}\``,
    `Review digest: \`${summary.reviewDigest}\``,
    "",
    "## Aggregate",
    "",
    `- Correct: ${String(summary.counts.correct)}`,
    `- Partially correct: ${String(summary.counts.partiallyCorrect)}`,
    `- Incorrect: ${String(summary.counts.incorrect)}`,
    `- Unsupported claims: ${String(summary.issueCounts.unsupportedClaims)}`,
    `- Version/conflict mistakes: ${String(summary.issueCounts.versionConflictMistakes)}`,
    `- No-answer hallucinations: ${String(summary.issueCounts.noAnswerHallucinations)}`,
    `- Evidence omissions: ${String(summary.issueCounts.evidenceOmissions)}`,
    `- Rule suggestions accepted/overridden: ${String(summary.acceptedRuleSuggestionCount)}/${String(summary.overriddenRuleSuggestionCount)}`,
    "",
    "## Per-query decisions",
    "",
    "| Query | Categories | Rule suggestion | Human classification | Issues |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const reviewCase of reviewCases) {
    const decision = decisionById.get(reviewCase.queryId);
    lines.push(
      `| ${escapeTable(reviewCase.queryId)} | ${escapeTable(reviewCase.categories.join(", "))} | ${escapeTable(reviewCase.suggestedClassification)} | ${escapeTable(decision.classification)} | ${escapeTable(issueLabels(decision.issues).join(", ") || "none")} |`,
    );
  }
  lines.push(
    "",
    "The rule-based suggestion used only deterministic answerability/Evidence/citation signals. The final classification above is the human review decision.",
    "",
  );
  return lines.join("\n");
}

function citationOverlapsLabel(citation, label) {
  return citation.sourceVersionId === label.sourceVersionId
    && citation.parsedArtifactId === label.parsedArtifactId
    && citation.startByte < label.endByte
    && citation.endByte > label.startByte;
}

function emptyIssues() {
  return {
    unsupportedClaims: false,
    versionConflictMistake: false,
    evidenceOmission: false,
    noAnswerHallucination: false,
    other: false,
  };
}

function issueCodes(issues) {
  return [
    issues.unsupportedClaims ? "u" : "",
    issues.versionConflictMistake ? "v" : "",
    issues.evidenceOmission ? "o" : "",
    issues.noAnswerHallucination ? "h" : "",
    issues.other ? "x" : "",
  ].join("");
}

function issueLabels(issues) {
  const labels = [];
  if (issues.unsupportedClaims) labels.push("unsupported-claims");
  if (issues.versionConflictMistake) labels.push("version/conflict");
  if (issues.evidenceOmission) labels.push("evidence-omission");
  if (issues.noAnswerHallucination) labels.push("no-answer-hallucination");
  if (issues.other) labels.push("other");
  return labels;
}

function groupBy(values, keyFn) {
  const grouped = new Map();
  for (const value of values) {
    const key = keyFn(value);
    const current = grouped.get(key) ?? [];
    current.push(value);
    grouped.set(key, current);
  }
  return grouped;
}

async function readRequiredJson(targetPath, errorMessage) {
  try {
    return JSON.parse(await readFile(targetPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(errorMessage);
    throw error;
  }
}

async function readJsonIfExists(targetPath) {
  try {
    return JSON.parse(await readFile(targetPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function readJsonLines(targetPath) {
  const raw = await readFile(targetPath, "utf8");
  return raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function readJsonLinesRequired(targetPath, errorMessage) {
  try {
    return await readJsonLines(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(errorMessage);
    throw error;
  }
}

async function writeJson(targetPath, value) {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}
