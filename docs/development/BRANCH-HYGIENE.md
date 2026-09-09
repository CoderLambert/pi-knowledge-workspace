# Branch Hygiene Policy

This document defines the remote-branch lifecycle for autonomous development in this repository.

It supplements `docs/development/AUTONOMOUS-EXECUTION.md` and applies to task, corrective, experiment, support, research, and policy branches.

## Goal

Keep stacked development reviewable without accumulating duplicate, superseded, merged, or orphan remote branches that can confuse later automation.

The repository deliberately uses many stacked PR branches. A high branch count is therefore not itself a problem. Cleanup must be dependency-aware rather than based on age or naming alone.

## Before creating a branch

Before creating a new task/support branch:

1. Search current open PRs for the same task id/purpose.
2. Search remote branches for an existing canonical branch.
3. If an equivalent task branch/PR already exists, reuse or restack it instead of creating a competitor.
4. If an accidental duplicate is created, select one canonical task branch immediately, close the duplicate PR, and mark the duplicate branch as cleanup-eligible once no open PR depends on it.

One task should have one canonical implementation branch/PR unless an explicitly documented corrective/support layer is required.

## Branch states

Treat remote branches as one of:

- **ACTIVE** — head of an open PR.
- **DEPENDENCY** — base/ancestor required by an open stacked PR.
- **RETAINED** — intentionally kept for an accepted historical reason that is documented.
- **CLEANUP-ELIGIBLE** — merged, duplicate-closed, or superseded and no longer required by any open PR.
- **UNKNOWN** — ownership/dependency not yet proven; do not delete.

## Safe deletion conditions

A remote branch may be deleted only when all applicable conditions are proven:

1. It is not `main` or another protected/stable base.
2. It is not the head branch of any open PR.
3. It is not the base branch of any open PR.
4. It is not needed as the canonical branch for an unresolved task.
5. One of the following is true:
   - its PR was merged;
   - its PR was explicitly closed as a duplicate and a canonical replacement exists;
   - its work is fully contained in a documented successor branch and it has no independent required commits;
   - it is a temporary review/probe branch whose work was never intended to remain canonical.
6. The replacement/descendant ancestry has been checked when deletion relies on supersession.

When any condition is uncertain, keep the branch.

## Stacked PR rule

Do not delete intermediate branches simply because later descendants contain their commits.

For an open stack such as:

```text
Task A
  -> Task B
  -> Task C
```

A and B remain required while their PRs are open or while later PRs target them as bases. Cleanup normally happens oldest-first after merge/retarget operations have made the branch unnecessary.

After merging a lower PR:

1. verify descendant PR bases/ancestry;
2. retarget/rebase descendants if needed;
3. confirm direct-base task-only diffs remain reviewable;
4. only then mark the merged branch cleanup-eligible.

## Duplicate/superseded branch handling

When automation detects duplicate task branches:

1. identify the canonical PR using current dependency ancestry and downstream references;
2. do not merge competing implementations;
3. close the duplicate PR with an explicit reason;
4. verify no open PR uses the duplicate branch as head/base;
5. compare ancestry/content when needed to ensure no unique required commits are lost;
6. delete the duplicate remote branch when safe.

## Autonomous hygiene check

Autonomous development should perform a lightweight branch-hygiene check:

- before creating a new branch;
- after closing a duplicate PR;
- after a restack that supersedes an old support/corrective branch;
- after merging or explicitly retiring a task;
- periodically when the remote branch set grows materially.

The check should report, not delete, branches when the available GitHub tool surface cannot delete refs safely. In that case provide the user with exact `git push origin --delete ...` commands only for branches whose safety has already been established.

## No automatic destructive cleanup

Branch deletion is destructive repository maintenance. Autonomous development must not guess.

- Never delete an ACTIVE, DEPENDENCY, or UNKNOWN branch.
- Never force-move a branch ref as a substitute for deletion.
- Never delete a branch merely because it is old.
- Never delete a branch solely because its commits appear in a descendant while an open PR still references it.
- Prefer a small verified cleanup set over broad branch pruning.

## Cleanup record

When a cleanup is performed, record at least:

```text
branch
reason
associated PR/task
canonical replacement, if any
open-PR head/base check
ancestry/supersession evidence when relevant
result
```

A cleanup operation does not change task PASS/PARTIAL/BLOCKED status and must not be used to hide unmerged work or unresolved verification debt.
