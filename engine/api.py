"""
FastAPI REST API — serves both the Tauri desktop UI and LAN browser clients.
Runs on 0.0.0.0:8765

Production hardened:
- CORS restricted to known origins
- Server-side MIME type validation
- Upload size limits
- Rate limiting on /query
- Auto-generate JWT secret if default detected
- Structured error responses
"""

from __future__ import annotations
import os
import shutil
import secrets
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import (
    FastAPI, Request, UploadFile, File, Form,
    HTTPException, Depends, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import config
import agent
import ingest as ingester
import store
import users as user_store
import auth as auth_module
import license_client
import coworkers
import web_search
import hardware
import cache
import vertical
import llm

# ── Rate limiter ────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="law-assist Engine",
    version="1.0.0",
    description="Private Legal Intelligence Platform — Local Offline AI Workstation",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("startup")
async def on_startup():
    import threading
    try:
        threading.Thread(
            target=llm.warmup,
            args=(vertical.get_system_prompt(),),
            daemon=True,
            name="llm-warmup",
        ).start()
    except Exception as e:
        print(f"[api] warmup launch skipped: {e}")


# ── CORS — restricted to known local origins ────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:1420",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:1420",
    "http://127.0.0.1:5173",
    "tauri://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    allow_credentials=True,
)

# ── Allowed MIME types for upload ──────────────────────────────────────────────
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv", ".xlsx", ".xls", ".md"}
MAX_UPLOAD_MB = 150
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


# ── Pydantic models ────────────────────────────────────────────────────────────

class SetupWorkspace(BaseModel):
    firm_name: str
    admin_name: str
    admin_username: str
    master_password: str
    vertical: str = "generic"

class QueryRequest(BaseModel):
    query: str
    matter_id: Optional[str] = None
    force_cloud: bool = False
    use_heavy: bool = False

class GlobalSearchRequest(BaseModel):
    query: str
    doc_type: Optional[str] = None
    limit: int = 10

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str = ""
    email: str = ""
    phone: str = ""
    department: str = ""
    role: str = "associate"

class PasswordChange(BaseModel):
    new_password: str

class MatterCreate(BaseModel):
    title: str
    description: str = ""
    tags: Optional[list[str]] = None

class MatterTagsUpdate(BaseModel):
    tags: list[str]

class DocCompareRequest(BaseModel):
    doc1: str
    doc2: str
    focus: Optional[str] = None

class WebVerifyRequest(BaseModel):
    query: str

class CoworkerRunRequest(BaseModel):
    coworker_id: str
    custom_instruction: Optional[str] = None
    force_cloud: bool = False
    use_heavy: bool = False

class CustomCoworkerCreate(BaseModel):
    id: Optional[str] = None
    name: str
    role: str
    description: str
    icon: str = "sparkles"
    vertical: str = "all"
    system_prompt: str
    default_query: str

class CoworkerImportRequest(BaseModel):
    bundle: dict

class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None


# ── Startup: auto-generate JWT secret if default ────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Security hardening on first launch."""
    env_path = Path(__file__).parent / ".env"
    if config.JWT_SECRET == "change_this_secret":
        new_secret = secrets.token_hex(32)
        # Read existing .env, update or append JWT_SECRET
        lines = []
        replaced = False
        if env_path.exists():
            with open(env_path, "r") as f:
                lines = f.readlines()
            for i, line in enumerate(lines):
                if line.startswith("JWT_SECRET="):
                    lines[i] = f"JWT_SECRET={new_secret}\n"
                    replaced = True
                    break
        if not replaced:
            lines.append(f"\nJWT_SECRET={new_secret}\n")
        with open(env_path, "w") as f:
            f.writelines(lines)
        # Update in-memory value
        config.JWT_SECRET = new_secret
        print("[law-assist] WARNING: Generated a new secure JWT_SECRET. Restart required for full effect.")


# ── Health & system ────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    lic = license_client.get_info()
    return {
        "status": "ok",
        "version": "1.0.0",
        "app": "ProAssist",
        "vertical": user_store.get_workspace_vertical() if user_store.is_workspace_initialized() else config.VERTICAL,
        "llm_backend": config.LLM_BACKEND,
        "license": lic,
    }

@app.get("/license")
def get_license():
    return license_client.get_info()


# ── Setup & Auth ───────────────────────────────────────────────────────────────

@app.get("/auth/setup-status")
def setup_status():
    return {"initialized": user_store.is_workspace_initialized()}

@app.post("/auth/setup")
def setup_workspace(body: SetupWorkspace):
    if user_store.is_workspace_initialized():
        raise HTTPException(status_code=400, detail="Workspace already initialized")
    if not body.firm_name.strip():
        raise HTTPException(status_code=422, detail="Firm name cannot be empty")
    if len(body.master_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user = user_store.create_workspace(body.admin_name, body.admin_username, body.master_password, body.vertical)
    return {"status": "ok", "admin": user}

@app.get("/auth/profiles")
def get_profiles():
    if not user_store.is_workspace_initialized():
        return {"profiles": []}
    users = user_store.list_users()
    profiles = [
        {
            "id": u["id"],
            "username": u["username"],
            "full_name": u["full_name"],
            "role": u["role"],
            "department": u.get("department", ""),
        }
        for u in users if u["active"]
    ]
    return {"profiles": profiles}

@app.post("/auth/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = user_store.verify_password(form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth_module.create_access_token(user["id"], user["username"], user["role"])
    return {"access_token": token, "token_type": "bearer", "role": user["role"], "full_name": user.get("full_name", "")}

@app.get("/auth/me")
async def me(current_user: dict = Depends(auth_module.get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "full_name": current_user.get("full_name", ""),
        "role": current_user["role"],
    }


# ── Query & Chat ───────────────────────────────────────────────────────────────

@app.post("/query")
@limiter.limit("20/minute")
async def query(
    request: Request,
    req: QueryRequest,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty")

    if len(req.query) > 4000:
        raise HTTPException(status_code=422, detail="Query too long (max 4000 characters)")

    if req.matter_id and not user_store.can_access_matter(current_user, req.matter_id):
        raise HTTPException(status_code=403, detail="You do not have access to this matter")

    if req.force_cloud and not license_client.cloud_enabled():
        raise HTTPException(
            status_code=402,
            detail="Cloud escalation requires an active license. Contact your administrator.",
        )

    try:
        result = agent.answer(
            query=req.query,
            matter_id=req.matter_id,
            force_cloud=req.force_cloud,
            use_heavy=req.use_heavy,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine error: {e}")

    if req.matter_id:
        try:
            with store.get_db_context() as db:
                store.save_chat_message(db, req.matter_id, current_user["id"], "user", req.query)
                store.save_chat_message(db, req.matter_id, current_user["id"], "assistant", result["answer"])
        except Exception:
            pass  # Non-fatal: chat persistence failure should not break the response

    return result


@app.post("/query/stream")
@limiter.limit("20/minute")
async def query_stream(
    request: Request,
    req: QueryRequest,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty")

    if len(req.query) > 4000:
        raise HTTPException(status_code=422, detail="Query too long (max 4000 characters)")

    if req.matter_id and not user_store.can_access_matter(current_user, req.matter_id):
        raise HTTPException(status_code=403, detail="You do not have access to this matter")

    if req.force_cloud and not license_client.cloud_enabled():
        raise HTTPException(
            status_code=402,
            detail="Cloud escalation requires an active license. Contact your administrator.",
        )

    generator = agent.stream_answer(
        query=req.query,
        matter_id=req.matter_id,
        user_id=current_user["id"],
        force_cloud=req.force_cloud,
        use_heavy=req.use_heavy,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/system/hardware")
def get_hardware_info(current_user: dict = Depends(auth_module.get_current_user)):
    prof = hardware.get_profile()
    return {
        "profile": prof.as_dict(),
        "description": hardware.describe(),
        "cache": cache.answer_cache.stats(),
    }


@app.get("/matters/{matter_id}/chat")
def get_chat(
    matter_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")
    with store.get_db_context() as db:
        history = store.get_chat_history(db, matter_id, current_user["id"])
    return {"history": history}


@app.get("/matters/{matter_id}/intelligence")
def get_matter_intelligence(
    matter_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")

    cached = user_store.get_matter_intelligence(matter_id)
    if cached:
        return cached

    try:
        data = agent.extract_intelligence(matter_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract intelligence: {e}")


@app.get("/matters/{matter_id}/executive-brief")
def get_matter_executive_brief(
    matter_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")

    cached = user_store.get_matter_executive_brief(matter_id)
    if cached:
        return cached

    try:
        data = agent.generate_executive_brief(matter_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate executive brief: {e}")


@app.get("/matters/{matter_id}/export")
def export_matter_report(
    matter_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")
    try:
        import exporter
        docx_bytes = exporter.generate_matter_docx(matter_id, current_user)
        matters = user_store.list_user_matters(current_user)
        current_m = next((m for m in matters if m["id"] == matter_id), None)
        title = current_m["title"] if current_m else f"Matter_{matter_id}"
        safe_title = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
        filename = f"{safe_title}_Brief.docx"
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export report: {e}")


def _generate_matter_ics(matter_id: str, matter_title: str) -> str:
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    
    # Check intelligence or timeline
    intel = user_store.get_matter_intelligence(matter_id) or {}
    timeline = intel.get("timeline", [])
    
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ProAssist//Matter Deadlines Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:ProAssist - {matter_title}",
    ]
    
    import re
    date_regex = re.compile(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})')
    
    count = 0
    for item in timeline:
        raw_date = str(item.get("date", "")).strip()
        event_desc = str(item.get("event", "Matter Milestone")).strip()
        m = date_regex.search(raw_date)
        if m:
            yyyy, mm, dd = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
            dt_val = f"{yyyy}{mm}{dd}"
        else:
            dt_val = datetime.now().strftime("%Y%m%d")
            event_desc = f"[{raw_date}] {event_desc}"
            
        uid = f"proassist-{matter_id}-{count}-{dt_val}@local"
        clean_summary = event_desc[:60].replace("\n", " ").replace(",", "\\,")
        clean_desc = event_desc.replace("\n", " ").replace(",", "\\,")
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_str}",
            f"DTSTART;VALUE=DATE:{dt_val}",
            f"SUMMARY:{clean_summary}",
            f"DESCRIPTION:{clean_desc}",
            f"CATEGORIES:LEGAL,DEADLINE,{matter_title}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ])
        count += 1
        
    if count == 0:
        today_val = datetime.now().strftime("%Y%m%d")
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:proassist-{matter_id}-init@local",
            f"DTSTAMP:{now_str}",
            f"DTSTART;VALUE=DATE:{today_val}",
            f"SUMMARY:Matter Initialized - {matter_title}",
            f"DESCRIPTION:Matter dossier {matter_id} active in ProAssist.",
            "END:VEVENT",
        ])
        
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


@app.get("/matters/{matter_id}/calendar.ics")
def get_matter_calendar(
    matter_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")
    matters = user_store.list_user_matters(current_user)
    current_m = next((m for m in matters if m["id"] == matter_id), None)
    title = current_m["title"] if current_m else f"Matter {matter_id}"
    ics_text = _generate_matter_ics(matter_id, title)
    return Response(
        content=ics_text,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="proassist_{matter_id}_deadlines.ics"'}
    )


@app.post("/matters/{matter_id}/compare-docs")
def compare_matter_documents(
    matter_id: str,
    req: DocCompareRequest,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")
    with store.get_db_context() as db:
        chunks1 = store.get_file_chunks(db, matter_id, req.doc1, max_chunks=15)
        chunks2 = store.get_file_chunks(db, matter_id, req.doc2, max_chunks=15)
        
    if not chunks1 and not chunks2:
        raise HTTPException(status_code=404, detail="Neither document was found in this matter.")
    if not chunks1:
        raise HTTPException(status_code=404, detail=f"Document '{req.doc1}' has no indexed chunks.")
    if not chunks2:
        raise HTTPException(status_code=404, detail=f"Document '{req.doc2}' has no indexed chunks.")
        
    text1 = "\n\n".join([f"[{req.doc1} P.{c.get('page','?')}] {c['chunk_text']}" for c in chunks1])[:6000]
    text2 = "\n\n".join([f"[{req.doc2} P.{c.get('page','?')}] {c['chunk_text']}" for c in chunks2])[:6000]
    
    system_prompt = (
        "You are an expert Comparative Document and Redline Specialist. Compare the two document excerpts below. "
        "Highlight newly added clauses, deleted conditions/obligations, modified clauses, and legal/business risk differences.\n"
        "You MUST respond ONLY with a valid JSON object with the following schema:\n"
        "{\n"
        '  "summary": "Brief executive summary of key differences between the documents",\n'
        '  "additions": ["Clauses or terms in Doc 2 that are missing in Doc 1", ...],\n'
        '  "deletions": ["Clauses or terms in Doc 1 that were dropped or removed in Doc 2", ...],\n'
        '  "modifications": [{"clause": "Topic/Clause name", "doc1_version": "Summary of Doc 1 version", "doc2_version": "Summary of Doc 2 version", "risk_impact": "Impact/shift in liability"}],\n'
        '  "risk_assessment": "Overall assessment of which version is more favorable and key red flags"\n'
        "}"
    )
    user_prompt = f"### DOCUMENT 1 ({req.doc1}):\n{text1}\n\n### DOCUMENT 2 ({req.doc2}):\n{text2}\n"
    if req.focus:
        user_prompt += f"\nSpecific comparison focus: {req.focus}\n"
        
    import llm
    try:
        response, backend = llm.generate_with_fallback(system_prompt, user_prompt, prefer_cloud=True)
        data = agent._safe_json_loads(response)
        return {
            "matter_id": matter_id,
            "doc1": req.doc1,
            "doc2": req.doc2,
            "comparison": data,
            "backend": backend,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document comparison failed: {e}")


@app.post("/matters/{matter_id}/web-verify")
def web_verify_endpoint(
    matter_id: str,
    req: WebVerifyRequest,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")
    
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Search query cannot be empty")
        
    res = web_search.search_web(req.query)
    return res


@app.post("/search/global")
def global_search(
    req: GlobalSearchRequest,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty")
    try:
        import retrieve as retriever
        chunks = retriever.retrieve(query=req.query, matter_id=None, doc_type=req.doc_type, top_k=req.limit)
        return {"query": req.query, "doc_type": req.doc_type, "results": chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Global search error: {e}")


# ── OpenWorker Autonomous Coworker Endpoints ──────────────────────────────────

@app.get("/coworkers")
def list_coworkers_endpoint(
    vertical: Optional[str] = None,
    current_user: dict = Depends(auth_module.get_current_user),
):
    """List available built-in and custom Coworkers."""
    if not vertical:
        vertical = user_store.get_workspace_vertical()
    items = coworkers.list_coworkers(vertical=vertical)
    return {"coworkers": items, "workspace_vertical": vertical}


@app.get("/coworkers/{coworker_id}")
def get_coworker_detail(
    coworker_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    """Get single coworker profile."""
    item = coworkers.get_coworker(coworker_id)
    if not item:
        raise HTTPException(status_code=404, detail="Coworker not found")
    return {"coworker": item}


@app.post("/matters/{matter_id}/coworker")
def run_matter_coworker(
    matter_id: str,
    req: CoworkerRunRequest,
    current_user: dict = Depends(auth_module.get_current_user),
):
    """Executes an autonomous Coworker workflow against a matter dossier."""
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")

    try:
        outcome = coworkers.run_coworker(
            coworker_id=req.coworker_id,
            matter_id=matter_id,
            custom_instruction=req.custom_instruction,
            force_cloud=req.force_cloud,
            use_heavy=req.use_heavy,
        )

        # Log formatted summary into matter chat history
        chat_entry = f"### {outcome.get('title', 'Coworker Execution Report')}\n\n{outcome.get('markdown_memo') or outcome.get('summary', '')}"
        try:
            with store.get_db_context() as db:
                store.save_chat_message(db, matter_id, current_user["id"], "assistant", chat_entry)
        except Exception:
            pass

        return outcome
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Coworker execution failed: {e}")


@app.post("/coworkers/custom")
def create_custom_coworker(
    body: CustomCoworkerCreate,
    current_user: dict = Depends(auth_module.get_current_user),
):
    """Create or update a custom Coworker."""
    try:
        cid = body.id or f"custom_{uuid.uuid4().hex[:8]}"
        saved = user_store.save_custom_coworker(
            coworker_id=cid,
            name=body.name,
            role=body.role,
            description=body.description,
            icon=body.icon,
            vertical=body.vertical,
            system_prompt=body.system_prompt,
            default_query=body.default_query,
            user_id=current_user["id"],
        )
        return {"coworker": saved}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save custom coworker: {e}")


@app.delete("/coworkers/custom/{coworker_id}")
def delete_custom_coworker(
    coworker_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    """Delete a custom Coworker."""
    success = user_store.delete_custom_coworker(coworker_id)
    if not success:
        raise HTTPException(status_code=404, detail="Custom coworker not found or cannot be deleted")
    return {"deleted": True, "id": coworker_id}


@app.get("/coworkers/{coworker_id}/export")
def export_coworker_bundle(
    coworker_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    """Export coworker definition as an OpenWorker-compatible portable bundle."""
    try:
        bundle = coworkers.export_bundle(coworker_id)
        return bundle
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/coworkers/import")
def import_coworker_bundle(
    body: CoworkerImportRequest,
    current_user: dict = Depends(auth_module.get_current_user),
):
    """Import a portable Coworker bundle (.bundle.json)."""
    try:
        imported = coworkers.import_bundle(body.bundle, user_id=current_user["id"])
        return {"imported": True, "coworker": imported}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {e}")



# ── Document ingestion ─────────────────────────────────────────────────────────

@app.post("/ingest/file")
async def ingest_file(
    file: UploadFile = File(...),
    matter_id: str = Form(default="default"),
    force: bool = Form(default=False),
    current_user: dict = Depends(auth_module.get_current_user),
):
    if current_user["role"] in ["intern"]:
        raise HTTPException(status_code=403, detail="Interns cannot ingest documents")

    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")

    # Validate filename and extension
    if not file.filename:
        raise HTTPException(status_code=422, detail="No filename provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Write to temp file with size limit enforcement
    suffix = Path(file.filename).suffix
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            total_bytes = 0
            chunk_size = 64 * 1024  # 64KB chunks
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    tmp.close()
                    os.unlink(tmp.name)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_MB} MB.",
                    )
                tmp.write(chunk)
            tmp_path = tmp.name
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to receive file: {e}")

    try:
        result = ingester.ingest_file(tmp_path, matter_id=matter_id, force=force, verbose=False)
        result["source_file"] = file.filename

        # If ingest returned an error, surface it as HTTP 422
        if result.get("error"):
            raise HTTPException(status_code=422, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# ── Matter management ──────────────────────────────────────────────────────────

@app.get("/matters")
def list_matters(current_user: dict = Depends(auth_module.get_current_user)):
    user_matters = user_store.list_user_matters(current_user)
    with store.get_db_context() as db:
        stats = store.list_matters_files_stats(db)
    stats_map = {s["matter_id"]: s for s in stats}
    for m in user_matters:
        m_stat = stats_map.get(m["id"], {"file_count": 0, "chunk_count": 0})
        m["file_count"] = m_stat["file_count"]
        m["chunk_count"] = m_stat["chunk_count"]
    return {"matters": user_matters}

@app.post("/matters")
def create_matter(body: MatterCreate, current_user: dict = Depends(auth_module.get_current_user)):
    if current_user["role"] in ["paralegal", "intern"]:
        raise HTTPException(status_code=403, detail="Not authorized to create matters")
    if not body.title.strip():
        raise HTTPException(status_code=422, detail="Matter title cannot be empty")
    matter_id = str(uuid.uuid4())[:8]
    user_store.create_matter(matter_id, body.title, body.description, current_user["id"], tags=body.tags)
    return {"id": matter_id, "title": body.title, "description": body.description, "tags": body.tags or []}

@app.patch("/matters/{matter_id}/tags")
@app.post("/matters/{matter_id}/tags")
def update_matter_tags_endpoint(
    matter_id: str,
    body: MatterTagsUpdate,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")
    updated = user_store.update_matter_tags(matter_id, body.tags)
    return {"matter_id": matter_id, "tags": updated}

@app.get("/matters/{matter_id}/files")
def list_files(
    matter_id: str,
    current_user: dict = Depends(auth_module.get_current_user),
):
    if not user_store.can_access_matter(current_user, matter_id):
        raise HTTPException(status_code=403, detail="No access to this matter")
    with store.get_db_context() as db:
        files = store.matter_files(db, matter_id)
    return {"matter_id": matter_id, "files": files}

@app.delete("/matters/{matter_id}/files/{filename:path}")
def delete_file(
    matter_id: str,
    filename: str,
    current_user: dict = Depends(auth_module.require_role("admin", "senior_partner", "senior")),
):
    with store.get_db_context() as db:
        removed = store.delete_file(db, matter_id, filename)
    return {"deleted_chunks": removed}


# ── User management (admin only) ───────────────────────────────────────────────

@app.get("/users")
def get_users(
    current_user: dict = Depends(auth_module.require_role("admin", "senior_partner", "senior")),
):
    return {"users": user_store.list_users()}

@app.post("/users")
def create_user(
    body: UserCreate,
    current_user: dict = Depends(auth_module.require_role("admin", "senior_partner", "senior")),
):
    info = license_client.validate()
    existing = len(user_store.list_users())
    seat_limit = info.get("seat_count", 10)
    if existing >= seat_limit:
        raise HTTPException(
            status_code=402,
            detail=f"Seat limit reached ({seat_limit}). Contact your administrator to upgrade.",
        )
    try:
        user = user_store.create_user(
            body.username, body.password, body.full_name,
            body.email, body.phone, body.department, body.role,
        )
        return {"user": user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/matters/{matter_id}/access/{user_id}")
def grant_access(
    matter_id: str,
    user_id: int,
    permission: str = "read",
    current_user: dict = Depends(auth_module.require_role("admin", "senior_partner")),
):
    user_store.grant_matter_access(user_id, matter_id, permission)
    return {"ok": True}


# ── Update check ───────────────────────────────────────────────────────────────

@app.get("/update/available")
def check_update():
    """Check if a newer version is available from the release manifest."""
    import urllib.request
    import json as _json
    MANIFEST_URL = "https://law-assist.com/releases/release.json"
    try:
        with urllib.request.urlopen(MANIFEST_URL, timeout=5) as r:
            manifest = _json.loads(r.read())
        latest = manifest.get("version", "1.0.0")
        current = "1.0.0"
        if latest != current:
            return {"update_available": True, "current": current, "latest": latest, "download_url": "https://law-assist.com/download"}
    except Exception:
        pass
    return {"update_available": False, "current": "1.0.0"}


# ── Serve built React UI ───────────────────────────────────────────────────────
import sys
if getattr(sys, 'frozen', False):
    # PyInstaller bundle: sys.executable is the .exe path (e.g. C:\...\law-assist\engine\law-assist-engine.exe)
    _ui_dist = Path(sys.executable).parent.parent / "ui"
else:
    # Local dev mode
    _ui_dist = Path(__file__).parent.parent / "ui" / "dist"

if _ui_dist.exists():
    app.mount("/", StaticFiles(directory=str(_ui_dist), html=True), name="ui")


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    if not Path(config.LOCAL_MODEL_PATH).exists():
        print("[law-assist] Model not found. Auto-downloading on first launch...")
        try:
            import download_model
            download_model.download("qwen")
        except Exception as e:
            print(f"[law-assist] Auto-download failed: {e}")

    uvicorn.run(
        app,
        host=config.API_HOST,
        port=config.API_PORT,
        reload=False,
        log_level="info",
    )
