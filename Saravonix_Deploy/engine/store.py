"""
sqlite-vec wrapper — vector store + metadata store in a single DB file.
One DB file per installation. Namespaced by folder/matter ID.

Production hardened:
- WAL mode for concurrent read safety
- busy_timeout to handle concurrent write contention
- Context manager for proper connection lifecycle
- check_same_thread=False for multi-threaded FastAPI
"""

import sqlite3
import struct
import json
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

import sqlite_vec
import config


def _pack(vector: list[float]) -> bytes:
    return struct.pack(f"{len(vector)}f", *vector)


def get_db() -> sqlite3.Connection:
    """Open and return a configured SQLite connection. Caller must close it."""
    Path(config.VECTOR_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(config.VECTOR_DB_PATH, check_same_thread=False)
    db.enable_load_extension(True)
    sqlite_vec.load(db)
    db.enable_load_extension(False)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=5000")   # wait up to 5s on locked DB
    db.execute("PRAGMA synchronous=NORMAL")  # safer than FULL, faster than default
    db.execute("PRAGMA cache_size=-64000")   # 64MB page cache
    _init_schema(db)
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
    return chunk_id


def vector_search(
    db: sqlite3.Connection,
    query_embedding: list[float],
    top_k: int = None,
    matter_id: Optional[str] = None,
) -> list[dict]:
    top_k = top_k or config.TOP_K
    fetch_k = top_k * 4 if matter_id else top_k

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

    chunks = db.execute(sql, params).fetchall()

    results = []
    for c in chunks:
        dist = distances.get(c["id"], 9.0)
        if dist <= config.SIMILARITY_THRESHOLD:
            results.append(_row_to_dict(c, dist))

    return sorted(results, key=lambda x: x["distance"])[:top_k]


def keyword_search(
    db: sqlite3.Connection,
    query: str,
    top_k: int = None,
    matter_id: Optional[str] = None,
) -> list[dict]:
    top_k = top_k or config.KEYWORD_TOP_K
    terms = [t for t in query.lower().split() if len(t) > 3]
    if not terms:
        return []

    like_clauses = " OR ".join(["LOWER(chunk_text) LIKE ?" for _ in terms])
    params: list = [f"%{t}%" for t in terms]

    sql = f"SELECT * FROM chunks WHERE ({like_clauses})"
    if matter_id:
        sql += " AND matter_id = ?"
        params.append(matter_id)
    sql += f" LIMIT {top_k * 2}"

    rows = db.execute(sql, params).fetchall()

    scored = []
    for r in rows:
        text_lower = r["chunk_text"].lower()
        score = sum(1 for t in terms if t in text_lower)
        scored.append((score, r))
    scored.sort(key=lambda x: -x[0])

    return [_row_to_dict(r, 0.5) for _, r in scored[:top_k]]


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
