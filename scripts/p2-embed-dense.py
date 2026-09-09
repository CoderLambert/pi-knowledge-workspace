#!/usr/bin/env python3
import argparse
import json
import os
import platform
import resource
import time
from pathlib import Path

import sentence_transformers
import torch
import transformers
from sentence_transformers import SentenceTransformer


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def encode_batch(model, texts, batch_size):
    vectors = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    return vectors.tolist()


def main():
    args = parse_args()
    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    profile = payload["profile"]
    documents = payload["documents"]
    queries = payload["queries"]

    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    load_started = time.perf_counter()
    model = SentenceTransformer(
        profile["model"],
        revision=profile["revision"],
        device="cpu",
        trust_remote_code=False,
    )
    load_ms = (time.perf_counter() - load_started) * 1000.0

    dimensions = int(model.get_sentence_embedding_dimension())
    if dimensions != int(profile["dimensions"]):
        raise RuntimeError(f"embedding dimension mismatch: expected {profile['dimensions']}, got {dimensions}")

    warmup_text = queries[0] if queries else documents[0]
    warmup_started = time.perf_counter()
    encode_batch(model, [warmup_text], 1)
    warmup_ms = (time.perf_counter() - warmup_started) * 1000.0

    document_started = time.perf_counter()
    document_vectors = encode_batch(model, documents, 16)
    document_build_ms = (time.perf_counter() - document_started) * 1000.0

    query_vectors = []
    for text in queries:
        query_started = time.perf_counter()
        vector = encode_batch(model, [text], 1)[0]
        embed_ms = (time.perf_counter() - query_started) * 1000.0
        query_vectors.append({"embedMs": embed_ms, "vector": vector})

    peak_rss_bytes = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss) * 1024
    result = {
        "schemaVersion": 1,
        "profileId": profile["id"],
        "model": profile["model"],
        "revision": profile["revision"],
        "dimensions": dimensions,
        "documentVectors": document_vectors,
        "queryVectors": query_vectors,
        "runtime": {
            "python": platform.python_version(),
            "sentenceTransformers": sentence_transformers.__version__,
            "transformers": transformers.__version__,
            "torch": torch.__version__,
            "device": str(model.device),
            "maxSequenceLength": int(model.max_seq_length),
            "loadMs": load_ms,
            "warmupMs": warmup_ms,
            "documentBuildMs": document_build_ms,
            "peakRssBytes": peak_rss_bytes,
        },
    }
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
