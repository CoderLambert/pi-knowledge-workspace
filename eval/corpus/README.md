# Corpus

P2-T02 and later corpus tasks place immutable captured technical material and its `GoldenCorpusArtifact` metadata here.

Each corpus record must preserve source/capture/version metadata and the exact ParsedArtifact lineage used for annotation. Updating an upstream document creates another captured version/artifact; it must not mutate an already-labelled historical artifact.

Do not store retrieval-time Chunk ids in corpus metadata.