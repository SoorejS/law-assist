"""
OpenWorker Coworker Engine — Local-First Autonomous Professional Coworkers.

Core Philosophy (adapted from OpenWorker / AI Fund):
"Ask for an outcome, not just an answer."
Each Coworker has a specialized persona, target vertical, and autonomous multi-step workflow.
"""

from __future__ import annotations
import json
import time
import uuid
import re
from typing import Optional, Dict, Any, List

import config
import retrieve as retriever
import llm
import users as user_store


# ── Built-in Coworkers Catalog ──────────────────────────────────────────────────

BUILTIN_COWORKERS: List[Dict[str, Any]] = [
    {
        "id": "case_analyst",
        "name": "Case Chronology & Analyst",
        "role": "Senior Litigation Case Analyst",
        "description": "Constructs complete factual chronology, maps parties and entities, and cross-examines evidentiary claims across all filings.",
        "icon": "scale",
        "vertical": "law_firm",
        "default_query": "extract comprehensive factual timeline of events, all parties involved with their roles, central dispute issues, and key evidentiary claims",
        "system_prompt": (
            "You are an elite Senior Litigation Case Analyst. Your mission is to analyze all case records and deliver "
            "an outcome-ready Litigation Dossier. Focus on dates, sequence of events, inconsistencies, parties' assertions, "
            "and documentary citations. Respond in valid JSON with structured sections."
        ),
    },
    {
        "id": "due_diligence",
        "name": "Due Diligence & Risk Auditor",
        "role": "Corporate Transaction & Contract Counsel",
        "description": "Scrutinizes documents for unilateral obligations, indemnity exposure, hidden liabilities, and critical missing protective terms.",
        "icon": "shield-alert",
        "vertical": "law_firm",
        "default_query": "perform due diligence audit: identify unilateral obligations, indemnity risks, penalty clauses, termination triggers, and critical missing terms",
        "system_prompt": (
            "You are a meticulous Corporate Transaction & Due Diligence Counsel. Your objective is to audit legal and commercial agreements "
            "for material risk, indemnification exposure, governing law pitfalls, termination triggers, and missing standard protections. "
            "Deliver an actionable risk matrix with severity ratings in valid JSON."
        ),
    },
    {
        "id": "deadline_tracker",
        "name": "Limitation & Court Deadline Tracker",
        "role": "Legal Registry & Limitation Specialist",
        "description": "Identifies cause of action dates, statutory limitation periods, court appearance schedules, and mandatory filing windows.",
        "icon": "calendar-clock",
        "vertical": "law_firm",
        "default_query": "identify all dates of cause of action, statutory limitation deadlines, court dates, notice response windows, and procedural milestones",
        "system_prompt": (
            "You are an expert Legal Registry and Limitation Specialist. You calculate statutory limitation periods, response deadlines, "
            "and critical hearing dates. Emphasize any limitation risks or impending expiration dates. Respond in valid JSON."
        ),
    },
    {
        "id": "client_brief",
        "name": "Client Advisory Memo Drafter",
        "role": "Senior Client Communications Counsel",
        "description": "Transforms dense technical filings into an executive, layman-friendly advisory memo explaining status, strengths, and client actions.",
        "icon": "file-text",
        "vertical": "all",
        "default_query": "draft a clear, layman-accessible client advisory memorandum summarizing current case status, merits, potential risks, and concrete steps required from the client",
        "system_prompt": (
            "You are a seasoned Client Advisory Counsel. Your goal is to draft an executive, easy-to-read client memorandum. "
            "Explain complex legal/financial procedures in straightforward, professional language. Clearly separate findings, "
            "risks, and what the client must do next. Respond in valid JSON."
        ),
    },
    {
        "id": "tax_compliance",
        "name": "Tax & Financial Compliance Auditor",
        "role": "Chartered Accountant & Tax Auditor",
        "description": "Audits GST returns, ITR filings, TDS compliance, turnover figures, and detects cross-document financial discrepancies.",
        "icon": "receipt",
        "vertical": "ca_firm",
        "default_query": "cross-check tax filings, GSTIN numbers, ITR disclosures, TDS deductions, revenue reconciliation, and audit red flags",
        "system_prompt": (
            "You are a Senior Chartered Accountant and Tax Auditor. Analyze financial statements, invoices, and tax filings. "
            "Detect reconciliation mismatches, GST/TDS anomalies, and compliance risks under statutory laws. Respond in valid JSON."
        ),
    },
    {
        "id": "patient_history",
        "name": "Clinical Records & History Summarizer",
        "role": "Clinical Documentation Specialist",
        "description": "Synthesizes diagnostic reports, doctor notes, prescription regimens, and flags critical health contraindications.",
        "icon": "heart-pulse",
        "vertical": "medical",
        "default_query": "extract patient clinical timeline, chief complaints, diagnostic findings, administered medications, and critical health risk factors",
        "system_prompt": (
            "You are a Medico-Legal and Clinical Documentation Specialist. Summarize patient history chronologically, "
            "listing past medical history, presenting complaints, lab/imaging findings, active drug prescriptions, and clinical risks. Respond in valid JSON."
        ),
    },
    {
        "id": "executive_assistant",
        "name": "Executive Workspace Assistant",
        "role": "Senior Strategic Operations Advisor",
        "description": "Delivers an executive 360-degree briefing: core dossier summary, decision matrix, and prioritized next actions.",
        "icon": "sparkles",
        "vertical": "generic",
        "default_query": "synthesize full document dossier: high-level executive summary, key stakeholder decisions needed, and prioritized action plan",
        "system_prompt": (
            "You are a Senior Strategic Operations Advisor. Synthesize the provided dossier into an executive briefing. "
            "Highlight core findings, impending decisions, and an execution action plan. Respond in valid JSON."
        ),
    },
    {
        "id": "contract_diff",
        "name": "Contract & Document Redline Analyzer",
        "role": "Comparative Document & Redline Specialist",
        "description": "Compares drafts and agreements to identify added obligations, deleted protections, altered financial terms, and liability shifts.",
        "icon": "git-compare",
        "vertical": "all",
        "default_query": "compare document versions or clauses: identify added terms, deleted covenants, modified liabilities, and risk impact",
        "system_prompt": (
            "You are an expert Comparative Document and Redline Specialist. Your job is to analyze document drafts, versions, "
            "or clauses and extract key variations: what was added, what was removed, what terms were modified, and the legal/commercial "
            "consequences of each difference. Respond in valid JSON with structured sections."
        ),
    },
]


def list_coworkers(vertical: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns built-in and custom coworkers, optionally filtered by vertical."""
    result = []
    for c in BUILTIN_COWORKERS:
        if not vertical or vertical == "all" or c["vertical"] in ("all", vertical, "generic"):
            item = dict(c)
            item["is_builtin"] = True
            result.append(item)

    custom_list = user_store.list_custom_coworkers(vertical=vertical)
    for c in custom_list:
        item = dict(c)
        item["is_builtin"] = False
        result.append(item)

    return result


def get_coworker(coworker_id: str) -> Optional[Dict[str, Any]]:
    """Look up coworker by ID."""
    for c in BUILTIN_COWORKERS:
        if c["id"] == coworker_id:
            item = dict(c)
            item["is_builtin"] = True
            return item

    custom = user_store.get_custom_coworker(coworker_id)
    if custom:
        item = dict(custom)
        item["is_builtin"] = False
        return item

    return None


def run_coworker(
    coworker_id: str,
    matter_id: str,
    custom_instruction: Optional[str] = None,
    force_cloud: bool = False,
    use_heavy: bool = False,
) -> Dict[str, Any]:
    """
    Executes a coworker task against a matter.
    Follows OpenWorker design: 'Ask for an outcome, not just an answer.'
    """
    t0 = time.time()
    coworker = get_coworker(coworker_id)
    if not coworker:
        raise ValueError(f"Coworker '{coworker_id}' not found.")

    query = custom_instruction.strip() if custom_instruction and custom_instruction.strip() else coworker["default_query"]

    # 1. Retrieve relevant chunks with hybrid RRF
    t_ret = time.time()
    chunks = retriever.retrieve(query, matter_id=matter_id, top_k=15)
    retrieval_ms = int((time.time() - t_ret) * 1000)

    if not chunks:
        return {
            "coworker_id": coworker_id,
            "coworker_name": coworker["name"],
            "role": coworker["role"],
            "status": "completed",
            "title": f"{coworker['name']} Outcome",
            "summary": "No documents uploaded to this notebook yet. Please upload relevant files to run this coworker.",
            "key_findings": ["No document data available."],
            "risk_matrix": [],
            "action_plan": [{"step": 1, "action": "Upload case documents to this matter", "owner_or_deadline": "Immediate"}],
            "citations": [],
            "raw_markdown": "### No Documents Found\nPlease upload files to this matter before running this Coworker.",
            "backend_used": "local",
            "timing": {"retrieval_ms": retrieval_ms, "generation_ms": 0, "total_ms": int((time.time() - t0) * 1000)},
        }

    context = retriever.format_context(chunks)

    # 2. Build structured Outcome Prompt
    system_prompt = (
        f"{coworker['system_prompt']}\n\n"
        "You are an autonomous AI Coworker delivering a complete outcome. "
        "You MUST respond ONLY with a valid JSON object. Do not include markdown code block backticks unless inside strings.\n"
        "Required JSON schema:\n"
        "{\n"
        '  "title": "Outcome Briefing Title",\n'
        '  "summary": "Comprehensive executive summary paragraph (3-5 sentences)",\n'
        '  "key_findings": [\n'
        '    "Finding 1 with specific facts/numbers/dates",\n'
        '    "Finding 2"\n'
        '  ],\n'
        '  "risk_matrix": [\n'
        '    {"item": "Risk description", "severity": "high" or "medium" or "low", "detail": "Impact and mitigation"}\n'
        '  ],\n'
        '  "action_plan": [\n'
        '    {"step": 1, "action": "Clear actionable step", "owner_or_deadline": "Responsible party or timeframe"}\n'
        '  ],\n'
        '  "citations": [\n'
        '    {"source": "filename.pdf", "page": "Page number or section", "reference": "What fact it proves"}\n'
        '  ],\n'
        '  "markdown_memo": "A complete, beautifully formatted markdown memo ready for export with headers (##, ###), bullet points, and tables if applicable."\n'
        "}\n"
    )

    user_prompt = (
        f"COWORKER OBJECTIVE: {query}\n\n"
        f"DOCUMENT DOSSIER EXCERPTS:\n"
        f"{context}\n\n"
        "DELIVER COMPLETE STRUCTURED OUTCOME IN JSON AS SPECIFIED:"
    )

    t_gen = time.time()
    try:
        response, backend = llm.generate_with_fallback(
            system_prompt,
            user_prompt,
            prefer_cloud=force_cloud,
            use_heavy=use_heavy,
        )
    except Exception as e:
        response = ""
        backend = "error"

    generation_ms = int((time.time() - t_gen) * 1000)

    # 3. Parse JSON response safely
    data = _parse_coworker_response(response, coworker, chunks)

    data["coworker_id"] = coworker_id
    data["coworker_name"] = coworker["name"]
    data["role"] = coworker["role"]
    data["backend_used"] = backend
    data["timing"] = {
        "retrieval_ms": retrieval_ms,
        "generation_ms": generation_ms,
        "total_ms": int((time.time() - t0) * 1000),
    }

    return data


def _parse_coworker_response(response: str, coworker: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Extracts JSON object from LLM response or creates fallback structure."""
    if not response:
        return _fallback_outcome(coworker, chunks, "Generation failed or returned empty response.")

    json_str = ""
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

    try:
        parsed = json.loads(json_str)
        return {
            "status": "completed",
            "title": parsed.get("title", f"{coworker['name']} Outcome"),
            "summary": parsed.get("summary", "Summary extracted from provided records."),
            "key_findings": parsed.get("key_findings", []),
            "risk_matrix": parsed.get("risk_matrix", []),
            "action_plan": parsed.get("action_plan", []),
            "citations": parsed.get("citations", _extract_fallback_citations(chunks)),
            "markdown_memo": parsed.get("markdown_memo", response),
        }
    except Exception:
        return _fallback_outcome(coworker, chunks, response)


def _fallback_outcome(coworker: Dict[str, Any], chunks: List[Dict[str, Any]], raw_text: str) -> Dict[str, Any]:
    """Generates a structured fallback when pure JSON parsing fails."""
    return {
        "status": "completed",
        "title": f"{coworker['name']} Outcome Report",
        "summary": raw_text[:400] + ("..." if len(raw_text) > 400 else ""),
        "key_findings": [f"Review of {len(chunks)} document chunks completed."],
        "risk_matrix": [{"item": "Structured parsing fallback", "severity": "low", "detail": "Full raw text memo is available below."}],
        "action_plan": [{"step": 1, "action": "Review the full analysis report below", "owner_or_deadline": "Counsel"}],
        "citations": _extract_fallback_citations(chunks),
        "markdown_memo": raw_text,
    }


def _extract_fallback_citations(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    citations = []
    for c in chunks[:6]:
        src = c.get("source_file", "Unknown")
        pg = c.get("page", "1")
        key = (src, pg)
        if key not in seen:
            seen.add(key)
            citations.append({
                "source": src,
                "page": f"Page {pg}" if pg else "Section",
                "reference": c.get("chunk_text", "")[:120] + "...",
            })
    return citations


# ── Portable Workflow Bundles (.bundle.json) ──────────────────────────────────

def export_bundle(coworker_id: str) -> Dict[str, Any]:
    """Exports a coworker definition as an OpenWorker-compatible portable bundle."""
    coworker = get_coworker(coworker_id)
    if not coworker:
        raise ValueError(f"Coworker '{coworker_id}' not found.")

    return {
        "format": "openworker_bundle_v1",
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "bundle": {
            "id": coworker["id"],
            "name": coworker["name"],
            "role": coworker["role"],
            "description": coworker["description"],
            "icon": coworker.get("icon", "sparkles"),
            "vertical": coworker.get("vertical", "all"),
            "system_prompt": coworker["system_prompt"],
            "default_query": coworker["default_query"],
        },
    }


def import_bundle(bundle_data: Dict[str, Any], user_id: Optional[int] = None) -> Dict[str, Any]:
    """Imports a portable bundle and registers it in the local workspace."""
    if "bundle" in bundle_data:
        data = bundle_data["bundle"]
    else:
        data = bundle_data

    required_keys = ["name", "role", "description", "system_prompt", "default_query"]
    for k in required_keys:
        if k not in data or not str(data[k]).strip():
            raise ValueError(f"Invalid bundle: missing required property '{k}'")

    coworker_id = data.get("id") or f"custom_{uuid.uuid4().hex[:8]}"
    coworker_id = re.sub(r"[^a-zA-Z0-9_]", "_", coworker_id).lower()

    return user_store.save_custom_coworker(
        coworker_id=coworker_id,
        name=data["name"].strip(),
        role=data["role"].strip(),
        description=data["description"].strip(),
        icon=data.get("icon", "sparkles"),
        vertical=data.get("vertical", "all"),
        system_prompt=data["system_prompt"].strip(),
        default_query=data["default_query"].strip(),
        user_id=user_id,
    )
