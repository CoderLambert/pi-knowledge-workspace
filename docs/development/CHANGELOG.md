# Development Changelog

A concise progress log for Pi Knowledge Workspace.

Use this file to answer quickly:

> What development task changed most recently, what was delivered, and what is its current status?

Detailed implementation evidence belongs in `docs/development/reports/`. Human acceptance steps belong in `docs/development/verification/`.

## Format

```text
YYYY-MM-DD  TASK-ID  STATUS
- one-line outcome
- optional one-line important consequence / blocker
```

Only record task-level progress. Do not duplicate commit-by-commit history.

---

## 2026-09-09

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
- Tests assert the four-tool allowlist, absence of built-in shell/filesystem tools, and zero discovery of seeded project resources.
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