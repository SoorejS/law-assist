"""
User management — SQLite-backed, bcrypt passwords.
Supports roles: admin | senior | associate | paralegal
"""

from __future__ import annotations
import sqlite3
import json
from datetime import datetime
from typing import Optional
from pathlib import Path

import config

DB_PATH = str(Path(config.DATA_DIR) / "users.db")

ROLES = ["admin", "senior", "associate", "paralegal"]


def get_db() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    _init_schema(db)
    return db


def _init_schema(db: sqlite3.Connection) -> None:
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT NOT NULL UNIQUE,
            email       TEXT,
            phone       TEXT,
            full_name   TEXT,
            department  TEXT,
            role        TEXT NOT NULL DEFAULT 'associate',
            password_hash TEXT NOT NULL,
            active      INTEGER NOT NULL DEFAULT 1,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS matters (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            description TEXT,
            created_by  INTEGER NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS matter_members (
            matter_id   TEXT NOT NULL,
            user_id     INTEGER NOT NULL,
            permission_level TEXT NOT NULL DEFAULT 'read',
            PRIMARY KEY (matter_id, user_id),
            FOREIGN KEY (matter_id) REFERENCES matters(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    db.commit()
    
    # Upgrade schema: add intelligence column safely
    try:
        db.execute("ALTER TABLE matters ADD COLUMN intelligence TEXT")
        db.commit()
    except sqlite3.OperationalError:
        pass

def is_workspace_initialized() -> bool:
    db = get_db()
    row = db.execute("SELECT 1 FROM users WHERE role='admin' LIMIT 1").fetchone()
    return row is not None

def create_workspace(admin_name: str, admin_username: str, master_password: str) -> dict:
    if is_workspace_initialized():
        raise ValueError("Workspace already initialized")
    import bcrypt
    password_hash = bcrypt.hashpw(master_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db = get_db()
    db.execute(
        "INSERT INTO users (username, full_name, role, password_hash) VALUES (?,?,?,?)",
        (admin_username, admin_name, "admin", password_hash),
    )
    db.commit()
    return get_user(admin_username) # type: ignore


def get_user(username: str) -> Optional[dict]:
    db = get_db()
    row = db.execute(
        "SELECT * FROM users WHERE username=? AND active=1", (username,)
    ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    db = get_db()
    row = db.execute(
        "SELECT * FROM users WHERE id=? AND active=1", (user_id,)
    ).fetchone()
    return dict(row) if row else None


def verify_password(username: str, password: str) -> Optional[dict]:
    import bcrypt
    user = get_user(username)
    if not user:
        return None
    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return None
    return user


def create_user(
    username: str,
    password: str,
    full_name: str = "",
    email: str = "",
    phone: str = "",
    department: str = "",
    role: str = "associate",
) -> dict:
    import bcrypt
    if role not in ROLES:
        raise ValueError(f"Invalid role: {role}. Must be one of {ROLES}")
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db = get_db()
    db.execute(
        "INSERT INTO users (username, email, phone, full_name, department, role, password_hash) VALUES (?,?,?,?,?,?,?)",
        (username, email, phone, full_name, department, role, password_hash),
    )
    db.commit()
    return get_user(username)  # type: ignore


def change_password(username: str, new_password: str) -> bool:
    import bcrypt
    password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db = get_db()
    cur = db.execute(
        "UPDATE users SET password_hash=? WHERE username=?",
        (password_hash, username),
    )
    db.commit()
    return cur.rowcount > 0


def list_users() -> list[dict]:
    db = get_db()
    rows = db.execute(
        "SELECT id, username, email, full_name, role, active, created_at FROM users ORDER BY id"
    ).fetchall()
    return [dict(r) for r in rows]


def deactivate_user(username: str) -> bool:
    db = get_db()
    cur = db.execute("UPDATE users SET active=0 WHERE username=?", (username,))
    db.commit()
    return cur.rowcount > 0


def can_access_matter(user: dict, matter_id: str) -> bool:
    """Admin and senior partner can access all matters; others need explicit grant."""
    if user["role"] in ("admin", "senior_partner"):
        return True
    db = get_db()
    row = db.execute(
        "SELECT 1 FROM matter_members WHERE user_id=? AND matter_id=?",
        (user["id"], matter_id),
    ).fetchone()
    return row is not None

def grant_matter_access(user_id: int, matter_id: str, permission_level: str = "read") -> None:
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO matter_members (user_id, matter_id, permission_level) VALUES (?,?,?)",
        (user_id, matter_id, permission_level),
    )
    db.commit()

def revoke_matter_access(user_id: int, matter_id: str) -> None:
    db = get_db()
    db.execute(
        "DELETE FROM matter_members WHERE user_id=? AND matter_id=?",
        (user_id, matter_id),
    )
    db.commit()

def create_matter(matter_id: str, title: str, description: str, created_by: int) -> None:
    db = get_db()
    db.execute(
        "INSERT INTO matters (id, title, description, created_by) VALUES (?,?,?,?)",
        (matter_id, title, description, created_by)
    )
    # Grant creator full access
    db.execute(
        "INSERT INTO matter_members (user_id, matter_id, permission_level) VALUES (?,?,?)",
        (created_by, matter_id, "admin")
    )
    db.commit()

def list_user_matters(user: dict) -> list[dict]:
    db = get_db()
    if user["role"] in ("admin", "senior_partner"):
        rows = db.execute("SELECT * FROM matters ORDER BY created_at DESC").fetchall()
    else:
        rows = db.execute(
            """SELECT m.*, mm.permission_level 
               FROM matters m 
               JOIN matter_members mm ON m.id = mm.matter_id 
               WHERE mm.user_id = ? 
               ORDER BY m.created_at DESC""",
            (user["id"],)
        ).fetchall()
    return [dict(r) for r in rows]

def get_matter_intelligence(matter_id: str) -> Optional[dict]:
    db = get_db()
    row = db.execute("SELECT intelligence FROM matters WHERE id=?", (matter_id,)).fetchone()
    if row and row["intelligence"]:
        try:
            return json.loads(row["intelligence"])
        except json.JSONDecodeError:
            pass
    return None

def save_matter_intelligence(matter_id: str, data: dict) -> None:
    db = get_db()
    db.execute("UPDATE matters SET intelligence=? WHERE id=?", (json.dumps(data), matter_id))
    db.commit()
