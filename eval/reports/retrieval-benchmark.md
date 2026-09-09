# Retrieval Benchmark Report

Split: **development**
Generated: `2026-09-09T08:30:54.839Z`
Queries: **50**

| Variant | Recall@10 | MRR | All required | p95 ms | Peak RSS bytes | Index bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fts-baseline | 1.0000 | 0.9365 | 1.0000 | 1.3342 | 105443328 | 49152 |

## fts-baseline

### Configuration

- `challengeChunks`: `35`
- `corpusChunks`: `38`
- `lexicalProfile`: `baseline`
- `naturalLanguageCompiler`: `quoted-literal-or`
- `retriever`: `sqlite-fts5`
- `tokenizer`: `unicode61`
- `topK`: `10`

### Failure counts

- none

### Diagnostics

- answerable queries scored: 42
- no-answer queries: 8
- no-answer queries with any hit: 8
- latency median / p95 / max ms: 0.7944 / 1.3342 / 3.4006
