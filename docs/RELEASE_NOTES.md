# law-assist v1.0.0 — Release Notes

**Released:** 17 June 2026  
**Platform:** Windows 10 / 11 (64-bit)  
**Engine:** local LLM (Qwen-1.5B) · Sarvam 30B/105B (optional) · Anthropic Claude (optional)

---

## What's New in v1.0.0

This is the **initial public release** of law-assist — a private, offline-first legal intelligence platform for Indian law firms.

### Core Features

#### 🧠 Private AI Engine
- 100% offline inference using local Qwen GGUF model via llama.cpp
- Optional escalation to Sarvam AI (sarvam-30b / sarvam-105b) for complex multi-document synthesis
- BGE-M3 embedding model (1024-dimensional) for high-accuracy semantic search
- Hybrid retrieval: vector search + keyword BM25-style fallback

#### 📚 Notebook Workspace
- NotebookLM-inspired 3-panel layout: Sources · Chat · Intelligence
- Create unlimited notebooks for any matter or case
- Drag-and-drop document upload with per-file progress tracking

#### 📄 Document Support
- PDF (with corrupted file recovery, password protection detection)
- DOCX / Word documents
- TXT, Markdown, CSV, XLSX / Excel
- Files up to 150 MB per upload
- Automatic legal document type detection (FIR, judgment, contract, affidavit, plaint, charge sheet, etc.)

#### 🔍 Automated Intelligence Extraction
The "Notebook Guide" sidebar auto-extracts from your documents:
- **Timeline of Events** — Chronological reconstruction with source citations
- **Key People & Organizations** — Parties, witnesses, judges, advocates
- **Contradictions & Discrepancies** — Cross-document inconsistency detection
- **Missing Evidence** — Gaps in the documentary record

#### 👥 Multi-User Architecture
- Netflix-style profile selection on login
- 5 user roles: Admin, Senior Partner, Associate, Paralegal, Intern
- Per-matter access control with read/write/admin permissions
- Secure JWT sessions (8-hour expiry)
- Admin panel for user and seat management

#### 🔒 Security
- JWT secret auto-generation on first launch
- CORS restricted to localhost origins only
- Rate limiting on /query endpoint (20 req/min)
- Server-side MIME type validation on file uploads
- SQLite WAL mode for concurrent multi-user access

---

## Known Limitations in v1.0.0

- Scanned PDFs (image-only, no text layer) are not supported — OCR is planned for v1.1.0
- Legacy `.doc` format (binary Word 97-2003) is not supported — use `.docx`
- Auto-update download is manual (click link to download page) — silent auto-update planned for v1.1.0
- Maximum 5 user seats in default licence

---

## Planned for v1.1.0

- OCR support for scanned PDFs (Tesseract integration)
- Silent background auto-update
- Matter sharing and export
- WhatsApp/Email document import
- Tamil, Hindi, Marathi document language support improvement
- Mobile browser access mode improvements

---

## Upgrade from Beta

If you participated in the beta, simply install v1.0.0 over your existing installation. Your `memory.db` is backward compatible.

---

## Security Disclosure

Found a security issue? Email **security@law-assist.com** privately. Please do not open public issues for security vulnerabilities.
