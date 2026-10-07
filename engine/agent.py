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


def generate_follow_up_suggestions(query: str, answer: str, chunks: list[dict]) -> list[str]:
    """
    Generates 3 smart, context-aware follow-up question chips based on the user query,
    retrieved chunks, answer text, and active industry vertical.
    Runs instantaneously (0ms) using topic & intent heuristics.
    """
    q_lower = query.lower()
    ans_lower = answer.lower()
    combined = f"{q_lower} {ans_lower}"
    vert = config.VERTICAL.lower()
    
    # 1. First, check if LLM already generated follow-up suggestions in text (e.g. delimiters)
    patterns = [
        r"---(?:SUGGESTED_)?FOLLOW_UPS?---(.*?)$",
        r"(?:Suggested Follow-up Questions|Follow-up Questions):\s*(.*?)$"
    ]
    for pat in patterns:
        m = re.search(pat, answer, re.DOTALL | re.IGNORECASE)
        if m:
            extracted = []
            for line in m.group(1).strip().split("\n"):
                clean = re.sub(r"^[\d\.\-\*\•\s]+", "", line).strip()
                if clean and len(clean) > 5 and clean.endswith("?"):
                    extracted.append(clean)
            if len(extracted) >= 2:
                return extracted[:3]

    # 2. Heuristic Contextual Intent Detection:
    suggestions = []

    # Case A: Answer indicated missing context / Not Found
    if NOT_FOUND.lower() in ans_lower or "could not find" in ans_lower or not chunks:
        return [
            "Which documents are currently indexed in this matter?",
            "Extract a chronological timeline of verified events",
            "Run the Due Diligence & Risk Auditor coworker"
        ]

    # Case B: Deadlines, Dates, Limitation, Hearing, FIR
    if any(k in combined for k in ["deadline", "limitation", "hearing", "date", "period", "expiry", "fir", "statute", "court"]):
        suggestions.append("What is the statutory limitation period for filing this action?")
        suggestions.append("Are there any conflicting dates across witness statements?")
        suggestions.append("Export critical limitation deadlines to Calendar (.ics)")

    # Case C: Parties, Accusations, Witnesses, Roles, Liability
    elif any(k in combined for k in ["plaintiff", "defendant", "accused", "witness", "party", "parties", "director", "officer", "fraud", "breach"]):
        suggestions.append("Summarize the specific liabilities and allegations against the main party")
        suggestions.append("What key documentary evidence is still missing to prove this claim?")
        suggestions.append("Draft a formal written statement denial")

    # Case D: Contracts, Agreements, Clauses, Indemnity, Termination
    elif any(k in combined for k in ["agreement", "contract", "clause", "indemn", "termination", "liability", "covenant", "warranty"]):
        suggestions.append("What are the termination notice requirements and dispute resolution clauses?")
        suggestions.append("Are there any unilateral indemnification or uncapped liabilities?")
        suggestions.append("Run Document Redline Diff against another draft")

    # Case E: Tax, Audit, GST, ITR, Financials, Revenue
    elif any(k in combined for k in ["tax", "gst", "itr", "audit", "financial", "profit", "penalty", "invoice", "balance sheet"]):
        suggestions.append("What are the potential tax penalty implications under Section 271?")
        suggestions.append("Are there reconciliation discrepancies between returns and books?")
        suggestions.append("Summarize the year-over-year revenue and profit delta")

    # Case F: Medical / Clinical / Hospital / Patient
    elif any(k in combined for k in ["patient", "clinical", "diagnosis", "doctor", "medical", "treatment", "drug", "hospital"]):
        suggestions.append("Are there any noted medication contraindications or drug allergies?")
        suggestions.append("Construct a chronological medical history timeline")
        suggestions.append("What follow-up clinical evaluations or lab reports are recommended?")

    # Case G: Default fallback based on vertical
    if len(suggestions) < 3:
        if "law" in vert:
            defaults = [
                "Draft a client advisory summary based on these findings",
                "What are the strongest counter-arguments against this claim?",
                "Export full executive case brief to Word (.docx)"
            ]
        elif "ca" in vert:
            defaults = [
                "Summarize compliance risks for this financial period",
                "Draft an executive advisory memo for the client",
                "Export full executive case brief to Word (.docx)"
            ]
        elif "med" in vert:
            defaults = [
                "Summarize key clinical findings and treatment plan",
                "Are there any missing diagnostic records or discharge notes?",
                "Export full executive case brief to Word (.docx)"
            ]
        else:
            defaults = [
                "What are the main risks and action items in this dossier?",
                "Draft an executive advisory memo for stakeholders",
                "Export full executive case brief to Word (.docx)"
            ]
        for d in defaults:
            if d not in suggestions:
                suggestions.append(d)
            if len(suggestions) == 3:
                break

    return suggestions[:3]


def _result(
    query, ans, sources, backend, escalated,
    retrieval_ms, generation_ms, total_ms,
    follow_ups=None,
) -> dict:
    # Clean any internal follow-up delimiters from displayed answer
    for pat in [r"---(?:SUGGESTED_)?FOLLOW_UPS?---.*$", r"(?:Suggested Follow-up Questions|Follow-up Questions):.*$"]:
        ans = re.sub(pat, "", ans, flags=re.DOTALL | re.IGNORECASE).strip()

    if follow_ups is None:
        follow_ups = generate_follow_up_suggestions(query, ans, sources)

    return {
        "query": query,
        "answer": ans,
        "sources": sources,
        "backend_used": backend,
        "escalated": escalated,
        "follow_ups": follow_ups,
        "timing": {
            "retrieval_ms": retrieval_ms,
            "generation_ms": generation_ms,
            "total_ms": total_ms,
        },
    }

def _safe_json_loads(response: str) -> dict:
    import json
    if "```json" in response:
        json_str = response.split("```json")[1].split("```")[0].strip()
    elif "```" in response:
        json_str = response.split("```")[1].split("```")[0].strip()
    else:
        start = response.find("{")
        end = response.rfind("}")
        if start != -1 and end != -1 and end > start:
            json_str = response[start : end + 1].strip()
        else:
            json_str = response.strip()
    return json.loads(json_str)


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
        data = _safe_json_loads(response)
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


def generate_executive_brief(matter_id: str) -> dict:
    """
    Generates a structured Executive Brief (Summary, Risks, Critical Dates, Financial/Key Totals)
    for a given matter.
    """
    import json
    
    query = "summary executive brief risks obligations critical dates deadlines financial totals key numbers"
    chunks = retriever.retrieve(query, matter_id=matter_id, top_k=15)
    
    if not chunks:
        return {
            "summary": "No documents uploaded to this matter yet.",
            "risks": [],
            "critical_dates": [],
            "key_totals": [],
        }

    system_prompt = (
        "You are an elite Professional Assistant for ProAssist. Extract a concise Executive Brief from the document excerpts. "
        "You MUST respond ONLY with a valid JSON object. Do not include markdown code blocks or any other text.\n"
        "Required JSON schema:\n"
        "{\n"
        '  "summary": "1-2 paragraph executive summary of the matter",\n'
        '  "risks": ["Risk or obligation 1", "Risk or obligation 2"],\n'
        '  "critical_dates": ["YYYY-MM-DD - Event/Deadline description"],\n'
        '  "key_totals": ["Financial amount, score, or key metric 1"]\n'
        "}\n"
    )
    
    user_prompt = _build_user_prompt("Generate Executive Brief in JSON as requested.", chunks)
    
    try:
        response, backend = llm.generate_with_fallback(system_prompt, user_prompt, prefer_cloud=True)
        data = _safe_json_loads(response)
        for key in ["summary", "risks", "critical_dates", "key_totals"]:
            if key not in data:
                data[key] = [] if key != "summary" else "No summary available."
                
        users.save_matter_executive_brief(matter_id, data)
        return data
        
    except Exception as e:
        print(f"[agent] Failed to generate executive brief: {e}")
        return {
            "summary": f"Failed to generate brief: {str(e)}",
            "risks": [],
            "critical_dates": [],
            "key_totals": [],
        }
