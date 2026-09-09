# Pi Knowledge Workspace — Complete Development Plan

Status: **Active Development Baseline**  
Repository: `CoderLambert/pi-knowledge-workspace`  
Strategy: **Thin Fork + standalone pi-knowledge process**  
V1 product loop: **Source → Evidence → Restricted Ask → Saved Note**

This document is the authoritative task-level development plan.

`PHASES.md` defines phase goals and gates. This document defines the concrete tasks, dependencies, deliverables, verification requirements, and completion order inside those phases.

Every behavior-changing task must also follow:

- [`REPORTING.md`](./REPORTING.md) — repository implementation report;
- [`VERIFICATION.md`](./VERIFICATION.md) — human/user verification guide.

A task is not complete merely because code exists.

---

# 1. Global execution rules

## 1.1 Task lifecycle

```text
Plan task
→ inspect current code
→ implement minimal scope
→ automated tests
→ build / static verification
→ development report
→ human verification guide
→ run all verification available to the current execution environment
→ if external-only verification remains: PARTIAL + explicit verification debt
→ continue later implementation where dependency-safe
→ record deferred verification evidence when available
→ update plan/index/ADR if required
→ PASS / PARTIAL / BLOCKED
```

## 1.2 Status

- **PASS** — required implementation, verification, report and verification guide are complete.
- **PARTIAL** — implementation exists, but one or more required verification gates remain outstanding.
- **BLOCKED** — task cannot satisfy its objective without changing an architectural assumption or dependency.
- **TODO** — not started.

## 1.3 Deferred verification policy

PASS standards do not change, but local/manual verification may be deferred so it does not unnecessarily block implementation progress.

When the only remaining gates require capabilities unavailable to the current automation/execution environment — for example the user's local machine, browser/UI interaction, Fleet/multi-instance setup, system services, hardware, or environment-specific integration — use the following rules:

1. Keep the task **PARTIAL**; do not label it PASS.
2. Record an explicit **verification debt** in the task report and verification guide, including the exact checks/evidence still required.
3. Continue to the next planned task when the implemented interfaces, automated/static checks, and dependency contracts are sufficiently stable for later work.
4. Do not use deferred verification as permission to ignore a genuine dependency. If a later task depends on an unverified invariant and proceeding could invalidate the implementation, stop at that specific dependency and record it as the blocker.
5. When the user later has time, deferred verification may be completed in batches; successful evidence upgrades the corresponding PARTIAL task to PASS.
6. Phase gates and release gates remain strict. A phase/release cannot be declared PASS while required verification debt for that gate remains unresolved.

This policy separates **development progression** from **final acceptance**: implementation may advance ahead of human/environment-specific acceptance, but acceptance evidence is never fabricated or silently waived.

## 1.4 Development discipline

1. Read existing PI WEB patterns before modifying code.
2. Prefer public, upstream-supported seams over core patches.
3. Keep Machine / Project / Workspace / Session / Terminal / Git upstream-first.
4. Keep heavy Knowledge work outside sessiond.
5. Do not introduce distributed infrastructure for a single-user local-first product.
6. Do not add framework abstractions unless a concrete second implementation needs them.
7. Do not mix upstream synchronization with Knowledge feature development in one PR.
8. One PR should have one clearly describable concern.
9. Every architecture-changing task updates the relevant ADR/baseline.
10. Every behavior-changing task gets a reproducible user verification guide.

---

# 2. Phase overview

```text
P0  Integration / security / process boundary
 ↓
P1  Stable Evidence Core
 ↓
P2  Retrieval Evaluation
 ↓
P3  Grounded Ask + Notes = V1 feature complete
 ↓
P4  Product hardening / release validation
 ↓
P5  Course V1.1
```

---

# 3. P0 — Integration Boundary

Goal:

> Prove that Knowledge can be added as a first-class workspace capability while reusing PI WEB's existing plugin, workspace, machine and federation infrastructure, and while keeping Knowledge processing in an independent process.

P0 is deliberately bounded. It must not drift into ingestion, RAG, embeddings or course generation.

## P0-T01 — Integration Seam Analysis

**Status:** PASS

### Objective

Identify the smallest stable PI WEB extension points for:

- Workspace UI;
- selected Workspace context;
- browser/server transport;
- server-authoritative Workspace scope;
- Machine/Fleet routing;
- process/runtime entry points.

### Result

Chosen path:

```text
Bundled Knowledge Workspace Panel
→ WorkspacePanelContext.pairedBackend
→ existing PI WEB paired backend transport
→ existing selected-machine federation
→ PairedPluginRequestContext
→ Knowledge server plugin
→ future standalone pi-knowledge service
```

### Deliverables

- `docs/development/P0-INTEGRATION-SEAMS.md`
- `docs/development/reports/P0-T01-integration-seams.md`

### Important correction to the original plan

Do **not** add a second AppShell/navigation system, custom browser gateway, or custom Fleet protocol.

---

## P0-T02 — Knowledge bundled paired-plugin skeleton

**Status:** PASS

### Objective

Build the first runnable Knowledge surface using only the public seams proven by P0-T01.

### Deliverables

```text
pi-web-plugins/knowledge/
├── package.json
├── browser/pi-web-plugin.ts
├── server-plugin.ts
├── pi-web-plugin.test.ts
└── server-plugin.test.ts
```

### Behavior

```text
Knowledge Workspace Panel
→ pairedBackend.request("knowledge.status", null)
→ Knowledge server plugin
→ host-authoritative Project / Workspace scope
→ UI
```

### Core invariants

- Browser cannot choose authoritative Workspace path.
- No PI WEB core navigation patch.
- No parsing/database/model work inside sessiond.
- Runtime-qualified plugin identity is used for remote Machine correctness.

### Required docs

- report: `docs/development/reports/P0-T02-knowledge-plugin-skeleton.md`
- verification: `docs/development/verification/P0-T02-knowledge-plugin-skeleton.md`

### Exit

PASS only after required test/build/manual verification has actually run successfully.

### Result

Accepted locally on 2026-09-09. Knowledge UI, authoritative Project / Workspace / Path, Workspace switching, Git worktree path handling, Files / Terminal / Git / Chat regression checks, spoofed-scope rejection and unsupported-operation rejection all passed. The sole remaining full-suite auth/session failure was reproduced unchanged on the P0-T01 baseline and is classified as inherited rather than a P0-T02 regression.

---

## P0-T03 — Standalone pi-knowledge contract + process skeleton

**Status:** PASS

### Objective

Introduce the external process boundary without implementing persistent Knowledge behavior.

### Add

Recommended source boundary:

```text
src/knowledge/
├── contracts/
│   ├── protocol.ts
│   ├── operations.ts
│   ├── schemas.ts
│   └── errors.ts
└── service/
    ├── main.ts
    ├── app.ts
    ├── config.ts
    ├── health.ts
    └── dispatch.ts
```

Exact paths may change after reading current repository conventions.

### Initial operations

```text
capabilities.get
workspace.echo
```

### Transport

Authenticated loopback HTTP/JSON.

Initial endpoints:

```text
GET  /v1/health
POST /v1/dispatch
```

### Requirements

- loopback bind by default;
- protocol version;
- bounded request body;
- bounded response;
- operation allowlist;
- request id;
- structured error shape;
- no arbitrary proxy target;
- no SQLite yet;
- no model calls.

### Verification

Must prove the standalone process starts/stops independently and rejects malformed/version-incompatible requests.

### Result

Accepted locally on 2026-09-09. The standalone authenticated loopback Fastify service, protocol v1, `capabilities.get`, `workspace.echo`, stable error envelopes, request/response bounds, and build/bin integration all passed acceptance. Focused tests passed 14/14; TypeScript, ESLint, knip, build, package dry-run, dist entry, and diff check passed. The full suite recorded 3752 passed / 1 inherited failed / 2 skipped; the sole `piSessionService.promptQueue` failure matches the P0-T01/P0-T02 inherited baseline and is not a P0-T03 regression. Real built-process acceptance passed independent start, loopback-only bind, non-loopback rejection, health/dispatch, auth/schema/version/operation negative cases, request/response size limits, and clean SIGINT/SIGTERM shutdown. P0-T04 was not started.

Required records:

- report: `docs/development/reports/P0-T03-standalone-pi-knowledge-service.md`
- verification: `docs/development/verification/P0-T03-standalone-pi-knowledge-service.md`

---

## P0-T04 — Thin server-plugin → pi-knowledge adapter

**Status:** PARTIAL

### Objective

Replace P0-T02's in-sessiond `knowledge.status` implementation with a thin adapter to the standalone service.

### Request path

```text
Browser Knowledge Panel
→ pairedBackend
→ selected Machine sessiond
→ Knowledge server plugin
→ authenticated loopback HTTP
→ pi-knowledge
→ response
```

### Requirements

Server plugin responsibilities are limited to:

- read authoritative `PairedPluginRequestContext`;
- create bounded service request;
- authenticate to local service;
- propagate cancellation/deadline;
- parse bounded response;
- map errors.

It must not:

- parse documents;
- access DB directly;
- embed data;
- invoke LLM;
- run long CPU work.

### Security

Browser `input` cannot override host Project/Workspace identity.

### Current state

Implementation is present on `feat/p0-thin-knowledge-adapter` / PR #6. `knowledge.status` now derives Project / Workspace / Path only from host-owned `PairedPluginRequestContext`, sends a fixed authenticated loopback `workspace.echo` request to `pi-knowledge`, propagates host cancellation plus a bounded adapter deadline, bounds request/streamed-response bytes, validates protocol/request-id correlation, and accepts the service result only when it exactly matches host-authoritative scope. Browser code receives no service host, port, token, operation authority, or scope authority.

Focused tests are written for the adapter and client, including a real client → P0-T03 Fastify service call on a random loopback port. Required executable focused/static/build/full-suite and real local server-plugin→service evidence is not yet available in the autonomous execution environment and is recorded as OPEN verification debt in `docs/development/VERIFICATION-DEBT.md`.

Required records:

- report: `docs/development/reports/P0-T04-thin-server-plugin-adapter.md`
- verification: `docs/development/verification/P0-T04-thin-server-plugin-adapter.md`

Under the autonomous-development policy P0-T05 implementation may proceed on a separate stacked branch while P0-T04 remains PARTIAL. P0-T04 cannot become PASS until its recorded verification debt is resolved.

---

## P0-T05 — Local integration E2E

**Status:** PARTIAL

### Objective

Prove the complete local chain in a real dev checkout.

### E2E

```text
Select Workspace
→ open Knowledge
→ Check integration
→ pairedBackend
→ Knowledge server plugin
→ standalone pi-knowledge
→ authoritative scope returned
→ UI renders ready
```

### Failure cases

- service not running;
- wrong protocol version;
- bad service token;
- request timeout;
- service restart.

### Exit

A user can follow the verification guide and reproduce success/failure behavior without code inspection.

### Current state

Repository-owned cross-layer E2E coverage is present on `test/p0-local-knowledge-integration-e2e` / PR #7. The test drives the real Knowledge browser panel through the real sessiond paired-plugin HTTP route, `PluginBackendRegistry` host workspace resolution, the real P0-T04 Knowledge adapter, authenticated loopback HTTP and a real P0-T03 `pi-knowledge` Fastify listener. Written scenarios cover local success, service unavailable followed by restart recovery, wrong token fail-closed behavior, and incompatible protocol rejection.

The test deliberately does not modify PI WEB core routes or create a Knowledge-specific browser transport. Actual execution evidence and a physical Browser → web/API process → sessiond process → service run, Workspace A→B→A switching, real request-timeout observation and regression smoke remain OPEN verification debt.

Required records:

- report: `docs/development/reports/P0-T05-local-integration-e2e.md`
- verification: `docs/development/verification/P0-T05-local-integration-e2e.md`

Under the autonomous-development policy P0-T06 may proceed on a separate stacked branch while P0-T05 remains PARTIAL. P0-T05 cannot become PASS until its recorded verification debt is resolved.

---

## P0-T06 — Selected Machine / Fleet routing verification

**Status:** PARTIAL

### Objective

Prove that Knowledge follows PI WEB's selected Machine rather than browser/gateway localhost.

### First test

Two isolated local PI WEB instances may be used to prove routing contract:

```text
Gateway instance
→ selected Target instance
→ Target sessiond
→ Target pi-knowledge
```

### Required cases

- local Machine;
- selected target Machine;
- target unavailable;
- target pi-knowledge unavailable;
- switch target during/after request;
- cancellation propagation;
- no fallback to gateway-local Knowledge.

### Important wording

Two-local-instance validation proves routing semantics only. It must not be described as real remote Fleet E2E.

### Current state

Repository-owned selected-Machine federation contract coverage exists on PR #8. Required executable, physical two-instance and real Fleet/multi-host evidence remains OPEN verification debt.

---

## P0-T07 — Restricted Pi Runtime probe

**Status:** PARTIAL

### Objective

Convert the previous Astra spike into repository-owned executable tests.

### Runtime contract

Only these four model-visible tools:

```text
knowledge_sources
knowledge_search
knowledge_read
submit_answer
```

### Required isolation

- custom empty ResourceLoader;
- in-memory settings;
- in-memory session;
- explicit tool allowlist;
- filtered credential store;
- `modelsPath: null` or equivalent current API;
- no project/global AGENTS, skills, extensions, prompt templates.

### Must prove absent

```text
bash
filesystem read
write
edit
arbitrary network
project extensions
command credentials
```

### Current state

Repository-owned restricted-runtime probe exists on PR #9 with exact four-tool allowlist tests and hostile-resource discovery checks. Executable repository verification remains OPEN debt.

---

## P0-T08 — P0 Gate Review

**Status:** PARTIAL

### PASS conditions

- Knowledge Workspace surface works;
- authoritative Workspace scope confirmed;
- standalone process boundary works;
- local integration works;
- selected-Machine routing contract works;
- restricted runtime contract works;
- no invasive Machine/Workspace/Session rewrite is required;
- reports and verification guides are complete.

### Stop condition

If Knowledge requires widespread private PI WEB core patches or duplicating Machine/Workspace infrastructure, stop and review architecture before P1.

### Current state

Gate review is documented on PR #10. Architecture remains viable, but P0 is not PASS because P0-T04 through P0-T07 mandatory acceptance debt remains OPEN. Autonomous P1 implementation proceeds only under `AUTONOMOUS-EXECUTION.md`.

---

# 4. P1 — Stable Evidence Core

Goal:

> Build a reliable knowledge data system without depending on LLM quality.

Primary vertical slice:

```text
Import MD/TXT
→ immutable SourceVersion
→ ParsedArtifact
→ IndexBuild
→ Search
→ Stable Evidence
→ Source Viewer
```

## P1-T01 — SQLite driver decision spike

**Status:** PARTIAL

Compare only the realistic candidates supported by the current runtime, primarily:

```text
node:sqlite
better-sqlite3
```

Evaluate:

- FTS5;
- transactions;
- backup;
- extension loading;
- Node support;
- packaging;
- blocking behavior.

Deliver ADR; do not create a generic DB abstraction framework.

Current decision: ADR-028 selects `better-sqlite3` 13.x. Target Omarchy/Linux native binding, FTS5, backup and packaging acceptance remains OPEN verification debt.

---

## P1-T02 — Database bootstrap and migrations

**Status:** PARTIAL

Create migration runner and initial schema.

Initial entities:

```text
installations
knowledge_workspaces
sources
source_versions
parsed_artifacts
index_builds
chunks
evidence
jobs
job_attempts
```

Requirements:

- fresh DB creation;
- ordered migrations;
- schema version;
- incompatible future schema fails closed;
- transaction helpers.

Current implementation exists on PR #12; real native-driver execution remains unverified.

---

## P1-T03 — Knowledge installation / Workspace identity

**Status:** PARTIAL

Implement durable Knowledge identity separate from PI WEB routing identity:

```text
installation_id
knowledge_workspace_id
external PI WEB binding
canonical realpath
```

V1 default: different worktrees are isolated Knowledge Workspaces.

Current implementation exists on PR #13 with contract tests; real SQLite/native-driver execution remains deferred.

---

## P1-T04 — Content-addressed blob store

**Status:** PARTIAL

Implement immutable raw-byte storage:

```text
blobs/sha256/<hash>
```

Requirements:

- SHA-256;
- atomic write;
- dedupe;
- verify-on-read tools;
- partial temp cleanup.

Current implementation exists on PR #14. It uses store-owned SHA-256 addressing, atomic no-overwrite same-directory hard-link publication, repeated/concurrent dedupe, verified reads/tamper failure, strict hash validation and stale store-owned temp cleanup. Six focused tests are written; executable/static/build/filesystem acceptance remains OPEN debt.

---

## P1-T05 — Source + SourceVersion domain

**Status:** PARTIAL

Implement:

- create Source;
- list Source;
- archive Source;
- capture immutable SourceVersion;
- manual update.

Invariant:

> Only raw source byte changes produce a new SourceVersion.

Metadata edits do not.

Current implementation exists on PR #15. Source metadata operations do not create versions; byte-identical captures reuse the existing `(source_id, content_sha256)` version; changed raw bytes produce a new immutable SourceVersion backed by the P1-T04 content address. Five contract tests are written; executable and real SQLite acceptance remains OPEN debt.

---

## P1-T06 — Safe Workspace file reader

**Status:** TODO

Support explicitly selected Workspace files.

Server-side requirements:

- relative path only;
- realpath containment;
- symlink escape defense;
- max size;
- sensitive-file guard;
- captured content hash;
- file-change race handling.

Tests include:

```text
../
symlink escape
.env
SSH/private key patterns
oversized file
file replaced during capture
```

---

## P1-T07 — MD/TXT import job

Build first durable import path:

```text
submit job
→ safe capture
→ blob
→ SourceVersion
```

Requirements:

- idempotency;
- retry;
- cancellation;
- restart-safe job state.

---

## P1-T08 — ParsedArtifact canonicalization

Implement Markdown/TXT parsing.

Output:

```text
canonical UTF-8 text
document structure
source mapping
parser fingerprint
normalization fingerprint
artifact hash
```

Test:

- LF/CRLF;
- BOM;
- Chinese;
- emoji;
- code blocks;
- headings;
- lists;
- tables;
- duplicated text.

---

## P1-T09 — UTF-8 stable range library

Implement the Evidence addressing primitive:

```text
[startByte, endByte)
```

Functions should cover:

- boundary validation;
- byte slicing;
- quote extraction;
- quote hash;
- exact verification.

Tests:

```text
ASCII
中文
emoji
combining characters
duplicate quotes
invalid byte boundary
```

---

## P1-T10 — Stable Evidence entity

Evidence stores at minimum:

```text
parsed_artifact_id
start_byte
end_byte
exact_quote
quote_hash
locator_snapshot
```

Evidence must be created from authoritative artifact bytes/text on the server.

Callers cannot submit an arbitrary quote as authoritative Evidence.

---

## P1-T11 — Structure-aware chunker

Markdown strategy:

```text
Heading
Paragraph
List
Code block
Table
```

Only oversized nodes/sections are further split.

Initial token target may be approximately 400–800 tokens but is experimental, not contract.

---

## P1-T12 — FTS5 baseline index

Implement lexical baseline, initially using FTS5 `unicode61` if supported by chosen driver.

Required scope filtering:

```text
Workspace / SourceVersion / IndexBuild scope
→ ranking
→ Top-K
```

Never:

```text
global Top-K
→ filter afterwards
```

---

## P1-T13 — Search API baseline

Implement `search.query`.

Input includes:

- Knowledge Workspace;
- query;
- optional allowed SourceVersion ids;
- limit/budget.

Response includes:

- stable run/query handles;
- source metadata;
- snippet;
- locator;
- rank/debug metadata where appropriate.

---

## P1-T14 — Evidence read API

Implement bounded read expansion around a stable Evidence/range.

Support:

- exact Evidence;
- nearby context;
- containing section.

Never cross the same ParsedArtifact boundary implicitly.

---

## P1-T15 — Source / Evidence Viewer

Add Knowledge UI for:

- Sources list;
- Source detail;
- SourceVersion history;
- ParsedArtifact view;
- Evidence highlight.

Critical rule:

> Clicking a historical citation opens the historical SourceVersion/ParsedArtifact, not latest content.

---

## P1-T16 — Durable Job state machine

States:

```text
queued
running
succeeded
failed
cancelled
```

Store:

- attempt;
- idempotency key;
- lease;
- heartbeat;
- fencing token;
- deadline;
- cancelRequested;
- bounded error/result metadata.

---

## P1-T17 — Worker loop and crash recovery

V1 concurrency can remain small:

```text
1 heavy ingestion/rebuild worker
```

Implement:

- claim;
- heartbeat;
- stale-running recovery;
- retry;
- timeout;
- cancellation.

No Redis/RabbitMQ/Kafka.

---

## P1-T18 — Atomic IndexBuild publication

Correct model:

```text
A active
→ build B in staging
→ validate B
→ CAS/fenced publish
→ B active
→ A retained until safe GC
```

Failure keeps A active.

Must test out-of-order concurrent rebuild completion.

---

## P1-T19 — Pin / lease / GC

Implement retention semantics for:

- active queries;
- active Answer runs later;
- Saved Note references later;
- old unreferenced IndexBuilds;
- archived sources.

Stable means immutable while referenced, not “never delete”.

---

## P1-T20 — Backup CLI

Implement:

```text
pi-knowledge backup
```

Backup includes:

- consistent SQLite snapshot;
- referenced blobs/artifacts;
- manifest;
- hashes;
- schema/version metadata.

---

## P1-T21 — Restore CLI

Implement restore into a controlled location with full integrity checks.

Restore success means historical Evidence can still resolve, not merely “SQLite opens”.

---

## P1-T22 — Evidence durability E2E

Required scenario:

```text
Import
→ Parse
→ Search
→ create/open Evidence
→ rechunk
→ reparse
→ Source update
→ old index GC
→ process restart
→ backup
→ restore
→ original Evidence still resolves to exact historical text
```

P1 does not pass until this works.

---

# 5. P2 — Retrieval Evaluation

Goal:

> Select the retrieval stack from evidence rather than architecture preference.

## P2-T01 — Golden Dataset schema

Create:

```text
eval/
├── corpus/
├── queries/
├── labels/
├── fixtures/
└── reports/
```

Label stable ParsedArtifact ranges, never Chunk ids.

---

## P2-T02 — First representative corpus

Use real technical material, with at least:

- Chinese documentation;
- English documentation;
- code/API-heavy material;
- multiple source versions;
- conflicting/missing facts.

Record source/capture/version metadata.

---

## P2-T03 — Query annotation

Initial target:

```text
~80 queries
50 development
30 holdout
```

Categories:

```text
exact API
version/error code
semantic
Chinese
English
Chinese-English mixed
code symbol
multi-source
conflict
no-answer
```

---

## P2-T04 — FTS baseline report

Run current FTS baseline and publish failures, not only aggregate score.

Metrics:

- Recall@10;
- MRR;
- category failure counts;
- latency;
- memory/index size.

---

## P2-T05 — Chinese / code lexical normalization experiment

Evaluate the smallest useful combination of:

- Chinese segmentation;
- code-symbol derived fields;
- camelCase split;
- snake_case split;
- versions/error-code normalization;
- CJK n-gram/trigram if needed.

Do not build a tokenizer plugin platform.

---

## P2-T06 — Dense retrieval adapter spike

Build only the minimal interface needed for evaluation.

Test at most two serious multilingual embedding profiles initially.

Store embedding model/version/dimension/preprocessing metadata explicitly.

---

## P2-T07 — sqlite-vec deployment spike

Verify on target Omarchy/Node environment:

- install/load;
- restart;
- KNN;
- scoped filtering before Top-K semantics;
- concurrency;
- p95;
- memory;
- DB/index size.

Adoption is optional.

---

## P2-T08 — Hybrid + RRF experiment

Only after Dense is proven usable.

Compare:

```text
FTS
Dense
FTS + Dense + RRF
```

Do not add reranker yet.

---

## P2-T09 — Retrieval benchmark runner

Automate report generation for:

- Recall@K;
- MRR;
- all-required-evidence coverage;
- failures by category;
- latency;
- resource usage.

---

## P2-T10 — Direct-file Pi baseline

Run the same user tasks by simply providing files/paths directly to Pi.

This is the real product-value baseline.

---

## P2-T11 — Existing product comparison

Compare at most two mature local Knowledge products, for example:

- AnythingLLM;
- Open WebUI Knowledge.

Focus on:

- fixed source versions;
- stable historical citations;
- Pi workflow integration;
- Chinese/code retrieval;
- notes/reuse;
- operational cost.

---

## P2-T12 — Retrieval ADR

Publish the final V1 retrieval choice based on benchmark data.

Valid outcome may be as simple as:

```text
FTS only
```

or:

```text
FTS + Dense + RRF
```

Do not proceed to P3 without this decision.

---

# 6. P3 — Grounded Knowledge Ask

Goal:

> Generate answers only inside a frozen Knowledge scope, with deterministic Evidence integrity and durable revisions.

## P3-T01 — Answer schema

Add:

```text
answer_runs
run_evidence
answer_revisions
```

---

## P3-T02 — ScopeManifest builder

Freeze at Ask creation:

```text
knowledge_workspace_id
source_version_ids
parsed_artifact_ids
eligible_index_build_ids
retrieval config revision
model revision
prompt revision
tool policy revision
```

Later Source updates do not mutate an in-flight Ask.

---

## P3-T03 — Restricted Credential Store

Load only approved provider credentials into Knowledge Ask runtime.

Reject by default:

```text
!command credentials
unapproved provider
implicit cloud fallback
```

---

## P3-T04 — Restricted Runtime factory

Implement repository-owned:

```text
createRestrictedKnowledgeSession(...)
```

Only four Knowledge tools are registered.

---

## P3-T05 — knowledge_sources tool

Expose only current AnswerRun scope.

Do not expose entire Knowledge DB or arbitrary file paths.

---

## P3-T06 — knowledge_search tool

Model supplies bounded query parameters only.

Server enforces:

- ScopeManifest;
- allowed IndexBuilds;
- limits;
- evidence budget.

---

## P3-T07 — knowledge_read tool

Accept only run-scoped handles.

Reject:

```text
filesystem path
URL
arbitrary global Evidence id
```

---

## P3-T08 — submit_answer tool

Structured output:

```text
blocks[]
evidence_handles[]
insufficientEvidence?
```

Server performs deterministic validation.

---

## P3-T09 — Answer orchestrator

Flow:

```text
create run
→ freeze ScopeManifest
→ controlled initial retrieval
→ bounded Pi tool loop
→ submit_answer
→ validate Evidence
→ commit AnswerRevision
```

Enforce tool-call, context, output and deadline budgets.

---

## P3-T10 — Citation / grounding status model

Use separate dimensions:

```text
integrity: valid | invalid
semantic: unchecked | supported | unsupported | uncertain
review: unreviewed | user-reviewed
```

V1 default semantic status is `unchecked` unless an explicit semantic checker is later adopted.

UI must not say “verified true” when only citation integrity is known.

---

## P3-T11 — Ask UI

Provide:

- source/version selection;
- question;
- model/provider/data-disclosure information;
- progress;
- answer blocks;
- citations;
- insufficient-evidence state;
- run metadata when useful.

---

## P3-T12 — Citation → historical Source Viewer

Clicking a citation opens the exact historical Evidence location used by the AnswerRevision.

---

# 7. P3 — Saved Notes

## P3-T13 — Notes schema

Add:

```text
notes
note_revisions
```

---

## P3-T14 — Save Answer as Note

Create NoteRevision 1 from an AnswerRevision and pin referenced Evidence lineage.

---

## P3-T15 — Note edit + optimistic concurrency

Every edit creates a new immutable NoteRevision.

Use `expectedRevision` or equivalent and return `409 revision-conflict` on stale edits.

---

## P3-T16 — Semantic status invalidation after edit

If user edits claim text:

```text
semantic → unchecked
```

Existing Evidence integrity may remain valid independently.

---

## P3-T17 — Notes UI

Implement:

```text
Notes list
Note detail
Edit
Revision history
```

---

## P3-T18 — Markdown export

Export includes traceability metadata without secrets:

- note text;
- source title;
- source version;
- capture date;
- evidence excerpt;
- artifact/range/hash where appropriate.

---

## P3-T19 — Note restart/reopen test

Verify:

```text
save
→ edit
→ restart
→ reopen
→ same accepted revision/citations
```

---

## P3-T20 — Complete V1 E2E

Required end-to-end:

```text
Select MD/TXT
→ Import
→ Search
→ Ask
→ open Citation
→ Save Note
→ Edit
→ Reopen
→ Export
→ Update Source
→ Reindex
→ old Note Citation still resolves historical content
```

P3 PASS = V1 feature complete.

---

# 8. P4 — Product Hardening / Release

Goal:

> Make the V1 loop dependable for daily personal use and prove it delivers value over direct-file Pi usage.

## P4-T01 — Complete error-state UX

Explicitly handle:

```text
service unavailable
workspace unbound
import failed
previous version still active
no search result
insufficient evidence
invalid citation
note conflict
model/provider missing
target Machine unavailable
```

No silent `[]` for operational errors.

---

## P4-T02 — systemd --user packaging

Provide service lifecycle for standalone `pi-knowledge`:

- restart policy;
- secure env/config;
- logs;
- optional resource limits.

---

## P4-T03 — Installation/update flow

Document and test:

```text
clone/install
build
start pi-knowledge
start PI WEB fork
verify
update
rollback where supported
```

---

## P4-T04 — Observability

Structured logs with ids such as:

```text
requestId
jobId
runId
buildId
```

Do not log credentials or source bodies by default.

---

## P4-T05 — Performance benchmark

Use a representative dataset, initially around 10k chunks if appropriate.

Measure:

- search p50/p95;
- import/reindex time;
- memory;
- DB/index size;
- UI perceived latency.

---

## P4-T06 — Failure injection

Exercise:

```text
process kill
DB busy
low/disk-full simulation where practical
service disconnect
Machine unavailable
job timeout
provider rate limit
```

---

## P4-T07 — Migration rehearsal

Test realistic schema N → N+1 migration and failure handling.

---

## P4-T08 — Backup/restore rehearsal

Run the documented procedure on real development data and confirm historical citations/notes after restore.

---

## P4-T09 — Upstream sync rehearsal

Perform at least one realistic upstream PI WEB sync PR.

Measure:

- conflicting files;
- integration seam conflicts;
- regressions;
- manual repair scope.

This validates whether Thin Fork remains sustainable.

---

## P4-T10 — Product value comparison

Compare real tasks:

```text
Direct File → Pi
vs
Pi Knowledge Workspace
```

Observe:

- evidence finding time;
- verification time;
- repeated lookup/copy-paste;
- note reuse;
- version/conflict handling.

---

## P4-T11 — V1 Release Gate

Release only when:

- no known P0/P1 correctness failures;
- complete V1 E2E passes;
- Evidence recovery passes;
- backup/restore passes;
- retrieval ADR/report exists;
- scope violations are zero in release suite;
- invalid citations are zero in deterministic release suite;
- upstream sync is manageable;
- real task value is demonstrated;
- installation/update process is documented and tested.

---

# 9. P5 — Course V1.1

Course starts only after V1 Knowledge usage proves useful.

## P5-T01 — LearningGoal model

Define learning goal + selected SourceVersion scope.

---

## P5-T02 — OutlineRevision

Generate an editable outline candidate.

User must be able to edit and explicitly confirm it before chapter generation.

---

## P5-T03 — Thin coverage view

Map:

```text
Source section
↔ Course chapter
↔ covered / uncovered / no-evidence
```

Do not build a concept graph or claim completeness certification.

---

## P5-T04 — Chapter generation job

Per chapter:

```text
fixed scope
→ retrieve Evidence
→ generate candidate
→ deterministic citation validation
```

---

## P5-T05 — Chapter revision workflow

Store separately:

```text
Accepted Revision
Generated Candidate
```

Regeneration never silently overwrites accepted user edits.

Support:

```text
Compare
Accept
Discard
```

---

## P5-T06 — Course UI

Only now add Course as a first-class product surface.

Reuse existing:

- Evidence;
- ScopeManifest;
- Job system;
- revision model;
- restricted runtime.

Do not introduce a Course microservice, workflow DSL, graph database or multi-agent framework without later evidence.

---

# 10. Critical path

```text
P0-T01
→ P0-T02
→ P0-T03
→ P0-T04
→ P0-T05
→ P0-T06/P0-T07
→ P0 Gate

→ P1-T01/T02
→ P1-T03/T04/T05/T06/T07
→ P1-T08/T09/T10
→ P1-T11/T12/T13/T14/T15
→ P1-T16/T17/T18/T19
→ P1-T20/T21
→ P1-T22
→ P1 Gate

→ P2 benchmark + ADR

→ P3 Ask
→ P3 Notes
→ P3-T20 V1 E2E

→ P4 Release Gate

→ P5 Course V1.1
```

---

# 11. Parallelizable work

## During P0

Can overlap after interfaces are stable:

- P0-T03 contract/service skeleton;
- P0-T07 restricted runtime probe.

Do not skip P0 integration gates.

## During P1

Can partially overlap:

- DB/migrations;
- parser canonicalization;
- durable job engine;
- Source Viewer UI.

Shared data invariants must be agreed first.

## During P2

Can parallelize:

- query annotation;
- lexical experiments;
- Dense/sqlite-vec deployment spike;
- direct-file baseline;
- mature product comparison.

## During P3

After Answer schema + ScopeManifest exist, tool implementations, Ask UI and Notes persistence can overlap carefully.

---

# 12. PR guidance

Recommended branch naming:

```text
chore/p0-...
feat/p0-...
feat/p1-...
experiment/p2-...
feat/p3-...
chore/p4-...
feat/p5-...
chore/sync-pi-web-<version>
```

A task does not have to equal exactly one PR, but each PR should still have one clear concern.

Good:

```text
Implement immutable ParsedArtifact + stable UTF-8 Evidence ranges
```

Bad:

```text
Add parser + embeddings + notes UI + upgrade upstream PI WEB
```

---

# 13. Required documentation per task

For every task that changes executable behavior:

```text
docs/development/reports/<TASK>-<name>.md

docs/development/verification/<TASK>-<name>.md
```

For analysis-only tasks:

- development report is required;
- verification guide is optional unless there is executable behavior to validate.

If a task changes a durable architecture decision, also update:

```text
docs/architecture/
```

or add/update an ADR.

---

# 14. Current project position

As of 2026-09-09:

| Task | Status | Notes |
|---|---|---|
| P0-T01 | PASS | Integration seams documented and validated by source review. |
| P0-T02 | PASS | Knowledge paired-plugin skeleton accepted locally; authoritative scope, Workspace switching and worktree path verified. |
| P0-T03 | PASS | Standalone authenticated loopback service accepted: focused 14/14; strict static/build/package gates PASS; full suite 3752 passed / 1 inherited failed / 2 skipped; real process lifecycle/HTTP/limits PASS. |
| P0-T04 | PARTIAL | Thin adapter exists on PR #6; executable/static/build and real local adapter acceptance remain OPEN debt. |
| P0-T05 | PARTIAL | Cross-layer local E2E exists on PR #7; execution and physical browser/process acceptance remain OPEN debt. |
| P0-T06 | PARTIAL | Selected-Machine routing contract exists on PR #8; executable/two-instance/Fleet acceptance remains OPEN debt. |
| P0-T07 | PARTIAL | Restricted Pi runtime probe exists on PR #9; executable verification remains OPEN debt. |
| P0-T08 | PARTIAL | Gate review exists on PR #10; P0 remains NOT PASS until mandatory P0 debt is resolved. |
| P1-T01 | PARTIAL | ADR-028 selects better-sqlite3 13.x; target native runtime/FTS5/backup/package acceptance remains OPEN debt. |
| P1-T02 | PARTIAL | Database bootstrap/migrations implemented on PR #12; real native-driver execution remains unverified. |
| P1-T03 | PARTIAL | Durable installation/Workspace identity implemented on PR #13; real SQLite acceptance remains unverified. |
| P1-T04 | PARTIAL | Content-addressed raw-byte blob store implemented on PR #14; executable/filesystem acceptance remains OPEN debt. |
| P1-T05 | PARTIAL | Source/SourceVersion domain implemented on PR #15; executable/real-SQLite acceptance remains OPEN debt. |
| P1-T06 | TODO | Next task: safe Workspace file reader. |

Execution mode: **deferred human verification is allowed for development progression**. Tasks with environment-only acceptance still outstanding remain PARTIAL with explicit verification debt, while later tasks may proceed when dependency-safe. Phase/release PASS still requires all mandatory debt for that gate to be cleared.

Current next task:

# **P1-T06 — Safe Workspace file reader**

P1-T06 may proceed as a separate stacked branch against the documented P1-T05 Source capture contract. It must enforce relative-path, realpath-containment, symlink, sensitive-file, size and file-change-race checks before bytes are eligible for SourceVersion capture.