# Development Phases

## Principle

Each phase has an explicit exit condition. Dependencies may be explored in parallel, but a later product gate cannot be declared complete before the previous gate's evidence exists.

## P0a — Thin Fork integration spike

Goal: prove the fork can expose a first-class Knowledge surface without destabilizing existing PI WEB workspace behavior.

Deliver:

- empty Knowledge route/panel;
- access to authoritative current Project/Workspace context;
- thin server-side call path to a fake local `pi-knowledge` endpoint;
- local + gateway/target routing behavior mapped;
- no change to existing Git/Terminal/Session semantics.

Exit:

- Git and folder workspaces can open Knowledge;
- workspace scope cannot be spoofed by browser JSON;
- service-down/target-offline errors are explicit;
- no scattered private-route hacks are required.

Stop if the fork would require invasive changes across unrelated upstream subsystems.

## P0b — Restricted Ask/security spike

Goal: prove Pi SDK can be instantiated as a genuinely restricted knowledge-only runtime.

Deliver:

- empty/custom ResourceLoader;
- explicit four-tool allowlist;
- in-memory session/settings as applicable;
- controlled credential/model configuration;
- regression fixtures proving project/global resources cannot add tools/instructions;
- no real private corpus sent to remote models during the spike.

Exit:

- only `knowledge_sources/search/read/submit_answer` are model-visible;
- reload/retry does not activate shell/read/write or arbitrary resources;
- unsupported/unsafe provider configuration fails closed.

## P0c — Boundary/failure spike

Goal: validate target routing and transport boundaries.

Cover:

- local target;
- isolated gateway → target instance;
- cancellation;
- service disconnect/restart;
- workspace switching;
- request/response limits;
- version/capability mismatch;
- no fallback to gateway-local knowledge when target is unavailable.

A two-local-instance setup proves routing contracts only; it is not called real remote Fleet validation.

## P1 — Evidence vertical slice

```text
Select/import MD/TXT
→ capture immutable bytes
→ SourceVersion
→ ParsedArtifact
→ FTS baseline
→ stable Evidence
→ Source/Evidence Viewer
```

Must include from the start:

- durable job state;
- retry/cancel/crash recovery;
- migrations;
- atomic index publication;
- minimal backup/restore;
- historical Evidence remains readable after reparse/rechunk/reindex.

Exit: authoritative data survives restart/rebuild/recovery tests without redirecting old citations to new content.

## P2 — Retrieval evaluation

Build the first real corpus and Golden Dataset before selecting the final retrieval stack.

Compare:

- direct/full-context where applicable;
- FTS;
- Dense;
- Hybrid + RRF.

Starting dataset target: roughly 60–100 real queries with a holdout split.

Required categories include:

- Chinese;
- English;
- Chinese/English mixed;
- exact API/code symbols;
- versions/error codes;
- multi-source evidence;
- conflicts;
- no-answer questions.

Report at minimum:

- Recall@K;
- MRR;
- failures by category;
- p95 retrieval latency;
- memory/index size.

Also run a small same-task comparison against up to two mature existing local knowledge products before committing to unnecessary custom work.

Exit: choose and document the actual retrieval stack from evidence, not preference.

## P3 — Knowledge Ask + Notes = V1 feature completion

```text
fixed ScopeManifest
→ controlled initial retrieval
→ bounded Pi search/read loop
→ submit_answer
→ deterministic citation validation
→ AnswerRevision
→ Save Note
→ edit/reopen/export
```

Must include:

- delivered-evidence allowlist per run/attempt;
- immutable answer revisions;
- note revisions + optimistic concurrency;
- evidence-insufficient behavior;
- human grounding sample evaluation;
- no claim that unchecked semantics are fact-verified.

Exit: complete E2E passes, including source update/reindex while old note citations remain resolvable.

## P4 — Product validation/release gate

Validate real daily tasks against the direct-file baseline:

- correct-version evidence discovery;
- verification time;
- reduced repeated lookup/copy-paste;
- note reuse/reopen rate;
- understandable source-version and insufficient-evidence UX.

Release requires:

- no known P0/P1 failure path in supported scope;
- citation/scope/history recovery regression suite passing;
- performance/data-quality report on the reference machine;
- backup/restore and migration procedure tested;
- installation/update/upstream-sync process documented;
- observable value over simply handing files to Pi.

## P5 — V1.1 Course

Only after V1 knowledge usage is validated:

```text
Learning Goal
→ editable OutlineRevision
→ user confirmation
→ generate one chapter
→ citation checks
→ candidate revision
→ Accept / Discard / Compare
```

Coverage is an aid showing included / uncovered / unsupported material. It does not certify course completeness.

Do not add a Course microservice, graph database, workflow DSL, or multi-agent orchestration framework unless later evidence establishes a concrete need.
