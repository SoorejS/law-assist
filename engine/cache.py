"""
Answer Cache — Zero-computation, lossless latency elimination for repeated queries.

Lawyers frequently re-ask or re-open standard queries (e.g. "What is the limitation date?",
"Summarize the main allegations", clicking follow-up chips). Re-running inference on an older CPU
wastes 10–30 seconds for an identical outcome.

Cache key = normalized query + matter_id + routing flags + document set fingerprint.
Any upload or delete changes the fingerprint, guaranteeing zero stale answers.
"""

from __future__ import annotations
import threading
import time
from collections import OrderedDict
from typing import Optional, Any

import hardware


class LRUCache:
    def __init__(self, max_entries: int):
        self.max_entries = max(8, max_entries)
        self._data: "OrderedDict[tuple, tuple[float, Any]]" = OrderedDict()
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: tuple) -> Optional[Any]:
        with self._lock:
            item = self._data.get(key)
            if item is None:
                self.misses += 1
                return None
            self._data.move_to_end(key)
            self.hits += 1
            return item[1]

    def put(self, key: tuple, value: Any) -> None:
        with self._lock:
            self._data[key] = (time.time(), value)
            self._data.move_to_end(key)
            while len(self._data) > self.max_entries:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def stats(self) -> dict:
        with self._lock:
            total = self.hits + self.misses
            return {
                "entries": len(self._data),
                "max_entries": self.max_entries,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": round(self.hits / total, 3) if total else 0.0,
            }


answer_cache = LRUCache(hardware.get_profile().response_cache_entries)


def normalize_query(query: str) -> str:
    return " ".join(query.lower().split()).rstrip("?.! ")


def matter_fingerprint(matter_id: Optional[str]) -> tuple:
    """Cheap, index-backed signature of a matter's document set."""
    import store
    with store.get_db_context() as db:
        if matter_id:
            row = db.execute(
                "SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM chunks WHERE matter_id = ?",
                (matter_id,),
            ).fetchone()
        else:
            row = db.execute("SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM chunks").fetchone()
    return (row["n"], row["m"]) if row else (0, 0)


def answer_key(query: str, matter_id: Optional[str], force_cloud: bool, use_heavy: bool) -> tuple:
    import config
    return (
        normalize_query(query),
        matter_id or "",
        bool(force_cloud),
        bool(use_heavy),
        config.LLM_BACKEND,
        matter_fingerprint(matter_id),
    )
