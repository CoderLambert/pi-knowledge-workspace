# P1-T15 Verification — Source / Evidence Viewer

Status: **OPEN / PARTIAL**

Branch: `feat/p1-source-evidence-viewer`

Direct base: `feat/p1-evidence-read-api`

## Automated/static gates

Run from a clean checkout of this branch:

```bash
npm ci
npm run typecheck
npm run lint
npm run knip
npm test
npm run build
npm run pack:dry
```

Focused tests:

```bash
npx vitest run \
  src/knowledge/storage/sourceEvidenceViewer.test.ts \
  src/knowledge/storage/sourceEvidenceViewer.utf8.test.ts \
  src/knowledge/service/viewerDispatch.test.ts \
  pi-web-plugins/knowledge/server-plugin.viewer.test.ts
```

Expected PASS evidence:

- all commands exit 0;
- viewer tests demonstrate historical SourceVersion/ParsedArtifact retention;
- no TypeScript/lint/knip regression attributable to P1-T15;
- built browser/server plugins contain only the paired-backend viewer path.

The current execution environment cannot resolve `github.com`, so the repository cannot be cloned and these commands cannot be run here. Do not mark them PASS without captured command output or CI results for the branch HEAD.

## Runtime dependency gate — durable ParsedArtifact reads

P1-T15 intentionally depends on the P1-T14 `ParsedArtifactReadStore` contract. Before P1-T15 can be PASS in production, wire a repository-owned implementation backed by immutable SourceVersion/ParsedArtifact data and inject `KnowledgeViewerDispatch` into standalone `pi-knowledge` startup.

Required steps:

1. Create/import a Markdown or text Source into a real Knowledge database/blob store.
2. Materialize or deterministically reconstruct its canonical ParsedArtifact from immutable SourceVersion bytes according to the P1-T08 contract.
3. Restart `pi-knowledge`.
4. Call the viewer list/detail/artifact operations through PI WEB paired backend.
5. Confirm canonical text and document structure are read after restart without reopening the mutable Workspace source file.

Expected PASS evidence:

- identical ParsedArtifact identity/content before and after process restart;
- no read of current Workspace file during viewer open;
- database lineage and artifact-store lineage match;
- viewer capability is advertised by the running service only when the runtime dependency is configured.

## Historical citation acceptance

Prepare one Source with two versions:

1. Import `guide.md` containing a unique sentence.
2. Create Evidence pointing at that sentence in SourceVersion V1 / ParsedArtifact A1.
3. Modify the Workspace file so the sentence is removed or changed.
4. Import the changed bytes as SourceVersion V2 / ParsedArtifact A2.
5. In the viewer, open A1 with the V1 Evidence id.

Expected PASS evidence:

- UI labels V1 as historical and V2 as latest;
- V1 Evidence opens A1/V1, not A2/V2;
- exact Evidence text is highlighted;
- Evidence quote/hash revalidation succeeds against A1;
- attempting to open the same Evidence against A2 fails closed.

## UTF-8 acceptance

Use a document containing CJK, emoji and combining characters. Open it with a small bounded artifact view and with Evidence context.

Expected PASS evidence:

- no replacement character (`�`);
- no fatal decoder errors;
- highlighted substring exactly matches Evidence `exact_quote`;
- byte offsets remain correct despite JavaScript UTF-16 string indexing differences.

## PI WEB / Machine / Workspace acceptance

This requires a running PI WEB plus `pi-knowledge`; selected-Machine/Fleet verification additionally requires the appropriate multi-instance setup.

Steps:

1. Open Knowledge on local Machine/Workspace A and record Source list.
2. Switch to Workspace B and confirm A's Sources are absent unless independently imported there.
3. Where Fleet is available, select a remote Machine with a distinct Knowledge dataset.
4. Refresh the viewer and confirm only that selected Machine's paired backend/data is visible.
5. Attempt browser-authored scope/path/proxy fields using devtools or a focused transport test.

Expected PASS evidence:

- browser calls only `context.pairedBackend`;
- PI WEB injects authoritative Project/Workspace scope;
- cross-Workspace and cross-Machine data does not leak;
- no gateway-local fallback occurs for a remote selected Machine;
- spoofed scope/proxy-shaped input is rejected before `pi-knowledge` dispatch.

## Scope review

Compare against the direct stacked base:

```bash
git diff --stat feat/p1-evidence-read-api...feat/p1-source-evidence-viewer
git diff --name-status feat/p1-evidence-read-api...feat/p1-source-evidence-viewer
```

Expected scope: Source/Evidence viewer read model, viewer transport/UI, P1-T15 tests, report/verification/changelog/plan/debt only. There must be no P1-T16 worker/job implementation, retrieval/vector work, or unrelated PI WEB changes.
