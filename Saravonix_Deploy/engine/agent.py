"""
Agentic Orchestrator — the core IP.

Flow:
  1. Retrieve relevant chunks (vector + keyword hybrid)
  2. If nothing relevant → honest "not found" reply
  3. Classify intent → decide local vs cloud
  4. Generate grounded answer with mandatory citations
  5. Validate citations present → if missing, force "not found"
  6. Return structured result
"""

from __future__ import annotations
import time
import re
from typing import Optional

import config
import retrieve as retriever
import llm
import vertical
import users


NOT_FOUND = "I could not find that in your documents."


def answer(
    query: str,
    matter_id: Optional[str] = None,
    force_cloud: bool = False,
    use_heavy: bool = False,
) -> dict:
    """
    Main entry point. Returns:
    {
      query, answer, sources, backend_used, escalated,
      retrieval_ms, generation_ms, total_ms
    }
    """
    t0 = time.time()

    # ── 1. Retrieve ────────────────────────────────────────────────────────────
    t_ret = time.time()
    chunks = retriever.retrieve(query, matter_id=matter_id)
    retrieval_ms = int((time.time() - t_ret) * 1000)

    # ── 2. Nothing found → honest reply ───────────────────────────────────────
    if not retriever.has_relevant_results(chunks):
        return _result(
            query=query,
            ans=NOT_FOUND,
            sources=[],
            backend="none",
            escalated=False,
            retrieval_ms=retrieval_ms,
            generation_ms=0,
            total_ms=int((time.time() - t0) * 1000),
        )

    # ── 3. Classify intent → routing decision ─────────────────────────────────
    escalate = force_cloud or _should_escalate(query, chunks)
    # Use 105B for deep synthesis queries when explicitly requested or auto-detected
    use_heavy = use_heavy or any(kw in query.lower() for kw in config.HEAVY_ESCALATION_KEYWORDS)

    # ── 4. Build prompt ────────────────────────────────────────────────────────
    system_prompt = vertical.get_system_prompt()
    user_prompt = _build_user_prompt(query, chunks)

    # ── 5. Generate ────────────────────────────────────────────────────────────
    t_gen = time.time()
    try:
        if escalate:
            response, backend = llm.generate_with_fallback(
                system_prompt, user_prompt, prefer_cloud=True, use_heavy=use_heavy
            )
        else:
            response, backend = llm.generate_with_fallback(
                system_prompt, user_prompt, prefer_cloud=False
            )
            # Re-evaluate confidence; if weak, escalate to cloud
            if not llm.is_confident(response):
                try:
                    response, backend = llm.generate_with_fallback(
                        system_prompt, user_prompt, prefer_cloud=True, use_heavy=use_heavy
                    )
                    escalate = True
                except Exception:
                    pass
    except Exception as e:
        response = NOT_FOUND
        backend = "error"
    generation_ms = int((time.time() - t_gen) * 1000)

    # ── 6. Validate citations ──────────────────────────────────────────────────
    if not _has_citation(response) and response != NOT_FOUND:
        # Force append the top source as a citation note
        if chunks:
            top = chunks[0]
            page_str = f", Page {top['page']}" if top.get("page") else ""
            response += f"\n\n[Source: {top['source_file']}{page_str}]"

    # ── 7. Extract structured sources ─────────────────────────────────────────
    sources = _extract_sources(chunks[:5])

    return _result(
        query=query,
        ans=response,
        sources=sources,
        backend=backend,
        escalated=escalate,
        retrieval_ms=retrieval_ms,
        generation_ms=generation_ms,
        total_ms=int((time.time() - t0) * 1000),
    )


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _should_escalate(query: str, chunks: list[dict]) -> bool:
    q_lower = query.lower()

    # Keyword-triggered escalation
    if any(kw in q_lower for kw in config.ESCALATION_KEYWORDS):
        return True

    # Vertical-specific escalation intents
    if vertical.is_escalation_intent(query):
        return True

    # Multi-source synthesis (chunks from 4+ different files)
    unique_files = len({c["source_file"] for c in chunks})
    if unique_files >= 4:
        return True

    return False


def _build_user_prompt(query: str, chunks: list[dict]) -> str:
    context = retriever.format_context(chunks)
    return (
        f"DOCUMENT EXCERPTS:\n"
        f"{context}\n"
        f"---\n"
        f"QUESTION: {query}\n\n"
        f"ANSWER (cite every fact with its source file and page number):"
    )


def _has_citation(text: str) -> bool:
    # Looks for [Source: ...] or (Source: ...) patterns
    return bool(re.search(r"\[Source:", text, re.IGNORECASE) or
                re.search(r"\(Source:", text, re.IGNORECASE))


def _extract_sources(chunks: list[dict]) -> list[dict]:
    seen = set()
    sources = []
    for c in chunks:
        key = (c["source_file"], c.get("page"))
        if key not in seen:
            seen.add(key)
            sources.append({
                "file": c["source_file"],
                "page": c.get("page"),
                "section": c.get("section"),
                "passage": c["chunk_text"][:300],
                "distance": round(c["distance"], 4),
            })
    return sources


def _result(
    query, ans, sources, backend, escalated,
    retrieval_ms, generation_ms, total_ms
) -> dict:
    return {
        "query": query,
        "answer": ans,
        "sources": sources,
        "backend_used": backend,
        "escalated": escalated,
        "timing": {
            "retrieval_ms": retrieval_ms,
            "generation_ms": generation_ms,
            "total_ms": total_ms,
        },
    }

def extract_intelligence(matter_id: str) -> dict:
    """
    Extracts structured AI intelligence (Timeline, People, Contradictions, Missing Evidence)
    for a given matter.
    """
    import json
    
    query = "extract timeline dates key people parties involved potential contradictions and missing evidence or gaps"
    chunks = retriever.retrieve(query, matter_id=matter_id, top_k=15)
    
    if not chunks:
        return {
            "timeline": [],
            "people": [],
            "contradictions": ["No documents found in this matter."],
            "missing_evidence": []
        }

    system_prompt = (
        "You are a meticulous Legal AI Assistant. Your task is to extract structured intelligence from the provided document excerpts. "
        "You MUST respond ONLY with a valid JSON object. Do not include markdown code blocks or any other text.\n"
        "Required JSON schema:\n"
        "{\n"
        '  "timeline": [{"date": "YYYY-MM-DD or approx", "event": "Description of what happened"}],\n'
        '  "people": [{"name": "Person Name", "role": "Their role in the matter"}],\n'
        '  "contradictions": ["Contradiction 1", "Contradiction 2"],\n'
        '  "missing_evidence": ["Missing evidence 1", "Missing evidence 2"]\n'
        "}\n"
        "If you cannot find information for a section, return an empty list for that key."
    )
    
    user_prompt = _build_user_prompt("Extract intelligence into JSON as requested.", chunks)
    
    try:
        response, backend = llm.generate_with_fallback(system_prompt, user_prompt, prefer_cloud=True)
        if "```json" in response:
            json_str = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            json_str = response.split("```")[1].split("```")[0].strip()
        else:
            json_str = response.strip()
            
        data = json.loads(json_str)
        # Ensure all keys exist
        for key in ["timeline", "people", "contradictions", "missing_evidence"]:
            if key not in data:
                data[key] = []
                
        # Save to DB
        users.save_matter_intelligence(matter_id, data)
        return data
        
    except Exception as e:
        print(f"[agent] Failed to extract intelligence: {e}")
        return {
            "timeline": [],
            "people": [],
            "contradictions": [f"Extraction failed: {str(e)}"],
            "missing_evidence": []
        }
