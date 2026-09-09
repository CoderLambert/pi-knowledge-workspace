# P2-T03A — Development retrieval challenge expansion

Status: **IMPLEMENTED / VERIFICATION PARTIAL**

## Objective

Resolve the discriminative-power debt discovered by the first real P2-T04 run without mutating the original immutable Golden Dataset snapshots or tuning from holdout observations.

The original three snapshots produce only three chunks under the production 2,400-byte chunk target, while SearchQuery uses Top-K=10. That makes Recall@10 structurally saturated and is insufficient for choosing between lexical, Dense and Hybrid retrieval.

## Direct base

P2-T03 / `data/p2-query-annotation` / PR #35.

## Added challenge corpus

Three new development-only hard-negative artifacts are committed with independent SourceVersion / ParsedArtifact identity:

1. `challenge-vue-reactivity-neighbors.md`
   - fixed upstream revision: `vuejs-translations/docs-zh-cn@dda601fe...`;
   - neighboring Vue reactivity topics such as computed/reactive/readonly/watch;
   - deliberately omits target `ref()` passages while preserving overlapping vocabulary such as `.value`, reactive state and dependency tracking.

2. `challenge-node-fspromises-neighbors-a.md`
3. `challenge-node-fspromises-neighbors-b.md`
   - fixed upstream version: `nodejs/node@v22.3.0`, `doc/api/fs.md`;
   - neighboring `fs/promises` APIs including copyFile/mkdir/readdir/readFile/rm/writeFile and related operations;
   - deliberately omits `fsPromises.cp` target passages while retaining overlapping vocabulary such as Promise, options, recursive and force.

The text is condensed/adapted challenge material rather than bulk-vendored upstream documentation. Attribution is updated in `eval/corpus/ATTRIBUTION.md`.

## Holdout / Evidence isolation

This corrective task does not modify:

- the original three snapshot bytes or metadata;
- the 50 development queries;
- the 30 holdout queries;
- any development or holdout Stable Evidence label.

Challenge design used only development-side retrieval requirements. Previously observed holdout ranking outcomes are acceptance-only and were not used to choose challenge content.

`retrievalChallengeCorpus.test.ts` protects the boundary by requiring:

- all original + challenge corpus hashes/lineage to remain valid;
- unique SourceVersion and ParsedArtifact identities;
- challenge text to contain none of the existing development `exactQuote` Evidence strings;
- challenge text to omit `fsPromises.cp` and target `` `ref()` `` passages;
- lexical overlap terms to remain present so the corpus is a real hard-negative set rather than unrelated noise.

## Candidate-pressure contract

The challenge artifacts intentionally use multiple Markdown headings. The production parser/chunker treats heading-delimited sections as structural chunk boundaries when they fit the 2,400-byte target.

The focused test executes the real:

`canonicalizeParsedArtifact -> chunkParsedArtifact`

path and requires:

- at least 10 chunks from each challenge artifact;
- at least 30 challenge chunks total.

Together with the original three chunks this makes the candidate pool materially larger than Top-K=10.

This requirement is executable evidence; the task does not claim PASS merely from counting headings in source text.

## Verification state

The branch implementation is committed, but this automation runtime could not establish a runnable repository checkout because its container cannot resolve `github.com`. Focused Vitest/static/build/package/full-suite gates therefore remain OPEN rather than being inferred.

Exact local procedure is recorded in `docs/development/verification/P2-T03A-retrieval-challenge-expansion.md`.

## Downstream requirement

P2-T04 must be restacked on this corrective task and rerun using the expanded corpus before its metrics can serve as strategy-selection evidence. P2-T05/P2-T06/P2-T08 comparisons must use the same expanded development candidate space.

Existing holdout data remains frozen and tuning-blind.

No PR is merged by this automation.
