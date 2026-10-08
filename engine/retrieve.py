"""
Retrieval: vector search + keyword search, merged with deduplication.
"""

from typing import Optional
import config
import store
from embedder import get_embedder


def retrieve(
    query: str,
    matter_id: Optional[str] = None,
    doc_type: Optional[str] = None,
    top_k: int = 5,
) -> list[dict]:
    """
    Hybrid retrieval: vector similarity + keyword match, deduplicated and ranked.
    Returns list of chunk dicts with distance scores.
    """
    top_k = top_k or config.TOP_K
    embedder = get_embedder()
    with store.get_db_context() as db:
        if embedder.enabled:
            query_vec = embedder.encode_query(query)
            vec_results = store.vector_search(db, query_vec, top_k=top_k, matter_id=matter_id, doc_type=doc_type)
            kw_k = config.KEYWORD_TOP_K
        else:
            # Avoid brute-force scanning identical dummy vectors
            vec_results = []
            kw_k = top_k

        kw_results = store.keyword_search(db, query, top_k=kw_k, matter_id=matter_id, doc_type=doc_type)

        # Ground broad queries (e.g. "summarize this case") in the opening pages of the documents
        if matter_id and len(vec_results) + len(kw_results) < top_k and not embedder.enabled:
            have_ids = {c["id"] for c in kw_results}
            needed = top_k - len(kw_results)
            kw_results += store.leading_chunks(db, matter_id, needed, exclude_ids=have_ids)

    if not vec_results:
        for c in kw_results:
            c["rrf_score"] = 0.0
        return kw_results[:top_k]

    # RRF (Reciprocal Rank Fusion) ranking
    rrf_k = 60
    rrf_scores: dict[int, float] = {}
    chunk_map: dict[int, dict] = {}

    for rank, chunk in enumerate(vec_results, start=1):
        cid = chunk["id"]
        chunk_map[cid] = chunk
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (rrf_k + rank))

    for rank, chunk in enumerate(kw_results, start=1):
        cid = chunk["id"]
        if cid not in chunk_map:
            chunk_map[cid] = chunk
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (rrf_k + rank))

    # Sort by RRF score descending
    sorted_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)
    results = []
    for cid in sorted_ids[:top_k]:
        c = chunk_map[cid]
        c["rrf_score"] = rrf_scores[cid]
        results.append(c)

    return results


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
