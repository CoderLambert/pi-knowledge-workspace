# Labels

Ground-truth retrieval labels live here as `GoldenEvidenceLabel` records.

The durable address is an immutable ParsedArtifact UTF-8 byte range plus exact quote/hash and SourceVersion lineage. Labels may be `required` or `supporting`.

Never label a Chunk id. Rechunking and retrieval-index experiments must be free to change Chunk identity without invalidating ground truth.