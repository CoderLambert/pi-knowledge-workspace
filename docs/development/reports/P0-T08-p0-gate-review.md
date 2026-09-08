# P0-T08 — P0 Gate Review Report

## Task metadata

- **Task:** P0-T08
- **Phase:** P0 — Integration / security / process boundary
- **Date:** 2026-09-09
- **Branch:** `chore/p0-gate-review`
- **Stacked base:** `experiment/p0-restricted-pi-runtime-probe` (P0-T07 / PR #9)
- **Status:** **PARTIAL**
- **P1 implementation mixed into this branch:** no
- **Verification guide:** `docs/development/verification/P0-T08-p0-gate-review.md`
- **Verification debt ledger:** `docs/development/VERIFICATION-DEBT.md`

## Objective

Review the complete P0 integration boundary against the gate conditions in `DEVELOPMENT-PLAN.md` without weakening acceptance standards merely because P0-T04 through P0-T07 have autonomous verification debt.

P0-T08 is a gate/review task. It intentionally adds no production implementation.

## Gate decision

**P0 Gate: PARTIAL / NOT YET PASS.**

The implemented architecture is suitable to proceed to the P1 design/spike backlog under the autonomous-execution policy, but the P0 phase itself cannot be declared PASS until the mandatory executable/local/Fleet/runtime verification debt is resolved.

No stop-condition architecture failure was found: Knowledge does not require widespread private PI WEB core patches, a second Machine/Workspace stack, a Knowledge-specific browser gateway, or a replacement federation protocol.

## Gate matrix

| P0 gate condition | Current evidence | Decision |
|---|---|---|
| Knowledge Workspace surface works | P0-T02 locally accepted; P0-T05 cross-layer E2E implemented | PASS at accepted skeleton level; full local E2E debt remains |
| authoritative Workspace scope confirmed | P0-T02 locally accepted; P0-T04 adapter preserves host authority and rejects browser/service scope overrides | Architecture/contract accepted; P0-T04 executable adapter debt remains |
| standalone process boundary works | P0-T03 accepted with real process lifecycle, auth, limits, protocol and shutdown evidence | PASS |
| local integration works | P0-T05 repository-owned cross-layer E2E implemented but not executed; physical browser/process acceptance pending | PARTIAL |
| selected-Machine routing contract works | P0-T06 deterministic generic federation coverage implemented; physical two-instance and real Fleet evidence pending | PARTIAL |
| restricted runtime contract works | P0-T07 repository-owned runtime factory/tests implemented; executable/static/build evidence pending | PARTIAL |
| no invasive Machine/Workspace/Session rewrite required | P0-T01 seam decision plus P0-T04/P0-T06 implementation confirms reuse of paired backend, host context and existing federation | PASS |
| reports and verification guides complete | P0-T01..T08 task records exist; verification debt ledger contains P0-T04..T08 acceptance backlog | PASS for documentation completeness after this PR |

Because phase gates remain strict, any mandatory PARTIAL row keeps P0-T08 and P0 itself PARTIAL.

## Architecture findings

### 1. Thin-fork boundary remains valid

P0 implementation still follows:

```text
Knowledge Workspace Panel
→ existing pairedBackend
→ selected Machine / existing federation
→ target sessiond paired plugin
→ thin Knowledge adapter
→ authenticated loopback pi-knowledge
```

No evidence from P0-T04 through P0-T07 requires replacing PI WEB's Machine, Project, Workspace, Session, Terminal, Git, or paired-backend infrastructure.

### 2. Security authority remains server-side

The browser does not choose authoritative Project/Workspace path, `pi-knowledge` host/port/token, or service operation for `knowledge.status`. The thin adapter derives scope from host-owned `PairedPluginRequestContext`, validates service echo correlation, and fails closed on mismatches.

### 3. Remote routing remains upstream-owned

P0-T06 required no production routing code. Existing PI WEB generic Machine federation already carries paired-plugin requests to the selected target and propagates bounded cancellation. Knowledge-specific retry/fallback routing would be a regression against the chosen seam.

### 4. Model isolation is independently bounded

P0-T07 keeps the future grounded-Ask model surface separate from ordinary Pi coding-agent capabilities. The repository-owned probe exposes only the four Knowledge tools and disables project/global resource discovery and persisted runtime state through the selected SDK configuration.

### 5. P1 may consume contracts, not acceptance claims

Autonomous progression may enter P1 tasks against documented P0 contracts, but consumers must not reinterpret unresolved P0 verification as PASS. Where P1 depends on a P0 invariant, tests/fixtures should preserve the narrow contract and debt linkage.

## Mandatory verification debt before P0 PASS

P0 cannot be upgraded to PASS until, at minimum:

1. P0-T04 focused/static/build/package gates and real server-plugin → service acceptance are recorded.
2. P0-T05 focused/static/build/package gates and real Browser → PI WEB → sessiond → `pi-knowledge` acceptance are recorded, including Workspace switching and negative/recovery cases.
3. P0-T06 focused/static/build/package gates, two-instance selected-target routing, zero gateway-local fallback, cancellation, and required real Fleet/multi-host evidence are recorded.
4. P0-T07 focused test/static/build/package/full-suite evidence proves the restricted runtime contract on the repository dependency tree.
5. Gate review is rerun against the resulting evidence and all mandatory P0 conditions are green.

The known inherited `src/server/sessions/piSessionService.promptQueue.test.ts` baseline failure must remain classified as inherited unless its signature changes; P0 gate closure must not patch it inside an unrelated P0 task merely to make a suite green.

## ADR decision

No new ADR is required for P0-T08. This task does not change architecture; it confirms that the P0-T01 integration-seam decision remains viable and records unresolved acceptance evidence. If later verification disproves one of these contracts, the affected producer task and architecture decision must be reopened explicitly.

## Direct-base scope rule

This branch must remain documentation/gate-review only. It must not contain P1-T01 SQLite spike implementation or changes to runtime, adapter, routing, browser, service, database, retrieval, parsing, or model behavior.

## Backlog after this review

Dependency order remains:

```text
#5 autonomous policy
→ #6 P0-T04
→ #7 P0-T05
→ #8 P0-T06
→ #9 P0-T07
→ P0-T08 gate review
```

P0 acceptance backlog is the open verification debt above. Under the unattended policy, the next implementation task after this gate review is **P1-T01 — SQLite driver decision spike**, but P0 remains PARTIAL until gate debt is cleared.

## Result

**PARTIAL — the P0 architecture/integration boundary review finds no stop-condition design failure and no need for invasive PI WEB infrastructure duplication, but required P0-T04..T07 acceptance evidence is still OPEN. Therefore P0-T08 and the P0 phase are explicitly NOT PASS.**
