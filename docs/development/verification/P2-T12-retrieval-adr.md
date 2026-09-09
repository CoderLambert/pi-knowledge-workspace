# P2-T12 verification — Retrieval ADR

Status: **BLOCKED ON P2-T11 HANDS-ON PRODUCT EVIDENCE ONLY**

## Retrieval evidence — PASS

P2-T04/P2-T05/P2-T06/P2-T09 evidence narrows the V1 retrieval candidate to:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

Dense is rejected; sqlite-vec and Hybrid/RRF are N/A unless Dense is intentionally reopened with new evidence.

## P2-T10 direct-file Pi — PASS

Frozen model run:

```text
queries = 50
answerable/no-answer = 42 / 8
required Evidence coverage = 1.0 / 1.0
citationPrecision = 0.7758620689655172
noAnswerCorrectAbstentionRate = 0.625
```

Final owner-delegated independent semantic review:

```text
reviewer = GPT-5.6 Sol
model under test = gpt-6-astra
correct = 48
partially correct = 0
incorrect = 2
no-answer hallucinations = 2
answers SHA-256 = eed0f944d546220d96c82431e3dfd0037efb574d72e541ae1db09b9fa158ba2b
review digest = 0e450d064781a0390e192e4338e0b1cb45a43297ee2a5629428b3351f1dd9e84
```

This is explicitly an independent model review authorized by the repository owner, not a human review.

`dev-035` is separately recorded as a Golden answerability defect because the current challenge corpus directly contains the comparison evidence despite the frozen `no-answer` category.

P2-T10 is no longer a blocker.

## Remaining decision gate

P2-T11 remains PARTIAL until fixed-version hands-on observations are complete for AnythingLLM and Open WebUI Knowledge, including historical citation durability after source update/restart and same-corpus/operational observations.

## ADR acceptance gate

ADR-029 remains **BLOCKED** until P2-T11 is complete and the final product-value comparison is recorded. Do not enter P3 before ADR-029 is formally Accepted.

No PR is automatically merged by this verification task.
