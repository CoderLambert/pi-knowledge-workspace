# P2-T12 — Retrieval ADR

Status: **BLOCKED ON P2-T11 HANDS-ON PRODUCT EVIDENCE ONLY**

## Current retrieval decision

Measured P2 evidence narrows V1 retrieval to:

```text
SQLite FTS5
unicode61
lexicalProfile = baseline
naturalLanguageCompiler = quoted-literal-or
Top-K = 10
```

Dense was rejected by development quality evidence. sqlite-vec and Hybrid/RRF are N/A because Dense failed their prerequisite gate.

## P2-T10 — PASS

The real direct-file Pi run is complete and accepted.

Frozen deterministic result:

```text
50 queries / 42 answerable / 8 no-answer
required Evidence coverage = 1.0 / 1.0
citation precision = 0.7758620689655172
no-answer correct abstention = 0.625
median/p95/max latency ms = 10165.077273999981 / 14855.569325999997 / 18050.93610000005
```

Owner-delegated independent semantic review by GPT-5.6 Sol, independent of tested `gpt-6-astra`:

```text
correct = 48
partially correct = 0
incorrect = 2
no-answer hallucinations = 2
answers file SHA-256 = eed0f944d546220d96c82431e3dfd0037efb574d72e541ae1db09b9fa158ba2b
review digest = 0e450d064781a0390e192e4338e0b1cb45a43297ee2a5629428b3351f1dd9e84
```

`dev-035` is recorded as a Golden answerability defect: current challenge corpus directly answers the comparison even though the frozen query category remains `no-answer`. Historical deterministic metrics remain unchanged.

## Remaining blocker

Only P2-T11 fixed-version hands-on comparison remains decision-critical:

- AnythingLLM;
- Open WebUI Knowledge;
- same-corpus quality;
- Chinese/code/version/conflict/no-answer behavior;
- source A citation → update B → restart → reopen historical citation;
- operational cost/workflow fit.

Public docs alone do not prove the immutable historical Evidence invariant.

## ADR state

ADR-029 remains **BLOCKED**, not Accepted. Retrieval direction is provisionally FTS-only, but final product-value evidence is incomplete.

P3 remains prohibited until ADR-029 is formally Accepted. Stop after ADR acceptance unless explicitly authorized to enter P3.
