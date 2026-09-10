# Autonomous Development Execution Policy

This document defines the default **Product Slice First** execution model for autonomous and multi-Agent development. It supplements `DEVELOPMENT-PLAN.md` and keeps final PASS, milestone and release gates strict while reducing coordination overhead inside a slice.

Verification execution follows [`CI-FIRST-VERIFICATION.md`](./CI-FIRST-VERIFICATION.md). When GitHub Actions can produce credible repository/runtime evidence, use it before creating target-machine or manual verification debt.

## Delivery model

```text
Product Milestone
└── Product Slice                 default branch / Draft PR / CI / review unit
    ├── Agent Work Unit
    ├── Agent Work Unit
    └── Agent Work Unit
```

A **Product Slice** is an independently reviewable vertical increment with one coherent goal and acceptance surface. It may span domain, service, client, UI and tests when those pieces are needed to demonstrate the slice.

An **Agent Work Unit** is a bounded implementation task inside that slice. Multiple Agents may contribute work units to the same Product Slice. A work unit normally does not get its own remote branch, PR, repository report, verification guide, changelog entry or development-plan update.

For example, `P3-A2 Grounded Ask` may contain GenerationRun, retrieval, DeliveredEvidence, Answer, Citation, provider integration, service API, client, UI and test work units while producing one or a small number of Product Slice PRs.

## Agent assignment

Simple, explicit and mechanical work units are appropriate for a fast Agent such as Luna, including:

- test fixtures;
- API types;
- UI components;
- runtime validation;
- migration tests;
- small wiring;
- lint in touched files;
- verification execution.

Use a stronger Agent for work that carries architectural or concurrency risk, including:

- architecture and schema design;
- migration design;
- identity and historical lineage;
- transaction boundaries;
- compare-and-swap, fencing and concurrency;
- retention and destructive lifecycle semantics.

The Lead/Integrator owns slice coherence, integration, verification classification and the final PR description.

## Unattended execution rule

1. Confirm the Product Slice goal, accepted ADRs, correctness invariants and integration owner.
2. Decompose the slice into dependency-safe Agent Work Units without turning the decomposition into permanent repository process artifacts.
3. Run every automated/static/build check available at the appropriate gate.
4. Classify failures before changing code: slice-attributable, inherited, or infrastructure/transient.
5. If ordinary CI is insufficient but GitHub Actions can credibly execute the workload, add or reuse the narrowest evidence harness.
6. Record checks that truly require the user's machine, browser/desktop trust boundary, Fleet/multi-host topology, hardware/GPU, system services, credentials, provider access or human judgment in `VERIFICATION-DEBT.md`.
7. Keep the Product Slice or milestone `PARTIAL` when required acceptance evidence remains missing.
8. Continue dependency-safe work against explicit contracts and assumptions; isolate unverified dependencies and add focused contract tests or fixtures where practical.
9. Stop only when progress requires unavailable information/authority, unsafe or destructive action, or violates an explicit architecture/product gate.

Never fabricate evidence. A missing runnable checkout in one Agent environment is not itself a reason to defer deterministic repository verification when another available environment can run it reproducibly.

## Branch and PR policy

Each independently reviewable Product Slice normally gets one branch and one Draft PR. The Product Slice—not each Agent Work Unit—is the default remote branch, CI and review boundary.

Rules:

1. Keep each Product Slice coherent and reviewable; do not mix an unrelated product goal merely to reduce PR count.
2. Multiple Agent Work Units may contribute through isolated local branches/worktrees and be integrated into the Product Slice branch.
3. A large slice may use a small number of PRs when risk, dependency order or reviewability genuinely requires it. Do not create a PR per schema type, API layer, UI state or test group by default.
4. The Product Slice PR description records the goal, important implementation, architecture/correctness invariants, automated verification and known limitations.
5. Do not autonomously merge a PR. Do not force-push, destructively reset or unsafely rewrite history.
6. Before declaring a slice implementation-complete, compare it with its direct base and confirm its complete diff matches the Product Slice goal.
7. Verification harnesses normally travel with the Product Slice they verify. Use a separate support PR only when it has a genuinely independent lifecycle or review surface.

See [`BRANCH-HYGIENE.md`](./BRANCH-HYGIENE.md) for worktree isolation and remote-branch lifecycle rules.

## Agent Work Unit handoff

Each work unit returns a short handoff to the Lead/Integrator:

```text
TASK
STATUS
FILES_CHANGED
IMPLEMENTED
TESTS
RISKS
HANDOFF
```

Keep this handoff in the orchestration/PR workflow unless it has clear long-term maintenance value. It is not a default repository document.

## Status semantics

- `PASS`: all required implementation and acceptance evidence for the Product Slice or milestone exists.
- `PARTIAL`: implementation exists, but required acceptance evidence remains open.
- `BLOCKED`: progress requires unavailable information/capability/authority, an unsafe action, or a missing hard-gate decision.
- `TODO`: implementation has not started.

Do not convert `PARTIAL` to `PASS` merely because dependent work exists or because one CI layer is green while required acceptance remains open.

## Verification debt

Before creating debt, determine whether CI or a dedicated evidence workflow can cover it credibly. Each deferred item must identify:

```text
Product Slice or Product Milestone
Status
Why automation cannot credibly verify it
Evidence already obtained
Exact remaining procedure
Expected PASS evidence
Assumptions and dependents
Resolution state
```

When an older task-level debt row is revisited, do not mass-close it. Execute what is now automatable, close only what evidence proves, and preserve genuinely target-specific debt. Compatible manual checks may be batched by Product Slice or user journey.

## Inherited debt

Inherited failures must remain distinguishable from Product Slice regressions. Do not fix inherited debt unless it:

1. is in code touched by the current Product Slice;
2. masks a Product Slice regression;
3. blocks required compilation, tests or build; or
4. is an actual correctness defect.

Do not perform general cleanup for a prettier lint count, and do not disable or weaken existing ESLint rules. The inherited repository-wide lint baseline is maintenance debt, not permission to introduce new findings in touched or P3-critical code.

## Safety and correctness remain strict

Product Slice First changes coordination granularity, not correctness authority. ADR-029 remains authoritative, including:

- captured content is not the same as published Knowledge;
- SourceVersion and ParsedArtifact are immutable;
- `CitationRef -> Evidence`, and historical citations never silently redirect to latest;
- the retrieval index is a projection, not canonical identity;
- `archive != purge`;
- a stale worker cannot publish after losing fencing authority;
- P2 frozen evidence is not mutated;
- V1 retrieval remains SQLite FTS5 / `unicode61` / `quoted-literal-or` / Top-K 10.

No autonomous PR merge, force-push, destructive reset or unsafe history rewrite is permitted. Phase, milestone and release gates remain strict, and task/slice-owned failures must never be disguised as inherited failures.
