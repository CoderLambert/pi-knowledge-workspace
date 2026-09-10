# Product Verification Standard

Verification is organized around a Product Slice or complete user journey. Agent Work Units use fast, focused feedback and contribute evidence to the slice; they do not each require a permanent verification guide.

## Verification guide boundary

Create a guide under `docs/development/verification/` when a Product Slice or user journey needs reproducible human/operator validation with long-term value.

Good guide boundaries include:

```text
Reliable Knowledge verification
Grounded Ask Product Preview verification
Production lifecycle E2E verification
Quiz E2E verification
```

Do not split guides by internal work unit or implementation layer, such as:

```text
ASK-CLIENT verification
ASK-UI-STATE verification
A1-DB-TEST verification
```

A narrow corrective slice may reuse and extend the owning journey guide instead of creating a new file.

## Three verification gates

### Fast Gate — Agent Work Unit / frequent commit

Run the narrowest useful feedback loop:

- typecheck where practical;
- lint for touched/scoped files;
- focused unit tests.

The Fast Gate prepares work for integration. It is not a claim that the Product Slice passes its complete acceptance contract.

### Slice Gate — Product Slice PR

Run the checks needed to review the integrated vertical slice:

- typecheck;
- P3-critical and touched-file lint;
- relevant integration tests;
- build;
- relevant E2E.

If a check is unavailable, record why and identify the exact remaining evidence. A Product Slice may be `PARTIAL`; it must not claim PASS from incomplete execution.

### Full Gate — Product Milestone / release

Run the broader evidence needed for the milestone:

- broader CI;
- cross-slice integration;
- backup/restore where relevant;
- manual acceptance where required;
- historical verification debt required by the gate.

Milestone/release acceptance remains strict even when dependency-safe implementation proceeded earlier.

## Inherited failure policy

The repository currently carries an inherited ESLint baseline. It is maintenance debt rather than a reason to block unrelated Product Slice work.

Do not fix inherited debt unless it:

1. is touched by the current Product Slice;
2. masks a Product Slice regression;
3. blocks required compilation, tests or build; or
4. represents an actual correctness defect.

Do not disable or weaken existing ESLint rules. Touched and P3-critical code must provide a trustworthy regression signal. Always distinguish Product Slice-owned failures from inherited failures and preserve the evidence used for that classification.

## Guide content

When a durable guide is warranted, include the applicable parts of:

1. what Product Slice or user journey it verifies;
2. prerequisites and exact checkout/setup;
3. automated verification commands;
4. start commands and required services;
5. numbered manual steps with observable expected results;
6. negative/failure checks;
7. explicit pass/fail criteria;
8. cleanup/reset;
9. known limits and environment boundaries.

Guides must be executable rather than vague. Use copyable commands and concrete observations.

## Evidence discipline

A guide describes how verification can be performed. It does not prove the steps ran.

```text
Verification guide exists != verification passed
```

Record actual automated results in the Product Slice PR and durable milestone evidence in its development report. Label CI, target-machine and human evidence by the environment actually exercised; never generalize it beyond that boundary or fabricate missing results.

P2 frozen evidence and its evaluation protocol remain immutable. Verification work must not retune the accepted retrieval baseline or modify frozen evidence to make a gate pass.
