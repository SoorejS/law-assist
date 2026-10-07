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

from contextlib import contextmanager

DB_PATH = str(Path(config.DATA_DIR) / "users.db")

ROLES = ["admin", "senior_partner", "senior", "associate", "paralegal"]


def get_db() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=5000")
    _init_schema(db)
    return db


@contextmanager
def get_db_context():
    db = get_db()
    try:
        yield db
    finally:
        db.close()


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

        CREATE TABLE IF NOT EXISTS workspace_config (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS custom_coworkers (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            role        TEXT NOT NULL,
            description TEXT NOT NULL,
            icon        TEXT NOT NULL DEFAULT 'briefcase',
            vertical    TEXT NOT NULL DEFAULT 'all',
            system_prompt TEXT NOT NULL,
            default_query TEXT NOT NULL,
            created_by  INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
    """)
    db.commit()
    
    # Upgrade schema: add intelligence & executive_brief columns safely
    try:
        db.execute("ALTER TABLE matters ADD COLUMN intelligence TEXT")
        db.commit()
    except sqlite3.OperationalError:
        pass
    try:
        db.execute("ALTER TABLE matters ADD COLUMN executive_brief TEXT")
        db.commit()
    except sqlite3.OperationalError:
        pass
    try:
        db.execute("ALTER TABLE matters ADD COLUMN tags TEXT DEFAULT '[]'")
        db.commit()
    except sqlite3.OperationalError:
        pass

def is_workspace_initialized() -> bool:
    with get_db_context() as db:
        row = db.execute("SELECT 1 FROM users WHERE role='admin' LIMIT 1").fetchone()
        return row is not None

def create_workspace(admin_name: str, admin_username: str, master_password: str, vertical: str = "generic") -> dict:
    if is_workspace_initialized():
        raise ValueError("Workspace already initialized")
    import bcrypt
    password_hash = bcrypt.hashpw(master_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    with get_db_context() as db:
        db.execute(
            "INSERT INTO users (username, full_name, role, password_hash) VALUES (?,?,?,?)",
            (admin_username, admin_name, "admin", password_hash),
        )
        db.execute(
            "INSERT INTO workspace_config (key, value) VALUES (?,?)",
            ("vertical", vertical)
        )
        db.commit()
    return get_user(admin_username) # type: ignore

def get_workspace_vertical() -> str:
    with get_db_context() as db:
        try:
            row = db.execute("SELECT value FROM workspace_config WHERE key='vertical'").fetchone()
            if row:
                return row["value"]
        except sqlite3.OperationalError:
            pass
    import config
    return config.VERTICAL


def get_user(username: str) -> Optional[dict]:
    with get_db_context() as db:
        row = db.execute(
            "SELECT * FROM users WHERE username=? AND active=1", (username,)
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    with get_db_context() as db:
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
    with get_db_context() as db:
        db.execute(
            "INSERT INTO users (username, email, phone, full_name, department, role, password_hash) VALUES (?,?,?,?,?,?,?)",
            (username, email, phone, full_name, department, role, password_hash),
        )
        db.commit()
    return get_user(username)  # type: ignore


def change_password(username: str, new_password: str) -> bool:
    import bcrypt
    password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    with get_db_context() as db:
        cur = db.execute(
            "UPDATE users SET password_hash=? WHERE username=?",
            (password_hash, username),
        )
        db.commit()
        return cur.rowcount > 0


def list_users() -> list[dict]:
    with get_db_context() as db:
        rows = db.execute(
            "SELECT id, username, email, full_name, role, active, created_at FROM users ORDER BY id"
        ).fetchall()
        return [dict(r) for r in rows]


def deactivate_user(username: str) -> bool:
    with get_db_context() as db:
        cur = db.execute("UPDATE users SET active=0 WHERE username=?", (username,))
        db.commit()
        return cur.rowcount > 0


def can_access_matter(user: dict, matter_id: str) -> bool:
    """Admin and senior partner can access all matters; others need explicit grant."""
    if user["role"] in ("admin", "senior_partner", "senior"):
        return True
    with get_db_context() as db:
        row = db.execute(
            "SELECT 1 FROM matter_members WHERE user_id=? AND matter_id=?",
            (user["id"], matter_id),
        ).fetchone()
        return row is not None

def grant_matter_access(user_id: int, matter_id: str, permission_level: str = "read") -> None:
    with get_db_context() as db:
        db.execute(
            "INSERT OR REPLACE INTO matter_members (user_id, matter_id, permission_level) VALUES (?,?,?)",
            (user_id, matter_id, permission_level),
        )
        db.commit()

def revoke_matter_access(user_id: int, matter_id: str) -> None:
    with get_db_context() as db:
        db.execute(
            "DELETE FROM matter_members WHERE user_id=? AND matter_id=?",
            (user_id, matter_id),
        )
        db.commit()

def create_matter(matter_id: str, title: str, description: str, created_by: int, tags: Optional[list[str]] = None) -> None:
    tags_json = json.dumps(tags or [])
    with get_db_context() as db:
        db.execute(
            "INSERT INTO matters (id, title, description, created_by, tags) VALUES (?,?,?,?,?)",
            (matter_id, title, description, created_by, tags_json)
        )
        # Grant creator full access
        db.execute(
            "INSERT INTO matter_members (user_id, matter_id, permission_level) VALUES (?,?,?)",
            (created_by, matter_id, "admin")
        )
        db.commit()

def list_user_matters(user: dict) -> list[dict]:
    with get_db_context() as db:
        if user["role"] in ("admin", "senior_partner", "senior"):
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
        result = []
        for r in rows:
            d = dict(r)
            raw_tags = d.get("tags")
            if raw_tags:
                try:
                    d["tags"] = json.loads(raw_tags) if isinstance(raw_tags, str) else list(raw_tags)
                except Exception:
                    d["tags"] = []
            else:
                d["tags"] = []
            result.append(d)
        return result

def update_matter_tags(matter_id: str, tags: list[str]) -> list[str]:
    with get_db_context() as db:
        db.execute("UPDATE matters SET tags=? WHERE id=?", (json.dumps(tags), matter_id))
        db.commit()
    return tags

def get_matter_intelligence(matter_id: str) -> Optional[dict]:
    with get_db_context() as db:
        row = db.execute("SELECT intelligence FROM matters WHERE id=?", (matter_id,)).fetchone()
        if row and row["intelligence"]:
            try:
                return json.loads(row["intelligence"])
            except json.JSONDecodeError:
                pass
        return None

def save_matter_intelligence(matter_id: str, data: dict) -> None:
    with get_db_context() as db:
        db.execute("UPDATE matters SET intelligence=? WHERE id=?", (json.dumps(data), matter_id))
        db.commit()

def get_matter_executive_brief(matter_id: str) -> Optional[dict]:
    with get_db_context() as db:
        row = db.execute("SELECT executive_brief FROM matters WHERE id=?", (matter_id,)).fetchone()
        if row and row["executive_brief"]:
            try:
                return json.loads(row["executive_brief"])
            except json.JSONDecodeError:
                pass
    return None

def save_matter_executive_brief(matter_id: str, data: dict) -> None:
    with get_db_context() as db:
        db.execute("UPDATE matters SET executive_brief=? WHERE id=?", (json.dumps(data), matter_id))
        db.commit()


# ── Custom Coworkers ──────────────────────────────────────────────────────────

def list_custom_coworkers(vertical: Optional[str] = None) -> list[dict]:
    with get_db_context() as db:
        if vertical and vertical != "all":
            rows = db.execute(
                "SELECT * FROM custom_coworkers WHERE vertical = ? OR vertical = 'all' ORDER BY created_at DESC",
                (vertical,)
            ).fetchall()
        else:
            rows = db.execute("SELECT * FROM custom_coworkers ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


def get_custom_coworker(coworker_id: str) -> Optional[dict]:
    with get_db_context() as db:
        row = db.execute("SELECT * FROM custom_coworkers WHERE id = ?", (coworker_id,)).fetchone()
        return dict(row) if row else None


def save_custom_coworker(
    coworker_id: str,
    name: str,
    role: str,
    description: str,
    icon: str,
    vertical: str,
    system_prompt: str,
    default_query: str,
    user_id: Optional[int] = None,
) -> dict:
    with get_db_context() as db:
        db.execute(
            """INSERT INTO custom_coworkers (id, name, role, description, icon, vertical, system_prompt, default_query, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   name=excluded.name,
                   role=excluded.role,
                   description=excluded.description,
                   icon=excluded.icon,
                   vertical=excluded.vertical,
                   system_prompt=excluded.system_prompt,
                   default_query=excluded.default_query""",
            (coworker_id, name, role, description, icon, vertical, system_prompt, default_query, user_id)
        )
        db.commit()
    return {
        "id": coworker_id,
        "name": name,
        "role": role,
        "description": description,
        "icon": icon,
        "vertical": vertical,
        "system_prompt": system_prompt,
        "default_query": default_query,
    }


def delete_custom_coworker(coworker_id: str) -> bool:
    with get_db_context() as db:
        cur = db.execute("DELETE FROM custom_coworkers WHERE id = ?", (coworker_id,))
        db.commit()
        return cur.rowcount > 0

