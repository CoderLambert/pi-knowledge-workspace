#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

const EXPECTED_DATASET_HASH = "949cf28c36a3bfe6438e831aa96573ff10d30169f52dbc6b4192fca848fc40a3";
const EXPECTED_QUERY_COUNT = 50;
const repoRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(
  process.env.P2_T10_EVIDENCE_OUT_DIR ?? "/tmp/pi-knowledge-p2-evidence/p2-t10",
);
const verifyOnly = process.argv.includes("--verify-query-display");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--verify-query-display");
if (unknownArgs.length > 0) throw new Error(`Unknown argument: ${unknownArgs.join(" ")}`);

const queryPath = path.join(repoRoot, "eval/queries/development.jsonl");
const labelPath = path.join(repoRoot, "eval/labels/development.jsonl");
const queries = await readJsonLines(queryPath);
validateQueryRows(queries);
const queryTextDigest = sha256(Buffer.from(JSON.stringify(
  queries.map((query) => ({ id: query.id, text: queryText(query) })),
), "utf8"));

if (verifyOnly) {
  console.log("===== P2-T10 QUERY DISPLAY CONTRACT PASS =====");
  console.log(JSON.stringify({
    queryCount: queries.length,
    firstQuery: queryText(queries[0]),
    lastQuery: queryText(queries.at(-1)),
    queryTextDigest,
  }, null, 2));
  process.exit(0);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  throw new Error("P2-T10 query-display reconfirmation must run in an interactive terminal.");
}

const provenance = await readRequiredJson(
  path.join(outDir, "direct-file-pi-development.json"),
  "Missing direct-file-pi-development.json; preserve and use the existing P2-T10 evidence bundle.",
);
const answers = await readJsonLinesRequired(
  path.join(outDir, "answers-development.jsonl"),
  "Missing answers-development.jsonl; preserve and use the existing P2-T10 evidence bundle.",
);
const priorReview = await readRequiredJson(
  path.join(outDir, "human-review-development.json"),
  "Missing completed first-pass human review; run the original assisted review first.",
);
const labels = await readJsonLines(labelPath);

validateEvidence({ provenance, queries, answers, priorReview });
const answerById = new Map(answers.map((answer) => [answer.queryId, answer]));
const labelsById = groupBy(labels, (label) => label.queryId);
const priorById = new Map(priorReview.decisions.map((decision) => [decision.queryId, decision]));
const cases = queries.map((query) => ({
  queryId: query.id,
  text: queryText(query),
  categories: query.categories ?? [],
  answer: answerById.get(query.id),
  required: (labelsById.get(query.id) ?? []).filter((label) => label.importance === "required"),
  priorDecision: priorById.get(query.id),
}));

const progressPath = path.join(outDir, "human-review-query-display-reconfirmation.json");
const summaryPath = path.join(outDir, "human-review-query-display-reconfirmation-summary.json");
const markdownPath = path.join(outDir, "human-review-query-display-reconfirmation.md");
const progress = await loadProgress(progressPath, provenance, priorReview, queryTextDigest);
const confirmedById = new Map(progress.decisions.map((decision) => [decision.queryId, decision]));
const remaining = cases.filter((reviewCase) => !confirmedById.has(reviewCase.queryId));

console.log("===== P2-T10 HUMAN REVIEW QUERY-TEXT RECONFIRMATION =====");
console.log(`Evidence: ${outDir}`);
console.log(`Previous review digest: ${String(priorReview.reviewDigest)}`);
console.log(`Query-text digest: ${queryTextDigest}`);
console.log(`Progress: ${String(confirmedById.size)}/${String(cases.length)}`);
console.log("\nEnter keeps the previous human classification. Use c/p/i only if seeing the real query changes your judgment. q saves and exits.\n");

const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  for (const reviewCase of remaining) {
    renderCase(reviewCase, confirmedById.size + 1, cases.length);
    const result = await askClassification(rl, reviewCase.priorDecision.classification);
    if (result === "quit") {
      await persistProgress(progressPath, provenance, priorReview, queryTextDigest, confirmedById);
      console.log(`\nSaved reconfirmation progress: ${String(confirmedById.size)}/${String(cases.length)}`);
      process.exit(0);
    }

    let issues = reviewCase.priorDecision.issues;
    let note = reviewCase.priorDecision.note ?? "";
    if (result === "correct") {
      issues = emptyIssues();
      note = "";
    } else if (result !== reviewCase.priorDecision.classification) {
      const issueResult = await askIssues(rl, reviewCase.priorDecision.issues);
      issues = issueResult.issues;
      note = issueResult.note;
    }

    confirmedById.set(reviewCase.queryId, {
      queryId: reviewCase.queryId,
      previousClassification: reviewCase.priorDecision.classification,
      classification: result,
      unchangedFromPreviousReview: result === reviewCase.priorDecision.classification,
      issues,
      note,
      reconfirmedAt: new Date().toISOString(),
    });
    await persistProgress(progressPath, provenance, priorReview, queryTextDigest, confirmedById);
  }
} finally {
  rl.close();
}

const decisions = cases.map((reviewCase) => confirmedById.get(reviewCase.queryId));
if (decisions.some((decision) => decision === undefined)) {
  throw new Error("Reconfirmation ended incomplete; rerun to resume.");
}
const summary = buildSummary(provenance, priorReview, queryTextDigest, decisions);
await writeJson(summaryPath, summary);
await writeFile(markdownPath, renderMarkdown(cases, decisions, summary), "utf8");
await writeJson(progressPath, {
  schemaVersion: 2,
  status: "COMPLETE",
  datasetHash: provenance.datasetHash,
  evidenceRepoSha: provenance.repoSha,
  priorReviewDigest: priorReview.reviewDigest,
  queryTextDigest,
  completedAt: summary.completedAt,
  reviewDigest: summary.reviewDigest,
  decisions,
});

console.log("\n===== P2-T10 HUMAN REVIEW RECONFIRMATION COMPLETE =====");
console.log(JSON.stringify(summary, null, 2));
console.log(`Detailed reconfirmation: ${markdownPath}`);
console.log(`Machine summary: ${summaryPath}`);

function validateQueryRows(rows) {
  if (rows.length !== EXPECTED_QUERY_COUNT) {
    throw new Error(`Expected ${String(EXPECTED_QUERY_COUNT)} development queries, got ${String(rows.length)}`);
  }
  for (const query of rows) queryText(query);
}

function queryText(query) {
  if (typeof query?.text !== "string" || query.text.trim().length === 0) {
    throw new Error(`Development query ${String(query?.id)} has no non-empty text field`);
  }
  return query.text;
}

function validateEvidence({ provenance: proof, queries: queryRows, answers: answerRows, priorReview: review }) {
  if (proof.datasetHash !== EXPECTED_DATASET_HASH) {
    throw new Error(`Evidence dataset hash mismatch: ${String(proof.datasetHash)}`);
  }
  if (answerRows.length !== EXPECTED_QUERY_COUNT) {
    throw new Error(`Expected ${String(EXPECTED_QUERY_COUNT)} answers, got ${String(answerRows.length)}`);
  }
  if (review.status !== "COMPLETE" || !Array.isArray(review.decisions) || review.decisions.length !== EXPECTED_QUERY_COUNT) {
    throw new Error("First-pass human review is not a complete 50-query record");
  }
  if (review.datasetHash !== proof.datasetHash || review.evidenceRepoSha !== proof.repoSha) {
    throw new Error("First-pass human review belongs to a different evidence bundle");
  }
  const answerById = new Map(answerRows.map((answer) => [answer.queryId, answer]));
  const decisionIds = new Set(review.decisions.map((decision) => decision.queryId));
  for (const query of queryRows) {
    const answer = answerById.get(query.id);
    if (answer === undefined) throw new Error(`Missing answer for ${query.id}`);
    if (answer.query !== queryText(query)) {
      throw new Error(`Stored model query text mismatch for ${query.id}`);
    }
    if (!decisionIds.has(query.id)) throw new Error(`Missing prior human decision for ${query.id}`);
  }
}

function renderCase(reviewCase, ordinal, total) {
  console.log("\n" + "=".repeat(88));
  console.log(`[${String(ordinal)}/${String(total)}] ${reviewCase.queryId}`);
  console.log(`Categories: ${reviewCase.categories.join(", ") || "none"}`);
  console.log(`Previous human classification: ${reviewCase.priorDecision.classification}`);
  console.log("\nQUERY\n" + reviewCase.text);
  console.log("\nPI ANSWER\n" + reviewCase.answer.answer);
  console.log(`\nModel insufficientEvidence: ${String(reviewCase.answer.insufficientEvidence)}`);
  console.log("\nEXPECTED REQUIRED EVIDENCE");
  if (reviewCase.required.length === 0) {
    console.log("  (none — Golden Dataset expects no answer from supplied files)");
  } else {
    for (const label of reviewCase.required) console.log(`  - ${label.exactQuote}`);
  }
  console.log("\nPREVIOUS ISSUE FLAGS");
  const issueText = issueLabels(reviewCase.priorDecision.issues).join(", ");
  console.log(`  ${issueText || "none"}`);
}

async function askClassification(rl, previous) {
  while (true) {
    const raw = (await rl.question(`\nReconfirm [Enter=keep ${previous} | c=correct | p=partially correct | i=incorrect | q=quit]: `))
      .trim()
      .toLowerCase();
    if (raw === "") return previous;
    if (raw === "c") return "correct";
    if (raw === "p") return "partially correct";
    if (raw === "i") return "incorrect";
    if (raw === "q") return "quit";
    console.log("Use Enter, c, p, i, or q.");
  }
}

async function askIssues(rl, previousIssues) {
  const defaults = issueCodes(previousIssues);
  while (true) {
    const raw = (await rl.question(
      `Issues [Enter=${defaults || "none"} | -=none | u=unsupported | v=version/conflict | o=evidence omitted | h=no-answer hallucination | x=other; combine letters]: `,
    )).trim().toLowerCase();
    const codes = raw === "" ? defaults : raw;
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

async function loadProgress(targetPath, proof, priorReview, digest) {
  const value = await readJsonIfExists(targetPath);
  if (value === null) return { decisions: [] };
  if (
    value.datasetHash !== proof.datasetHash
    || value.evidenceRepoSha !== proof.repoSha
    || value.priorReviewDigest !== priorReview.reviewDigest
    || value.queryTextDigest !== digest
  ) {
    throw new Error("Existing reconfirmation progress belongs to a different evidence/query-text record");
  }
  if (!Array.isArray(value.decisions)) throw new Error("Invalid reconfirmation progress file");
  if (value.status === "COMPLETE") {
    console.log("Query-text reconfirmation is already complete for this exact evidence bundle.");
    console.log(`Review digest: ${String(value.reviewDigest)}`);
    process.exit(0);
  }
  return value;
}

async function persistProgress(targetPath, proof, priorReview, digest, confirmedById) {
  await writeJson(targetPath, {
    schemaVersion: 2,
    status: "IN_PROGRESS",
    datasetHash: proof.datasetHash,
    evidenceRepoSha: proof.repoSha,
    priorReviewDigest: priorReview.reviewDigest,
    queryTextDigest: digest,
    decisions: [...confirmedById.values()],
  });
}

function buildSummary(proof, priorReview, digest, decisions) {
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
    priorReviewDigest: priorReview.reviewDigest,
    queryTextDigest: digest,
    decisions: decisions.map((decision) => ({
      queryId: decision.queryId,
      classification: decision.classification,
      issues: decision.issues,
      note: decision.note,
    })),
  };
  return {
    schemaVersion: 2,
    status: "COMPLETE",
    datasetHash: proof.datasetHash,
    evidenceRepoSha: proof.repoSha,
    queryCount: decisions.length,
    priorReviewDigest: priorReview.reviewDigest,
    queryTextDigest: digest,
    counts,
    issueCounts,
    unchangedDecisionCount: decisions.filter((decision) => decision.unchangedFromPreviousReview).length,
    changedDecisionCount: decisions.filter((decision) => !decision.unchangedFromPreviousReview).length,
    completedAt: new Date().toISOString(),
    reviewDigest: sha256(Buffer.from(JSON.stringify(digestPayload), "utf8")),
  };
}

function renderMarkdown(reviewCases, decisions, summary) {
  const decisionById = new Map(decisions.map((decision) => [decision.queryId, decision]));
  const lines = [
    "# P2-T10 human semantic review query-text reconfirmation",
    "",
    "Status: **COMPLETE — query text was visible for every reconfirmed decision**",
    "",
    `Dataset hash: \`${summary.datasetHash}\``,
    `Evidence repository SHA: \`${summary.evidenceRepoSha}\``,
    `Previous review digest: \`${summary.priorReviewDigest}\``,
    `Query-text digest: \`${summary.queryTextDigest}\``,
    `Reconfirmed review digest: \`${summary.reviewDigest}\``,
    "",
    `Correct / partially correct / incorrect: ${summary.counts.correct} / ${summary.counts.partiallyCorrect} / ${summary.counts.incorrect}`,
    `Unchanged / changed from previous review: ${summary.unchangedDecisionCount} / ${summary.changedDecisionCount}`,
    "",
    "| Query | Query text | Previous | Reconfirmed | Issues |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const reviewCase of reviewCases) {
    const decision = decisionById.get(reviewCase.queryId);
    lines.push(`| ${escapeTable(reviewCase.queryId)} | ${escapeTable(reviewCase.text)} | ${escapeTable(decision.previousClassification)} | ${escapeTable(decision.classification)} | ${escapeTable(issueLabels(decision.issues).join(", ") || "none")} |`);
  }
  lines.push("", "This record supersedes the first-pass semantic review for acceptance because the first helper displayed the query field incorrectly.", "");
  return lines.join("\n");
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

function issueCodes(issues = emptyIssues()) {
  return [
    issues.unsupportedClaims ? "u" : "",
    issues.versionConflictMistake ? "v" : "",
    issues.evidenceOmission ? "o" : "",
    issues.noAnswerHallucination ? "h" : "",
    issues.other ? "x" : "",
  ].join("");
}

function issueLabels(issues = emptyIssues()) {
  const values = [];
  if (issues.unsupportedClaims) values.push("unsupported-claims");
  if (issues.versionConflictMistake) values.push("version/conflict");
  if (issues.evidenceOmission) values.push("evidence-omission");
  if (issues.noAnswerHallucination) values.push("no-answer-hallucination");
  if (issues.other) values.push("other");
  return values;
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

async function writeJson(targetPath, value) {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}
