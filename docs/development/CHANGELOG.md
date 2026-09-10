# Development Changelog

A concise progress log for Pi Knowledge Workspace.

Use this file to answer quickly:

> What Product Slice, Product Milestone, important architecture decision, blocker or user-visible capability changed most recently?

Detailed implementation evidence belongs in `docs/development/reports/`. Human acceptance steps belong in `docs/development/verification/`.

## Format

```text
YYYY-MM-DD  SLICE/MILESTONE  STATUS
- one-line outcome
- optional one-line important consequence / blocker
```

Do not record Agent Work Units, routine commits, small wiring or cleanup-only activity. Record Product Slice completion, Product Milestones, important architecture decisions/blockers and meaningful user-visible capabilities. Do not duplicate implementation logs.

---

## 2026-09-10

### Development Policy V2 — ACCEPTED

- Adopted Product Slice First: a Product Slice is the default remote branch, Draft PR, CI and review unit; internal Agent Work Units use isolated worktrees and concise handoffs.
- Added Fast/Slice/Full verification gates. The 77 inherited ESLint findings are maintenance debt, not a zero-before-product-work target; existing rules remain enabled and Product Slice regressions must stay distinguishable.
- Replaced the lint-slice execution ledger with the product route: P3-T01 Exit → Reliable Knowledge → Grounded Ask → Product Preview → Lifecycle Safety/E2E → Slice A PASS → Quiz → P3 PASS.

### P3-T01 — PARTIAL

- Closed the inherited 12-error TypeScript blocker; `npm run typecheck` now passes in CI and `npm run verify` advances to ESLint.
- Historical support work reduced the inherited ESLint baseline to 77 without product, ADR, retrieval or P2-evidence changes.
- P3-T01 now exits by establishing a trustworthy P3 Product Slice regression gate; no S20/S21 or general lint cleanup is planned.

### P3-T00 — PASS

- Rebaselined the authoritative development plan and phase gates after ADR-029 acceptance; the stale pre-ADR Ask→separate-Notes task order is superseded.
- P3 now proceeds through P3-T01 baseline closure, Slice A production Knowledge closure, then Slice B first Derived Resource using shared canonical lineage/revision contracts.
- `VERIFICATION-DEBT.md` was intentionally left unchanged: the inherited Knowledge TypeScript failures are autonomous implementation debt owned by P3-T01, not deferred user-only verification debt.

### P2-T12 — PASS

- ADR-029 is Accepted: Pi owns canonical Knowledge truth and long-lived lineage; files/parsers/indexes/models/external RAG systems are replaceable inputs, projections or adapters.
- V1 retrieval remains SQLite FTS5 / `unicode61` / baseline lexical profile / `quoted-literal-or`; Dense/Hybrid/Qdrant remain outside V1 without new frozen evidence.
- Accepted contracts include captured-vs-published Source state, immutable ParsedArtifact interpretation identity, frozen GenerationRun scope, DeliveredEvidence, historical retention closure, business-commit fencing and DerivedArtifact immutable revisions.

### P2-T11 — PASS

- Existing-product comparison is decision-sufficient: AnythingLLM fixed-version evidence established mature generic local RAG viability and the tested historical-citation durability path.
- The full Open WebUI long benchmark was intentionally de-scoped after the architecture question split into Pi-owned canonical Knowledge semantics vs replaceable retrieval/RAG infrastructure; partial diagnostics remain preserved and untuned.
- Final stack hygiene was repaired with ordinary merge commits only; #54 and #44 both contain the latest #43 ancestry while retaining their exact task-owned scopes.

## 2026-09-09

### P1-T20 — PARTIAL

- Added `pi-knowledge backup --db --data-dir --output`, directory-format atomic publication, read-only online SQLite snapshot, manifest/hash closure, and verified SourceVersion blob export.
- Backup object closure is derived from the SQLite snapshot, never the mutable live connection; the command never migrates or retunes the source DB and never overwrites an existing backup destination.
- Complete backups with ParsedArtifacts intentionally fail closed until the missing production durable ParsedArtifact provider is wired. Real WAL/package execution and full artifact backup remain OPEN verification debt.

### P1-T19 — PARTIAL

- Added schema v7 `index_build_pins`, finite query leases, durable future-owner pins, bounded expired-pin cleanup and retained-IndexBuild GC.
- Search now atomically resolves the published active build and inserts a 60-second lease before retrieval, releasing it in `finally`; GC cannot delete active, live-leased or durable-pinned builds.
- GC removes only derived FTS/chunk/IndexBuild state and never SourceVersion/ParsedArtifact/Evidence history. Real multi-connection query/publication/GC races, crash-expiry and repository executable/static/build gates remain OPEN verification debt.

### P1-T18 — PARTIAL

- Added schema v6 and atomic IndexBuild publication using a Workspace-owned active-build pointer plus monotonically increasing generation and candidate base-generation/base-active snapshots.
- Publication requires explicit validation and a transactional compare-and-swap; stale or out-of-order rebuild completion cannot overwrite a newer active build, while the previous active build is retained for P1-T19 retention/GC.
- Replaced P1-T13's temporary latest-completed resolver with an active-published resolver. Real SQLite migration/CAS/out-of-order concurrency and repository executable/static/build gates remain OPEN verification debt.

### P1-T17 — PARTIAL

- Added the V1 single-concurrency durable worker loop over P1-T16: bounded expired-lease recovery, queued deadline expiry, deterministic candidate discovery, fenced claim, automatic heartbeat/cancellation and fenced terminal completion.
- The worker executes at most one handler per iteration, rejects stale terminal ownership as `lost-lease`, fails unknown job kinds explicitly and introduces no external queue/broker infrastructure.
- Added six loop-policy scenarios; real heartbeat timing, two-process kill/restart recovery, stale-worker fencing and repository executable/static/build gates remain OPEN verification debt.

### P1-T16 — PARTIAL

- Added schema v5 and a reusable durable job state machine with attempt count, lease owner/expiry, heartbeat, monotonically increasing fencing token, deadline, cancellation flag and bounded result/error metadata.
- Claim/heartbeat/completion use compare-and-swap ownership/fencing predicates so stale workers cannot commit a later attempt; expired leases can be recovered for P1-T17 worker-loop reuse.
- Added migration and scripted-database contract coverage; real `better-sqlite3`, concurrency/process-restart and repository static/build/test gates remain OPEN verification debt.

### P1-T15 — PARTIAL

- Added a host-authoritative Source / Evidence Viewer spanning PI WEB paired-backend operations, Workspace-scoped Source lists/details, SourceVersion history, ParsedArtifact rendering and UTF-8 byte-accurate Evidence highlights.
- Historical citations are fail-closed: an Evidence must belong to the explicitly requested historical ParsedArtifact, and the viewer never redirects it to the Source's latest version or rereads the mutable Workspace file.
- Added read-model, service-dispatch and paired-backend contract tests including updated-Source/historical-Evidence and CJK byte-boundary cases. Production `pi-knowledge` injection still depends on a durable P1-T08 `ParsedArtifactReadStore`; executable/static/browser/Fleet evidence remains OPEN verification debt.

### P1-T08 — PARTIAL

- Added deterministic MD/TXT ParsedArtifact canonicalization from immutable SourceVersion/blob bytes only; mutable Workspace paths are never reopened during parsing.
- Canonicalization validates UTF-8, strips an optional BOM, normalizes CRLF/lone CR to LF, preserves all other UTF-8 bytes, emits source mapping plus Markdown/TXT structural byte ranges, and fingerprints parser/normalization behavior.
- Added seven focused contract scenarios covering LF/CRLF/BOM, Chinese/emoji/combining characters, duplicated text, code/headings/lists/tables, TXT semantics, invalid UTF-8, deterministic artifact identity and SourceVersion/blob integrity. Executable/static/build evidence remains OPEN verification debt; P1-T09 may proceed against the documented canonical-byte contract.

### P1-T07 — PARTIAL

- Added schema v2 and a durable MD/TXT import-job path with Workspace-scoped idempotency keys, Source binding, attempt records, explicit retry, queued/in-flight cancellation, result persistence and restart recovery of interrupted jobs.
- Import execution consumes P1-T06 captured bytes directly and verifies the resulting P1-T05 SourceVersion hash/length matches that capture; it never reopens a validated path or trusts a caller-provided absolute Workspace root.
- Added schema-upgrade/rollback coverage and six import-job contract scenarios; native SQLite, process-restart and executable/static/build evidence remains OPEN verification debt. P1-T08 may parse immutable SourceVersion content only.

### P1-T06 — PARTIAL

- Added a safe Workspace file reader that accepts only explicit relative paths, canonicalizes root/target paths, rejects lexical and symlink escapes, blocks sensitive dotenv/SSH/private-key patterns, enforces a byte limit, and returns exact captured bytes plus SHA-256.
- Capture is bound to an opened file descriptor and revalidates descriptor/path identity and metadata after the read, so truncation, rewrite, removal, symlink retarget or path replacement fails closed instead of producing ambiguous bytes.
- Added eight filesystem-security contract scenarios; executable/static/build/target-filesystem evidence remains OPEN verification debt. P1-T07 may consume only successful captured bytes and must not reopen the path.

### P1-T05 — PARTIAL

- Added the Source/SourceVersion domain layer: create/list/rename/archive Source, capture/list immutable SourceVersions, and manual update through the same raw-byte capture path.
- Enforced the key invariant that metadata edits do not create versions and byte-identical recaptures reuse the existing `(source_id, content_sha256)` version; only changed raw bytes create a new SourceVersion.
- Added five contract tests using a database seam fake plus the real P1-T04 blob store; real SQLite/native-driver and executable repository gates remain OPEN verification debt.

### P1-T04 — PARTIAL

- Added immutable SHA-256 raw-byte storage at `blobs/sha256/<hash>` with store-owned hashing, strict hash/path validation, atomic no-overwrite hard-link publication, deduplication, verified reads, tamper detection and stale partial-temp cleanup.
- Added six contract tests covering exact byte roundtrip, repeated/concurrent dedupe, corruption fail-closed behavior, traversal-shaped invalid hashes, cleanup isolation and cleanup-age validation.
- Focused/static/build/package execution remains OPEN verification debt; P1-T05 may proceed against the narrow blob-store contract without treating P1-T04 as accepted.

### P1-T01 — PARTIAL

- Selected `better-sqlite3` 13.x as the proposed V1 Knowledge database driver and recorded the decision in ADR-028.
- Decision reason is feature determinism rather than benchmark speed: P1 requires FTS5, while `node:sqlite` FTS5 availability varies across official Node builds; current `better-sqlite3` explicitly compiles FTS5 and supports Node >=22.
- Target Omarchy/Linux native-package, FTS5, transaction, backup and extension-loading checks remain OPEN verification debt; P1-T02 may proceed without adding a dual-driver abstraction.

### P0-T08 — PARTIAL

- Completed the P0 gate review without adding production code; the thin-fork integration boundary remains viable and no invasive Machine/Workspace/Session rewrite or Knowledge-specific federation stack is required.
- P0 cannot be declared PASS while mandatory P0-T04 through P0-T07 executable/local/Fleet/runtime verification debt remains OPEN.
- Added the gate matrix, closure procedure and explicit P0 acceptance backlog; autonomous implementation may proceed to P1-T01 against documented contracts, but later work must not reinterpret P0 as accepted.

### P0-T07 — PARTIAL

- Added a repository-owned restricted Pi SDK runtime probe with exactly four model-visible tools: `knowledge_sources`, `knowledge_search`, `knowledge_read`, and `submit_answer`.
- The probe disables project/global extensions, skills, prompt templates, themes, AGENTS/context files, persisted settings/sessions, models.json loading, credential-file loading, and model-network refresh.
- Tests assert the four-tool allowlist, absence of built-in shell/filesystem tools, and zero discovery of seeded project/global resources or persisted command credentials/configuration.
- Focused/static/build/package execution remains OPEN verification debt; P0-T07 stays PARTIAL until executable evidence is recorded.

### P0-T06 — PARTIAL

- Added deterministic selected-Machine Knowledge federation coverage over PI WEB's existing generic paired-backend Machine route; no Knowledge-specific production routing was added.
- Written cases cover explicit local routing, selected target routing, target unavailable, target `pi-knowledge` unavailable, A→B switching, cancellation propagation, and zero gateway-local fallback.
- Focused/static/build/package execution plus physical two-instance and real Fleet/multi-host acceptance remain OPEN verification debt.
- Under the autonomous-development policy, P0-T07 may proceed on a separate stacked branch while P0-T06 remains PARTIAL.

### P0-T05 — PARTIAL

- Added repository-owned local Knowledge cross-layer E2E coverage: browser panel → real sessiond paired-backend HTTP route → `PluginBackendRegistry` host scope → Knowledge adapter → real loopback `pi-knowledge` → UI.
- Automated scenarios are written for success, service-unavailable/restart recovery, wrong token, and incompatible protocol; no PI WEB core route/navigation/federation implementation was changed.
- Focused/static/build execution and real browser/web/API/sessiond/Workspace-switching/timeout acceptance remain OPEN verification debt.
- Under the autonomous-development policy, P0-T06 may proceed on a separate stacked branch while P0-T05 remains PARTIAL.

### P0-T04 — PARTIAL

- Thin Knowledge server-plugin adapter implemented: host-authoritative `PairedPluginRequestContext` scope is sent to standalone `pi-knowledge` through authenticated loopback HTTP using fixed `workspace.echo` dispatch.
- Browser input cannot choose service host/port/token/operation or override Project/Workspace scope; service echo mismatches, non-loopback targets, oversized traffic, protocol/request-id mismatches, cancellation and deadlines fail closed.
- Focused adapter tests were added, including direct client → real P0-T03 Fastify service coverage; executable test/static/build and real local sessiond→service evidence is recorded as deferred verification debt.
- Under the autonomous-development policy, P0-T05 may proceed on a separate stacked branch while P0-T04 remains PARTIAL.

### P0-T03 — PASS

- Standalone authenticated loopback `pi-knowledge` process/contract accepted with protocol v1, `capabilities.get`, `workspace.echo`, stable errors, auth, request/response bounds, and independent process lifecycle.
- Focused tests passed 14/14; TypeScript, ESLint, knip, build, package dry-run, dist entry, and diff check passed.
- Full suite recorded 3752 passed / 1 inherited failed / 2 skipped; the sole `piSessionService.promptQueue` failure matches the P0-T01/P0-T02 inherited baseline and is not a P0-T03 regression.
- Real built-process acceptance passed loopback bind, non-loopback rejection, health/dispatch, negative cases, request/response limits, and clean SIGINT/SIGTERM shutdown. P0-T04 was not started.

### P0-T02 — PASS

- Knowledge Workspace paired-plugin skeleton accepted locally.
- Host-authoritative Project / Workspace / Path and Workspace switching were verified.
- Git worktree scope and existing Files / Terminal / Git / Chat behavior were verified without regression.
- The sole remaining full-suite auth/session failure was reproduced on the P0-T01 baseline and classified as inherited.

## 2026-09-08

### P0-T01 — PASS

- Verified the stable Knowledge integration seams: Workspace Panel + paired backend + existing selected-machine federation + authoritative server Workspace context.
- Corrected the plan to reuse PI WEB plugin/federation infrastructure instead of building custom navigation, gateway, or Fleet routing.
