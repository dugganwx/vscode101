"""
models.py
SQLite database layer for the AI Architecture Papers Portal.
"""

import sqlite3
import json
import re
import datetime
import os

from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = "papers.db"

def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = _connect()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS papers (
            id TEXT PRIMARY KEY,
            filename TEXT UNIQUE,
            title TEXT,
            authors TEXT,
            year INTEGER,
            preview TEXT,
            summary TEXT,
            datacenter TEXT,
            metrics TEXT,
            link TEXT,
            infographic TEXT,
            groups TEXT DEFAULT '["latest"]',
            pinned INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()

def _row_to_dict(row):
    d = dict(row)
    # Deserialize groups from JSON string to list
    try:
        d["groups"] = json.loads(d["groups"]) if d["groups"] else ["latest"]
    except (json.JSONDecodeError, TypeError):
        d["groups"] = ["latest"]
    d["isLocal"] = True
    d["_hasSidecarGroups"] = d.get("pinned", 0) == 1
    return d

def get_all_papers():
    conn = _connect()
    rows = conn.execute("SELECT * FROM papers ORDER BY year DESC, title ASC").fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]

def get_paper(paper_id):
    conn = _connect()
    row = conn.execute("SELECT * FROM papers WHERE id = ?", (paper_id,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None

def paper_exists(filename):
    conn = _connect()
    row = conn.execute("SELECT 1 FROM papers WHERE filename = ?", (filename,)).fetchone()
    conn.close()
    return row is not None

def upsert_paper(data):
    now = datetime.datetime.now().isoformat()
    groups = json.dumps(data.get("groups", ["latest"]))
    conn = _connect()
    conn.execute("""
        INSERT INTO papers (id, filename, title, authors, year, preview, summary,
                            datacenter, metrics, link, infographic, groups, pinned,
                            created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            filename=excluded.filename, title=excluded.title, authors=excluded.authors,
            year=excluded.year, preview=excluded.preview, summary=excluded.summary,
            datacenter=excluded.datacenter, metrics=excluded.metrics, link=excluded.link,
            infographic=excluded.infographic, groups=excluded.groups, pinned=excluded.pinned,
            updated_at=excluded.updated_at
    """, (
        data["id"], data.get("filename", ""), data.get("title", ""),
        data.get("authors", "Repository Paper"), data.get("year", 2024),
        data.get("preview", ""), data.get("summary", ""),
        data.get("datacenter", ""), data.get("metrics", ""),
        data.get("link", ""), data.get("infographic", ""),
        groups, data.get("pinned", 0), now, now
    ))
    conn.commit()
    conn.close()

def update_paper(paper_id, fields):
    """Update only the provided fields for a paper."""
    allowed = {"title", "authors", "year", "preview", "summary", "datacenter",
               "metrics", "link", "infographic", "groups", "pinned"}
    updates = {}
    for k, v in fields.items():
        if k in allowed:
            if k == "groups":
                updates[k] = json.dumps(v) if isinstance(v, list) else v
            else:
                updates[k] = v
    if not updates:
        return None
    updates["updated_at"] = datetime.datetime.now().isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [paper_id]
    conn = _connect()
    conn.execute(f"UPDATE papers SET {set_clause} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return get_paper(paper_id)

def delete_paper(paper_id):
    """Delete a paper, returning the filename for cleanup."""
    conn = _connect()
    row = conn.execute("SELECT filename FROM papers WHERE id = ?", (paper_id,)).fetchone()
    if not row:
        conn.close()
        return None
    filename = row["filename"]
    conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))
    conn.commit()
    conn.close()
    return filename

# ── Helper functions ported from app.js ──

def slugify(value):
    s = value.lower()
    s = re.sub(r'\.pdf$', '', s, flags=re.IGNORECASE)
    s = re.sub(r'^[0-9]+\.', '', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return s

def infer_year(filename):
    m = re.search(r'(19|20)\d{2}', filename)
    return int(m.group(0)) if m else 2024

def to_display_title(filename):
    base = filename
    base = re.sub(r'\.pdf$', '', base, flags=re.IGNORECASE)
    base = re.sub(r'^[0-9]+\.', '', base)
    base = re.sub(r'[_-]+', ' ', base)
    base = re.sub(r'\s+', ' ', base).strip()
    return base if base else filename


# ── User management ─────────────────────────────────────────────────────────

def create_user(username, password):
    now = datetime.datetime.now().isoformat()
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, generate_password_hash(password), now)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return None  # username already exists
    user_id = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()["id"]
    conn.close()
    return user_id


def get_user_by_id(user_id):
    conn = _connect()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_username(username):
    conn = _connect()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None


def verify_user(username, password):
    user = get_user_by_username(username)
    if user and check_password_hash(user["password_hash"], password):
        return user
    return None


def user_count():
    conn = _connect()
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return count
