# ADR-027 — Adopt a Thin Fork of PI WEB

- Status: Accepted
- Date: 2026-09-08

## Context

The product is no longer a small optional PI WEB add-on. Knowledge, Notes and later Course/Learning are first-class workspace surfaces and will change information architecture and product workflows.

Keeping a zero-core-modification constraint would force product design around plugin lifecycle/version limitations and increase integration complexity without improving the user-facing product.

At the same time, rewriting PI WEB or embedding all knowledge processing into PI WEB would create unnecessary divergence and make upstream synchronization expensive.

## Decision

Fork `jmfederico/pi-web` and maintain it as a **thin product fork**.

The fork may directly implement first-party Knowledge/Learning UI and the narrow server integration seams those features require.

The authoritative Knowledge implementation remains logically separate from PI WEB core:

```text
PI WEB fork
  → first-party Knowledge UI / integration
  → pi-knowledge boundary
      → sources / parsing / retrieval / evidence / ask / notes / jobs
```

## Upstream-first areas

Avoid redesigning unless independently required:

- Machine / Fleet
- Project / Workspace
- Session runtime
- Terminal
- Git/worktree
- existing coding-agent workflow

## Owned areas

- Knowledge UI/navigation
- Knowledge request contracts
- Knowledge service implementation
- restricted Ask runtime
- Notes
- V1.1 Course/Learning

## Consequences

### Positive

- product UI can evolve without waiting for generic plugin APIs;
- fewer adapter/version workarounds;
- Knowledge can become a real first-class workspace capability;
- product development is optimized for this fork rather than third-party plugin compatibility.

### Cost

- upstream synchronization becomes an explicit maintenance responsibility;
- changes to shared upstream files must be minimized to control merge conflicts;
- every upstream sync requires compatibility and regression testing.

## Rejected alternatives

### Stay plugin-only

Rejected as the default product architecture because Knowledge/Learning are first-party product surfaces rather than optional extensions. Plugin mechanisms may still be used where they are naturally useful.

### Rewrite PI WEB

Rejected because existing Machine/Workspace/Session/Git/Terminal capabilities are valuable and should remain upstream-derived.

### Put all Knowledge code in PI WEB process

Rejected because parsing, indexing, embeddings, durable jobs and knowledge data lifecycle have different resource/security/reliability requirements from the PI WEB workspace runtime.
