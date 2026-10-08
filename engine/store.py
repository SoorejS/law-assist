"""
sqlite-vec wrapper — vector store + metadata store in a single DB file.
One DB file per installation. Namespaced by folder/matter ID.

Production hardened:
- WAL mode for concurrent read safety
- busy_timeout to handle concurrent write contention
- Context manager for proper connection lifecycle
- check_same_thread=False for multi-threaded FastAPI

Performance (low-spec & older PC optimizations):
- Schema DDL executed once per process, not on every connection
- SQLite cache and mmap dynamically sized to the machine's RAM tier
- FTS5 BM25 inverted index replaces O(N) full-table LIKE scans
- Batched ingestion writes in a single transaction
"""

import re
import sqlite3
import struct
import json
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

import sqlite_vec
import config
import hardware

_SCHEMA_VERSION = 2
_schema_ready_for: Optional[str] = None
_schema_lock = threading.Lock()
_fts_available = True


def _pack(vector: list[float]) -> bytes:
    return struct.pack(f"{len(vector)}f", *vector)


def get_db() -> sqlite3.Connection:
    """Open and return a configured SQLite connection. Caller must close it."""
    global _schema_ready_for
    Path(config.VECTOR_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(config.VECTOR_DB_PATH, check_same_thread=False)
    db.enable_load_extension(True)
    sqlite_vec.load(db)
    db.enable_load_extension(False)
    db.row_factory = sqlite3.Row
    prof = hardware.get_profile()
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=5000")   # wait up to 5s on locked DB
    db.execute("PRAGMA synchronous=NORMAL")  # safe, fast disk writes
    db.execute(f"PRAGMA cache_size=-{prof.sqlite_cache_kb}")
    db.execute(f"PRAGMA mmap_size={prof.sqlite_mmap_bytes}")
    db.execute("PRAGMA temp_store=MEMORY")
    if _schema_ready_for != config.VECTOR_DB_PATH:
        with _schema_lock:
            if _schema_ready_for != config.VECTOR_DB_PATH:
                _init_schema(db)
                _schema_ready_for = config.VECTOR_DB_PATH
    return db


@contextmanager
def get_db_context():
    """Context manager that opens a DB connection and guarantees it is closed."""
    db = get_db()
    try:
        yield db
    finally:
        db.close()


def _init_schema(db: sqlite3.Connection) -> None:
    db.executescript(f"""
        CREATE TABLE IF NOT EXISTS chunks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            matter_id   TEXT    NOT NULL DEFAULT 'default',
            source_file TEXT    NOT NULL,
            page        INTEGER,
            section     TEXT,
            chunk_text  TEXT    NOT NULL,
            doc_type    TEXT,
            metadata    TEXT    DEFAULT '{{}}',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors USING vec0(
            chunk_id  INTEGER PRIMARY KEY,
            embedding FLOAT[{config.EMBEDDING_DIM}]
        );

        CREATE TABLE IF NOT EXISTS chat_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            matter_id   TEXT NOT NULL,
            user_id     INTEGER NOT NULL,
            role        TEXT NOT NULL,
            content     TEXT NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_matter   ON chunks(matter_id);
        CREATE INDEX IF NOT EXISTS idx_source   ON chunks(source_file);
        CREATE INDEX IF NOT EXISTS idx_matter_source ON chunks(matter_id, source_file);
        CREATE INDEX IF NOT EXISTS idx_chat ON chat_history(matter_id, user_id);
    """)
    db.commit()
    _init_fts(db)


def _init_fts(db: sqlite3.Connection) -> None:
    """FTS5 BM25 index over chunk_text, kept in sync by triggers."""
    global _fts_available
    try:
        db.executescript("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                chunk_text,
                content='chunks',
                content_rowid='id',
                tokenize='porter unicode61'
            );
            CREATE TRIGGER IF NOT EXISTS chunks_fts_ai AFTER INSERT ON chunks BEGIN
                INSERT INTO chunks_fts(rowid, chunk_text) VALUES (new.id, new.chunk_text);
            END;
            CREATE TRIGGER IF NOT EXISTS chunks_fts_ad AFTER DELETE ON chunks BEGIN
                INSERT INTO chunks_fts(chunks_fts, rowid, chunk_text) VALUES ('delete', old.id, old.chunk_text);
            END;
            CREATE TRIGGER IF NOT EXISTS chunks_fts_au AFTER UPDATE OF chunk_text ON chunks BEGIN
                INSERT INTO chunks_fts(chunks_fts, rowid, chunk_text) VALUES ('delete', old.id, old.chunk_text);
                INSERT INTO chunks_fts(rowid, chunk_text) VALUES (new.id, new.chunk_text);
            END;
        """)
        version = db.execute("PRAGMA user_version").fetchone()[0]
        if version < _SCHEMA_VERSION:
            db.execute("INSERT INTO chunks_fts(chunks_fts) VALUES ('rebuild')")
            db.execute(f"PRAGMA user_version={_SCHEMA_VERSION}")
        db.commit()
        _fts_available = True
    except sqlite3.OperationalError as e:
        print(f"[store] FTS5 unavailable, using LIKE fallback: {e}")
        _fts_available = False


def insert_chunk(
    db: sqlite3.Connection,
    matter_id: str,
    source_file: str,
    chunk_text: str,
    embedding: list[float],
    page: Optional[int] = None,
    section: Optional[str] = None,
    doc_type: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> int:
    cur = db.execute(
        """INSERT INTO chunks (matter_id, source_file, page, section, chunk_text, doc_type, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (matter_id, source_file, page, section, chunk_text, doc_type, json.dumps(metadata or {})),
    )
    chunk_id = cur.lastrowid
    db.execute(
        "INSERT INTO chunk_vectors (chunk_id, embedding) VALUES (?, ?)",
        (chunk_id, _pack(embedding)),
    )
    db.commit()
    return int(chunk_id or 0)


def insert_chunks_batch(
    db: sqlite3.Connection,
    matter_id: str,
    source_file: str,
    rows: list[tuple[str, list[float], Optional[int], Optional[str]]],
    doc_type: Optional[str] = None,
) -> int:
    """
    Insert many (chunk_text, embedding, page, section) rows in ONE transaction.
    Avoids per-row fsync latency on mechanical HDDs and SATA SSDs.
    """
    if not rows:
        return 0
    with db:
        for chunk_text, embedding, page, section in rows:
            cur = db.execute(
                """INSERT INTO chunks (matter_id, source_file, page, section, chunk_text, doc_type, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, '{}')""",
                (matter_id, source_file, page, section, chunk_text, doc_type),
            )
            db.execute(
                "INSERT INTO chunk_vectors (chunk_id, embedding) VALUES (?, ?)",
                (cur.lastrowid, _pack(embedding)),
            )
    return len(rows)


def vector_search(
    db: sqlite3.Connection,
    query_embedding: list[float],
    top_k: Optional[int] = None,
    matter_id: Optional[str] = None,
    doc_type: Optional[str] = None,
) -> list[dict]:
    top_k = top_k or config.TOP_K
    fetch_k = max(top_k * 25, 250) if (matter_id or doc_type) else top_k

    rows = db.execute(
        """
        SELECT chunk_id, distance
        FROM chunk_vectors
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
        """,
        (_pack(query_embedding), fetch_k),
    ).fetchall()

    if not rows:
        return []

    chunk_ids = [r["chunk_id"] for r in rows]
    distances = {r["chunk_id"]: r["distance"] for r in rows}

    placeholders = ",".join("?" * len(chunk_ids))
    sql = f"SELECT * FROM chunks WHERE id IN ({placeholders})"
    params: list = list(chunk_ids)

    if matter_id:
        sql += " AND matter_id = ?"
        params.append(matter_id)

    if doc_type:
        sql += " AND doc_type = ?"
        params.append(doc_type)

    chunks = db.execute(sql, params).fetchall()

    results = []
    for c in chunks:
        dist = distances.get(c["id"], 9.0)
        if dist <= config.SIMILARITY_THRESHOLD:
            results.append(_row_to_dict(c, dist))

    return sorted(results, key=lambda x: x["distance"])[:top_k]


_STOPWORDS = frozenset("""
a an and are as at be been by can could did do does for from had has have how i if in into is it
its me my no not of on or our please shall should so tell than that the their them then there these
they this those to under up was we were what when where which who whom why will with would you your
about any all also give list show find explain describe me us
""".split())


def _query_terms(query: str) -> list[str]:
    """
    Content terms for search. Preserves short legal tokens (FIR, BNS, CPC, IPC, 302, 138)
    while removing noisy conversational filler.
    """
    seen, terms = set(), []
    for tok in re.findall(r"\w+", query.lower()):
        if len(tok) < 2 or tok in _STOPWORDS or tok in seen:
            continue
        seen.add(tok)
        terms.append(tok)
    return terms[:24]


def keyword_search(
    db: sqlite3.Connection,
    query: str,
    top_k: Optional[int] = None,
    matter_id: Optional[str] = None,
    doc_type: Optional[str] = None,
) -> list[dict]:
    top_k = top_k or config.KEYWORD_TOP_K
    terms = _query_terms(query)
    if not terms:
        return []

    if _fts_available:
        try:
            return _fts_search(db, terms, top_k, matter_id, doc_type)
        except sqlite3.OperationalError:
            pass  # Fallback to LIKE if FTS table has issues

    terms = [t for t in terms if len(t) > 2] or terms

    like_clauses = " OR ".join(["LOWER(chunk_text) LIKE ?" for _ in terms])
    params: list = [f"%{t}%" for t in terms]

    sql = f"SELECT * FROM chunks WHERE ({like_clauses})"
    if matter_id:
        sql += " AND matter_id = ?"
        params.append(matter_id)
    if doc_type:
        sql += " AND doc_type = ?"
        params.append(doc_type)
    sql += f" LIMIT {top_k * 2}"

    rows = db.execute(sql, params).fetchall()

    scored = []
    for r in rows:
        text_lower = r["chunk_text"].lower()
        score = sum(1 for t in terms if t in text_lower)
        scored.append((score, r))
    scored.sort(key=lambda x: -x[0])

    return [_row_to_dict(r, 0.5) for _, r in scored[:top_k]]


def _fts_search(
    db: sqlite3.Connection,
    terms: list[str],
    top_k: int,
    matter_id: Optional[str],
    doc_type: Optional[str],
) -> list[dict]:
    """BM25-ranked search via the FTS5 inverted index (sub-2ms vs full-table scan)."""
    match = " OR ".join(f'"{t}"' for t in terms)
    sql = (
        "SELECT c.*, bm25(chunks_fts) AS score "
        "FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid "
        "WHERE chunks_fts MATCH ?"
    )
    params: list = [match]
    if matter_id:
        sql += " AND c.matter_id = ?"
        params.append(matter_id)
    if doc_type:
        sql += " AND c.doc_type = ?"
        params.append(doc_type)
    sql += " ORDER BY score LIMIT ?"
    params.append(top_k)
    rows = db.execute(sql, params).fetchall()
    return [_row_to_dict(r, 0.5) for r in rows]


def leading_chunks(
    db: sqlite3.Connection,
    matter_id: str,
    limit: int,
    exclude_ids: Optional[set] = None,
) -> list[dict]:
    """
    Opening pages of each document in a matter — grounds broad queries
    ('summarize this matter') that share no specific keywords with document text.
    """
    exclude_ids = exclude_ids or set()
    rows = db.execute(
        """SELECT * FROM chunks WHERE matter_id = ?
           ORDER BY COALESCE(page, 0) ASC, id ASC LIMIT ?""",
        (matter_id, limit + len(exclude_ids)),
    ).fetchall()
    out = [_row_to_dict(r, 0.9) for r in rows if r["id"] not in exclude_ids]
    return out[:limit]


def list_matters_files_stats(db: sqlite3.Connection) -> list[dict]:
    rows = db.execute(
        """SELECT matter_id,
                  COUNT(DISTINCT source_file) as file_count,
                  COUNT(*) as chunk_count,
                  MAX(created_at) as last_updated
           FROM chunks
           GROUP BY matter_id
           ORDER BY matter_id"""
    ).fetchall()
    return [dict(r) for r in rows]


def matter_files(db: sqlite3.Connection, matter_id: str) -> list[dict]:
    rows = db.execute(
        """SELECT source_file, doc_type, COUNT(*) as chunks, MAX(created_at) as added_at
           FROM chunks WHERE matter_id = ?
           GROUP BY source_file, doc_type
           ORDER BY source_file""",
        (matter_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def file_already_ingested(db: sqlite3.Connection, matter_id: str, source_file: str) -> bool:
    row = db.execute(
        "SELECT 1 FROM chunks WHERE matter_id = ? AND source_file = ? LIMIT 1",
        (matter_id, source_file),
    ).fetchone()
    return row is not None


def delete_file(db: sqlite3.Connection, matter_id: str, source_file: str) -> int:
    ids = db.execute(
        "SELECT id FROM chunks WHERE matter_id = ? AND source_file = ?",
        (matter_id, source_file),
    ).fetchall()
    chunk_ids = [r["id"] for r in ids]
    if not chunk_ids:
        return 0
    placeholders = ",".join("?" * len(chunk_ids))
    db.execute(f"DELETE FROM chunk_vectors WHERE chunk_id IN ({placeholders})", chunk_ids)
    db.execute(
        "DELETE FROM chunks WHERE matter_id = ? AND source_file = ?",
        (matter_id, source_file),
    )
    db.commit()
    return len(chunk_ids)


def _row_to_dict(row: sqlite3.Row, distance: float) -> dict:
    return {
        "id": row["id"],
        "matter_id": row["matter_id"],
        "source_file": row["source_file"],
        "page": row["page"],
        "section": row["section"],
        "chunk_text": row["chunk_text"],
        "doc_type": row["doc_type"],
        "metadata": json.loads(row["metadata"] or "{}"),
        "distance": distance,
    }


def save_chat_message(db: sqlite3.Connection, matter_id: str, user_id: int, role: str, content: str) -> None:
    db.execute(
        "INSERT INTO chat_history (matter_id, user_id, role, content) VALUES (?,?,?,?)",
        (matter_id, user_id, role, content)
    )
    db.commit()


def get_chat_history(db: sqlite3.Connection, matter_id: str, user_id: int) -> list[dict]:
    rows = db.execute(
        "SELECT role, content, created_at FROM chat_history WHERE matter_id=? AND user_id=? ORDER BY id ASC",
        (matter_id, user_id)
    ).fetchall()
    return [dict(r) for r in rows]


def get_file_chunks(db: sqlite3.Connection, matter_id: str, source_file: str, max_chunks: int = 25) -> list[dict]:
    rows = db.execute(
        """SELECT * FROM chunks WHERE matter_id = ? AND source_file = ?
           ORDER BY page ASC, id ASC LIMIT ?""",
        (matter_id, source_file, max_chunks),
    ).fetchall()
    return [_row_to_dict(r, 0.0) for r in rows]

