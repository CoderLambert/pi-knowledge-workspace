# Verification — CI-first verification policy

Status: **OPEN / DOCUMENTATION VERIFICATION**

Branch: `docs/ci-first-verification-policy`  
Direct base: `chore/p2-fts-evidence-harness`

## 1. Policy consistency

Confirm that:

- `CI-FIRST-VERIFICATION.md` defines GitHub CI -> GitHub evidence workflow -> target-machine/human acceptance as the default order;
- `AUTONOMOUS-EXECUTION.md` points to that policy and no longer treats the assistant runtime lacking a checkout/dependency tree as sufficient reason to ask the user for deterministic repository verification;
- PASS/PARTIAL/BLOCKED semantics remain strict;
- explicit hard architecture/phase gates remain binding;
- inherited failures are classified rather than patched in unrelated tasks;
- holdout tuning isolation is preserved;
- GitHub runner resource evidence is not mislabeled as Omarchy target-machine performance;
- user-owned credentials are not authorized for CI by default.

## 2. Verification-debt migration rule

Confirm the policy does **not** mass-close historical verification debt.

When an older debt row is revisited:

1. identify the executable portion that GitHub Actions can now cover;
2. run it and attach workflow/run/artifact evidence;
3. close only the proven portion;
4. leave real target-machine/Fleet/browser/hardware/credential/human-review acceptance open when still required.

## 3. Direct-base scope

Compare this branch with the support base:

```bash
git diff --check origin/chore/p2-fts-evidence-harness...HEAD
git diff --name-status origin/chore/p2-fts-evidence-harness...HEAD
```

Expected files only:

- `docs/development/CI-FIRST-VERIFICATION.md`
- `docs/development/AUTONOMOUS-EXECUTION.md`
- `docs/development/reports/CI-FIRST-VERIFICATION-policy.md`
- `docs/development/verification/CI-FIRST-VERIFICATION-policy.md`

No production code, retrieval configuration, dataset, workflow, ADR, or P3 implementation belongs in this policy PR.

## 4. CI interpretation

Normal repository CI may still fail because of inherited baseline debt. A failure in an unchanged file outside this four-file docs-only diff must be classified before being attributed to this policy task.

This task requires no runtime benchmark of its own. Markdown/document scope and internal policy consistency are the owning acceptance surface.

## PASS condition

The policy task may be marked PASS when:

- the direct-base diff is exactly the four intended documentation files;
- no Markdown/policy contradiction is identified;
- normal CI introduces no task-attributable failure;
- the PR remains unmerged unless the user explicitly authorizes merging.
