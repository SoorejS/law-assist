"""
Retrieval: vector search + keyword search, merged with deduplication.
"""

from typing import Optional
import config
import store
from embedder import get_embedder


def retrieve(
    query: str,
    folder_id: Optional[str] = None,
    top_k: int = None,
) -> list[dict]:
    """
    Hybrid retrieval: vector similarity + keyword match, deduplicated and ranked.
    Returns list of chunk dicts with distance scores.
    """
    top_k = top_k or config.TOP_K
    db = store.get_db()
    embedder = get_embedder()

    query_vec = embedder.encode_query(query)

    vec_results = store.vector_search(db, query_vec, top_k=top_k, folder_id=folder_id)
    kw_results = store.keyword_search(db, query, top_k=config.KEYWORD_TOP_K, folder_id=folder_id)

    # Merge, deduplicate by chunk id, prefer lower (better) distance
    seen: dict[int, dict] = {}
    for chunk in vec_results:
        seen[chunk["id"]] = chunk
    for chunk in kw_results:
        if chunk["id"] not in seen:
            seen[chunk["id"]] = chunk
        else:
            # Keep the lower distance (keyword match boosts relevance slightly)
            existing = seen[chunk["id"]]
            seen[chunk["id"]]["distance"] = min(existing["distance"], chunk["distance"] * 0.9)

    results = sorted(seen.values(), key=lambda x: x["distance"])
    return results[:top_k]


def has_relevant_results(chunks: list[dict]) -> bool:
    """True if at least one chunk is above the relevance threshold."""
    if not chunks:
        return False
    return chunks[0]["distance"] <= config.SIMILARITY_THRESHOLD


def format_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a numbered context block for the LLM prompt."""
    lines = []
    for i, chunk in enumerate(chunks, start=1):
        source = chunk["source_file"]
        page = f", Page {chunk['page']}" if chunk["page"] else ""
        section = f", §{chunk['section']}" if chunk.get("section") else ""
        lines.append(f"[{i}] Source: {source}{page}{section}")
        lines.append(chunk["chunk_text"])
        lines.append("")
    return "\n".join(lines)
