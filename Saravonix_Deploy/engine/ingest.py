"""
Document ingestion: parse → chunk → embed → store.
Supports PDF, DOCX, CSV/XLSX, plain text.
"""

import os
import re
import sys
from pathlib import Path
from typing import Optional

import config
import store
from embedder import get_embedder

# ── Text extraction ─────────────────────────────────────────────────────────────

def extract_pdf(file_path: str) -> list[dict]:
    """Returns list of {page, text} dicts."""
    import fitz  # PyMuPDF
    doc = fitz.open(file_path)
    pages = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text("text").strip()
        if text:
            pages.append({"page": i, "text": text, "section": None})
    doc.close()
    return pages


def extract_docx(file_path: str) -> list[dict]:
    from docx import Document
    doc = Document(file_path)
    pages = []
    current_section = None
    buffer = []
    pseudo_page = 1

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        # Detect headings as section markers
        if para.style.name.startswith("Heading"):
            if buffer:
                pages.append({"page": pseudo_page, "text": "\n".join(buffer), "section": current_section})
                pseudo_page += 1
                buffer = []
            current_section = text
        else:
            buffer.append(text)
            # Approximate page break every ~600 words
            if len(" ".join(buffer).split()) >= 600:
                pages.append({"page": pseudo_page, "text": "\n".join(buffer), "section": current_section})
                pseudo_page += 1
                buffer = []

    if buffer:
        pages.append({"page": pseudo_page, "text": "\n".join(buffer), "section": current_section})
    return pages


def extract_csv(file_path: str) -> list[dict]:
    import pandas as pd
    ext = Path(file_path).suffix.lower()
    df = pd.read_excel(file_path) if ext in (".xlsx", ".xls") else pd.read_csv(file_path)
    df = df.fillna("")
    pages = []
    # Group every 20 rows into one "page" chunk
    chunk_size = 20
    for i in range(0, len(df), chunk_size):
        batch = df.iloc[i : i + chunk_size]
        text = batch.to_string(index=False)
        pages.append({"page": i // chunk_size + 1, "text": text, "section": None})
    return pages


def extract_text(file_path: str) -> list[dict]:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    words = text.split()
    pages = []
    chunk_words = 600
    for i in range(0, len(words), chunk_words):
        pages.append({"page": i // chunk_words + 1, "text": " ".join(words[i : i + chunk_words]), "section": None})
    return pages


def extract(file_path: str) -> list[dict]:
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return extract_pdf(file_path)
    elif ext in (".docx", ".doc"):
        return extract_docx(file_path)
    elif ext in (".csv", ".xlsx", ".xls"):
        return extract_csv(file_path)
    elif ext in (".txt", ".md"):
        return extract_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


# ── Chunking ────────────────────────────────────────────────────────────────────

def chunk_text(text: str, size: int = None, overlap: int = None) -> list[str]:
    size = size or config.CHUNK_SIZE_WORDS
    overlap = overlap or config.CHUNK_OVERLAP_WORDS
    words = text.split()
    if len(words) <= size:
        return [text]
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end >= len(words):
            break
        start = end - overlap
    return chunks


def detect_doc_type(file_path: str, text_sample: str) -> Optional[str]:
    """Heuristic doc type detection from filename + content."""
    name = Path(file_path).stem.lower()
    sample = text_sample.lower()

    patterns = {
        "FIR": ["first information report", "fir no", "police station"],
        "court_order": ["order of the court", "the court directs", "it is hereby ordered"],
        "judgment": ["judgment", "verdict", "in the matter of", "the honourable"],
        "contract": ["this agreement", "terms and conditions", "parties agree", "consideration"],
        "legal_notice": ["legal notice", "take notice", "within 15 days", "within 30 days"],
        "affidavit": ["i hereby solemnly affirm", "sworn before", "deponent"],
        "plaint": ["plaintiff", "plaint", "suit for"],
        "balance_sheet": ["balance sheet", "assets", "liabilities", "equity"],
        "audit_report": ["audit report", "auditor", "in our opinion"],
        "tax_filing": ["income tax", "assessment year", "total income"],
    }

    for doc_type, keywords in patterns.items():
        if any(kw in name or kw in sample for kw in keywords):
            return doc_type
    return "miscellaneous"


# ── Main ingest function ────────────────────────────────────────────────────────

def ingest_file(
    file_path: str,
    folder_id: str = "default",
    force: bool = False,
    verbose: bool = True,
) -> dict:
    """
    Ingest a single file into the vector store.
    Returns { source_file, folder_id, chunks_added, skipped }.
    """
    db = store.get_db()
    source_file = os.path.basename(file_path)

    if not force and store.file_already_ingested(db, folder_id, source_file):
        if verbose:
            print(f"  [skip] {source_file} already in {folder_id}")
        return {"source_file": source_file, "folder_id": folder_id, "chunks_added": 0, "skipped": True}

    if verbose:
        print(f"  [read] {source_file}")

    pages = extract(file_path)
    if not pages:
        return {"source_file": source_file, "folder_id": folder_id, "chunks_added": 0, "skipped": False}

    # Detect doc type from first page sample
    sample_text = pages[0]["text"][:500]
    doc_type = detect_doc_type(file_path, sample_text)

    embedder = get_embedder()
    chunks_added = 0

    for page_data in pages:
        text = page_data["text"]
        page_num = page_data["page"]
        section = page_data["section"]

        sub_chunks = chunk_text(text)
        for chunk in sub_chunks:
            chunk = chunk.strip()
            if len(chunk.split()) < 15:  # skip tiny fragments
                continue
            embedding = embedder.encode_document(chunk)
            store.insert_chunk(
                db=db,
                folder_id=folder_id,
                source_file=source_file,
                chunk_text=chunk,
                embedding=embedding,
                page=page_num,
                section=section,
                doc_type=doc_type,
            )
            chunks_added += 1

    if verbose:
        print(f"  [done] {source_file} → {chunks_added} chunks (type: {doc_type})")

    return {"source_file": source_file, "folder_id": folder_id, "chunks_added": chunks_added, "skipped": False}


def ingest_folder(
    folder_path: str,
    folder_id: str = "default",
    force: bool = False,
    verbose: bool = True,
) -> list[dict]:
    """Ingest all supported files in a directory."""
    supported = {".pdf", ".docx", ".doc", ".csv", ".xlsx", ".xls", ".txt", ".md"}
    results = []
    folder = Path(folder_path)

    files = [f for f in sorted(folder.rglob("*")) if f.is_file() and f.suffix.lower() in supported]
    if verbose:
        print(f"Found {len(files)} files in {folder_path}")

    for f in files:
        try:
            result = ingest_file(str(f), folder_id=folder_id, force=force, verbose=verbose)
            results.append(result)
        except Exception as e:
            if verbose:
                print(f"  [error] {f.name}: {e}")
            results.append({"source_file": f.name, "folder_id": folder_id, "chunks_added": 0, "error": str(e)})

    return results


# ── CLI ─────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Ingest documents into the local memory engine")
    parser.add_argument("path", help="File or folder to ingest")
    parser.add_argument("--folder", default="default", help="Folder/matter ID (default: 'default')")
    parser.add_argument("--force", action="store_true", help="Re-ingest even if already stored")
    args = parser.parse_args()

    p = Path(args.path)
    if p.is_dir():
        results = ingest_folder(str(p), folder_id=args.folder, force=args.force)
        total = sum(r.get("chunks_added", 0) for r in results)
        print(f"\nIngested {len(results)} files → {total} total chunks into folder '{args.folder}'")
    elif p.is_file():
        result = ingest_file(str(p), folder_id=args.folder, force=args.force)
        print(f"\nDone: {result}")
    else:
        print(f"Path not found: {args.path}")
        sys.exit(1)
