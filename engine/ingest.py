"""
Document ingestion: parse → chunk → embed → store.
Supports PDF, DOCX, CSV/XLSX, plain text.

Production hardened:
- Max file size enforcement
- Empty file detection
- Corrupted PDF recovery
- Unsupported format rejection
- Per-file error isolation
"""

import os
import re
import sys
from pathlib import Path
from typing import Optional

import config
import store
from embedder import get_embedder

# ── Constants ────────────────────────────────────────────────────────────────────
MAX_FILE_SIZE_MB = 150
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".csv", ".xlsx", ".xls", ".txt", ".md"}

# ── Validation ──────────────────────────────────────────────────────────────────

def validate_file(file_path: str) -> None:
    """Raise ValueError with a user-friendly message if file is invalid."""
    p = Path(file_path)

    if not p.exists():
        raise ValueError(f"File not found: {p.name}")

    # Empty file check
    size = p.stat().st_size
    if size == 0:
        raise ValueError(f"File is empty (0 bytes): {p.name}")

    # Size limit check
    if size > MAX_FILE_SIZE_BYTES:
        mb = size / (1024 * 1024)
        raise ValueError(
            f"File too large ({mb:.1f} MB). Maximum allowed size is {MAX_FILE_SIZE_MB} MB. "
            f"Split the document into smaller files and re-upload."
        )

    # Extension check
    ext = p.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported formats: "
            + ", ".join(sorted(SUPPORTED_EXTENSIONS))
        )

    # Reject old binary .doc format explicitly
    if ext == ".doc":
        raise ValueError(
            "Legacy .doc format is not supported. Please convert to .docx in Microsoft Word "
            "(File → Save As → Word Document .docx) and re-upload."
        )


# ── Text extraction ─────────────────────────────────────────────────────────────

def extract_pdf(file_path: str) -> list[dict]:
    """Returns list of {page, text} dicts. Handles corrupted PDFs gracefully."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise RuntimeError("PyMuPDF is not installed. Run: pip install pymupdf")

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        raise ValueError(
            f"Could not open PDF file. It may be corrupted, password-protected, or not a valid PDF. "
            f"Technical detail: {e}"
        )

    if doc.is_encrypted:
        doc.close()
        raise ValueError(
            "This PDF is password-protected. Please remove the password in Adobe Acrobat "
            "or Preview (File → Export as PDF with no password) before uploading."
        )

    pages = []
    failed_pages = []
    for i, page in enumerate(doc, start=1):
        try:
            text = str(page.get_text("text")).strip()
            if text and len(text) > 10:  # skip near-empty pages (headers/footers only)
                pages.append({"page": i, "text": text, "section": None})
        except Exception:
            failed_pages.append(i)

    doc.close()

    if failed_pages and not pages:
        raise ValueError(
            f"Could not extract text from any pages in this PDF. "
            f"The document may be image-only (scanned). Please use a PDF with text layer or run OCR first."
        )

    return pages


def extract_docx(file_path: str) -> list[dict]:
    """Extract from DOCX with graceful handling of malformed documents."""
    try:
        from docx import Document
    except ImportError:
        raise RuntimeError("python-docx is not installed. Run: pip install python-docx")

    try:
        doc = Document(file_path)
    except Exception as e:
        raise ValueError(
            f"Could not open DOCX file. It may be corrupted or not a valid Word document. "
            f"Technical detail: {e}"
        )

    pages = []
    current_section = None
    buffer = []
    pseudo_page = 1

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        if para.style and para.style.name and para.style.name.startswith("Heading"):
            if buffer:
                pages.append({"page": pseudo_page, "text": "\n".join(buffer), "section": current_section})
                pseudo_page += 1
                buffer = []
            current_section = text
        else:
            buffer.append(text)
            if len(" ".join(buffer).split()) >= 600:
                pages.append({"page": pseudo_page, "text": "\n".join(buffer), "section": current_section})
                pseudo_page += 1
                buffer = []

    if buffer:
        pages.append({"page": pseudo_page, "text": "\n".join(buffer), "section": current_section})

    if not pages:
        raise ValueError("No readable text found in this DOCX file. The document may be empty or contain only images.")

    return pages


def extract_csv(file_path: str) -> list[dict]:
    """Extract from CSV/XLSX with graceful error handling."""
    try:
        import pandas as pd
    except ImportError:
        raise RuntimeError("pandas is not installed. Run: pip install pandas openpyxl")

    ext = Path(file_path).suffix.lower()
    try:
        if ext in (".xlsx", ".xls"):
            df = pd.read_excel(file_path)
        else:
            # Try common encodings
            for enc in ("utf-8", "latin-1", "cp1252"):
                try:
                    df = pd.read_csv(file_path, encoding=enc)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                df = pd.read_csv(file_path, encoding="utf-8", encoding_errors="replace")
    except Exception as e:
        raise ValueError(f"Could not read spreadsheet file: {e}")

    if df.empty:
        raise ValueError("Spreadsheet is empty — no rows found.")

    df = df.fillna("")
    pages = []
    chunk_size = 20
    for i in range(0, len(df), chunk_size):
        batch = df.iloc[i: i + chunk_size]
        text = batch.to_string(index=False)
        pages.append({"page": i // chunk_size + 1, "text": text, "section": None})

    return pages


def extract_text(file_path: str) -> list[dict]:
    """Extract from plain text files, trying multiple encodings."""
    content = None
    for enc in ("utf-8", "latin-1", "cp1252", "utf-16"):
        try:
            with open(file_path, "r", encoding=enc) as f:
                content = f.read()
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if content is None:
        # Last resort: read as binary and replace errors
        with open(file_path, "rb") as f:
            content = f.read().decode("utf-8", errors="replace")

    content = content.strip()
    if not content:
        raise ValueError("Text file is empty or contains only whitespace.")

    words = content.split()
    pages = []
    chunk_words = 600
    for i in range(0, len(words), chunk_words):
        pages.append({
            "page": i // chunk_words + 1,
            "text": " ".join(words[i: i + chunk_words]),
            "section": None,
        })

    return pages


def extract(file_path: str) -> list[dict]:
    """Dispatch to the correct extractor based on file extension."""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return extract_pdf(file_path)
    elif ext in (".docx",):
        return extract_docx(file_path)
    elif ext in (".csv", ".xlsx", ".xls"):
        return extract_csv(file_path)
    elif ext in (".txt", ".md"):
        return extract_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


# ── Chunking ────────────────────────────────────────────────────────────────────

def chunk_text(text: str, size: Optional[int] = None, overlap: Optional[int] = None) -> list[str]:
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
    matter_id: str = "default",
    force: bool = False,
    verbose: bool = True,
) -> dict:
    """
    Ingest a single file into the vector store.
    Returns { source_file, matter_id, chunks_added, skipped, error }.
    Never raises — errors are returned in the result dict.
    """
    source_file = os.path.basename(file_path)
    db = store.get_db()

    try:
        # Validate before doing any work
        validate_file(file_path)

        if not force and store.file_already_ingested(db, matter_id, source_file):
            if verbose:
                print(f"  [skip] {source_file} already in {matter_id}")
            return {"source_file": source_file, "matter_id": matter_id, "chunks_added": 0, "skipped": True}

        if verbose:
            print(f"  [read] {source_file}")

        pages = extract(file_path)
        if not pages:
            return {"source_file": source_file, "matter_id": matter_id, "chunks_added": 0, "skipped": False}

        # Detect doc type from first page sample
        sample_text = pages[0]["text"][:500]
        doc_type = detect_doc_type(file_path, sample_text)

        embedder = get_embedder()
        chunks_to_insert = []

        for page_data in pages:
            text = page_data["text"]
            page_num = page_data["page"]
            section = page_data["section"]

            sub_chunks = chunk_text(text)
            for chunk in sub_chunks:
                chunk = chunk.strip()
                if len(chunk.split()) < 15:  # skip tiny fragments
                    continue
                chunks_to_insert.append((chunk, page_num, section))

        if chunks_to_insert:
            texts = [c[0] for c in chunks_to_insert]
            embeddings = embedder.encode_batch(texts, is_query=False)
            batch_rows = [
                (chunk, emb, page_num, section)
                for (chunk, page_num, section), emb in zip(chunks_to_insert, embeddings)
            ]
            chunks_added = store.insert_chunks_batch(
                db=db,
                matter_id=matter_id,
                source_file=source_file,
                rows=batch_rows,
                doc_type=doc_type,
            )
        else:
            chunks_added = 0

        if verbose:
            print(f"  [done] {source_file} -> {chunks_added} chunks (type: {doc_type})")

        return {"source_file": source_file, "matter_id": matter_id, "chunks_added": chunks_added, "skipped": False}

    except ValueError as e:
        # User-facing errors (bad file, wrong format, etc.)
        if verbose:
            print(f"  [error] {source_file}: {e}")
        return {"source_file": source_file, "matter_id": matter_id, "chunks_added": 0, "skipped": False, "error": str(e)}

    except Exception as e:
        # Unexpected system errors
        if verbose:
            print(f"  [fatal] {source_file}: {e}")
        return {
            "source_file": source_file,
            "matter_id": matter_id,
            "chunks_added": 0,
            "skipped": False,
            "error": f"Unexpected error during ingestion: {str(e)}",
        }
    finally:
        db.close()


def ingest_folder(
    folder_path: str,
    matter_id: str = "default",
    force: bool = False,
    verbose: bool = True,
) -> list[dict]:
    """Ingest all supported files in a directory."""
    results = []
    folder = Path(folder_path)

    files = [f for f in sorted(folder.rglob("*")) if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS]
    if verbose:
        print(f"Found {len(files)} supported files in {folder_path}")

    for f in files:
        result = ingest_file(str(f), matter_id=matter_id, force=force, verbose=verbose)
        results.append(result)

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
        results = ingest_folder(str(p), matter_id=args.folder, force=args.force)
        total = sum(r.get("chunks_added", 0) for r in results)
        errors = [r for r in results if r.get("error")]
        print(f"\nIngested {len(results)} files -> {total} total chunks into folder '{args.folder}'")
        if errors:
            print(f"Errors ({len(errors)}):")
            for e in errors:
                print(f"  - {e['source_file']}: {e['error']}")
    elif p.is_file():
        result = ingest_file(str(p), matter_id=args.folder, force=args.force)
        print(f"\nDone: {result}")
    else:
        print(f"Path not found: {args.path}")
        sys.exit(1)
