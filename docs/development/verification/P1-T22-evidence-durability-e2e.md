# P1-T22 — Evidence Durability E2E Verification

## Status

**PARTIAL** until the integrated lifecycle and P1 phase-gate debt below are executed and recorded.

Branch: `test/p1-evidence-durability-e2e`  
Direct base: `feat/p1-restore-cli` (P1-T21 / PR #31)

## 1. Focused durability lifecycle

From a clean checkout with the repository dependency tree installed:

```bash
npm test -- src/knowledge/storage/evidenceDurability.e2e.test.ts --reporter=verbose
```

Expected: the single integrated scenario passes.

The scenario must prove, without changing the historical Evidence address:

```text
Import selected MD
→ immutable SourceVersion/blob
→ canonical ParsedArtifact
→ FTS5 IndexBuild + Search hit
→ server-derived Evidence
→ different rechunk build
→ different parser-version artifact/build
→ Source update/current artifact/build
→ GC replaced IndexBuilds
→ close/reopen database
→ historical Evidence read
→ consistent backup
→ integrity-checked restore
→ exact original Evidence read from restored historical artifact
```

The exact Evidence contains Chinese and emoji bytes. The search step uses the ASCII fixture token `durabilityanchor` deliberately: P1-T22 is a durability gate, not the P2 retrieval-quality evaluation.

## 2. Required static/build/package gates

Run:

```bash
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
```

Any P1-T22-attributable failure must be fixed on this branch. Do not patch unrelated inherited PI WEB baseline failures merely to make a gate appear green.

`knip` must no longer report `better-sqlite3` as an unlisted dependency before P1 can close. The package/lockfile must be generated atomically by npm rather than hand-edited.

## 3. Full regression suite

Run:

```bash
npm test
```

Record exact test-file and test counts. Compare failures against the already classified inherited baseline and the separately tracked P0 fixes. Any new failure attributable to the P1 stack blocks T22/P1 acceptance.

## 4. Direct-base scope

```bash
git diff --check origin/feat/p1-restore-cli...HEAD
git diff --name-status origin/feat/p1-restore-cli...HEAD
```

Expected task scope:

- `src/knowledge/storage/evidenceDurability.e2e.test.ts`;
- P1-T22 report;
- P1-T22 verification guide;
- only safe bookkeeping updates if later added.

No P2 retrieval-evaluation implementation belongs on this branch.

## 5. Production ParsedArtifact durability acceptance

The repository-owned E2E currently uses a test-only immutable artifact bundle because no production durable ParsedArtifact materialization/read store exists yet.

Before P1 PASS, wire the production implementation to the existing narrow contracts used by:

- `EvidenceReadApi` / viewer;
- `KnowledgeBackupCreator`;
- `KnowledgeRestore`.

Then repeat the lifecycle using the production provider. Do not reconstruct historical artifacts by rereading the mutable Workspace file.

Expected evidence:

- old canonical bytes remain addressable by exact ParsedArtifact id after Source update;
- backup contains all SQLite-referenced artifact bundles;
- restore validates every artifact hash/lineage entry;
- every restored Evidence row passes quote/hash revalidation before restore publication;
- opening the historical citation after restore returns the original exact quote, not current Source content.

## 6. Process restart / GC checks

Confirm the lifecycle closes and reopens the file-backed database between GC and backup. After GC, inspect that replaced IndexBuild/chunk rows were removed while historical entities remain:

```text
SourceVersion: present
ParsedArtifact: present
Evidence: present
old retained IndexBuilds/chunks: removed
active current IndexBuild: present
```

## 7. Backup / restore integrity negatives

P1-T20/T21 focused tests already cover tamper cases. For final phase acceptance, retain evidence that corruption of any of these fails closed before destination publication:

- manifest checksum;
- SQLite file hash/size/integrity/schema;
- blob hash/size/closure;
- ParsedArtifact bundle hash/metadata/closure;
- restored Evidence quote/hash verification.

## 8. PASS criteria

P1-T22 may become PASS only when:

1. the integrated lifecycle test passes on the supported real SQLite/FTS5 runtime;
2. typecheck/lint/knip/build/pack gates have no T22-attributable failure;
3. the full suite has no new P1-attributable failure;
4. direct-base diff is task-only;
5. production ParsedArtifact durability is wired and the same historical Evidence invariant passes without the test fixture provider;
6. packaged `pi-knowledge` resolves its declared native SQLite dependency;
7. all mandatory P1 phase-gate verification debt is closed or intentionally removed by a documented architecture decision.

Until all seven conditions hold, T22 and P1 remain **PARTIAL**.