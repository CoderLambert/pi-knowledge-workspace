# Branch Hygiene Policy

This document defines branch/worktree isolation and remote-branch lifecycle under the Product Slice First model.

## Default branch unit

Each independently reviewable Product Slice normally has one target branch and one Draft PR. Multiple Agent Work Units may contribute to that branch; they do not normally create remote branches or PRs of their own.

Before creating a Product Slice branch:

1. search open PRs and remote branches for the same slice goal;
2. reuse the canonical slice branch when it already exists;
3. confirm the intended direct base and accepted dependencies;
4. create an additional remote PR only when independent review, risk containment or dependency order materially benefits.

Branch names should describe the Product Slice, for example:

```text
feat/p3-reliable-knowledge
feat/p3-grounded-ask-backend
feat/p3-grounded-ask-ui
test/p3-production-lifecycle-e2e
```

## Multi-Agent workspace policy

Multiple Agents must not edit the same working tree concurrently.

Recommended shape:

```text
one Product Slice target branch

Lead / Integrator
├── Agent worktree A
├── Agent worktree B
└── Agent worktree C
```

Each Agent works in an isolated worktree, normally on a temporary local branch based on the Product Slice target. Temporary Agent branches:

- do not require a remote push;
- do not require a PR;
- do not require a repository report, verification guide or changelog entry;
- should remain narrowly scoped to the assigned handoff.

The Lead/Integrator reviews and integrates completed work units into the Product Slice branch. Use the safest non-destructive Git method appropriate to the actual ancestry and worktree state; cherry-pick is allowed but not required. Preserve user-owned or unrelated changes and resolve overlapping edits deliberately.

## Integration checks

Before integrating a work unit:

1. inspect its status, diff, tests, risks and handoff;
2. confirm it is based on the expected Product Slice ancestry;
3. ensure it does not overwrite concurrent work or broaden scope silently;
4. run the relevant Fast Gate after integration;
5. remove or retain the temporary local branch/worktree only after its work is safely represented and no longer needed.

Before updating the Product Slice PR, compare the complete branch with its direct base. Reviewability applies to the Product Slice as a whole; it does not require artificial one-file or one-Agent commits.

## Remote branch states

Treat remote branches as one of:

- **ACTIVE** — head of an open Product Slice or explicitly justified support PR.
- **DEPENDENCY** — base/ancestor required by an open PR.
- **RETAINED** — intentionally kept for a documented historical reason.
- **CLEANUP-ELIGIBLE** — merged, duplicate-closed or superseded and no longer required.
- **UNKNOWN** — ownership/dependency not yet proven; do not delete.

## Safe deletion conditions

A remote branch may be deleted only when all applicable conditions are proven:

1. it is not `main` or another protected/stable base;
2. it is not the head or base of an open PR;
3. it is not required by an unresolved Product Slice;
4. its work was merged, explicitly superseded without unique required commits, or was a temporary probe never intended to remain canonical;
5. replacement/descendant ancestry was checked when deletion relies on supersession.

When any condition is uncertain, keep the branch.

## Stacked Product Slices

Product Slices may be stacked when a real dependency requires it. Intermediate branches remain required while their PRs are open or descendants target them.

After merging a lower PR:

1. verify descendant PR bases and ancestry;
2. retarget or otherwise integrate descendants safely;
3. confirm each remaining Product Slice diff stays reviewable;
4. only then mark the merged branch cleanup-eligible.

Do not impose a stack merely because several Agent Work Units exist inside one Product Slice.

## Safety authority

Autonomous development may inspect and report branch hygiene, but it must not:

- merge a PR without owner authority;
- force-push;
- use destructive reset or unsafe history rewriting;
- delete an ACTIVE, DEPENDENCY or UNKNOWN branch;
- delete a branch merely because it is old or its commits appear in a descendant.

If remote deletion is not safely available, report exact cleanup candidates and evidence. A cleanup does not change Product Slice or milestone PASS/PARTIAL/BLOCKED status and must not hide unmerged work or unresolved verification debt.
