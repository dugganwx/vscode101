"""
models.py
SQLite database layer for the AI Architecture Papers Portal.

Single-table schema: all paper metadata (local + imported discovery)
lives in the `papers` table.  Discovery results themselves are held
in-memory only (see app.py _discovery_cache).
"""

import sqlite3
import json
import re
import datetime
import os
import csv

DB_PATH = "papers.db"

_SEARCH_STOPWORDS = {
    "a", "an", "and", "at", "by", "for", "from", "in", "into", "of",
    "on", "or", "the", "to", "via", "with", "using",
}


def _keyword_tokens(query, max_tokens=8):
    tokens = []
    seen = set()
    for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9+\-]*", (query or "").lower()):
        if len(token) < 2 or token in _SEARCH_STOPWORDS or token in seen:
            continue
        seen.add(token)
        tokens.append(token)
        if len(tokens) >= max_tokens:
            break
    return tokens

def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = _connect()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS papers (
            id TEXT PRIMARY KEY,
            title TEXT,
            authors TEXT,
            year INTEGER,
            citation_count INTEGER DEFAULT 0,
            preview TEXT,
            summary TEXT,
            datacenter TEXT,
            metrics TEXT,
            link TEXT,
            pdf_path TEXT,
            image_path TEXT,
            source TEXT DEFAULT 'local',
            groups TEXT DEFAULT '["latest"]',
            pinned INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.commit()
    conn.close()


def _row_to_dict(row):
    d = dict(row)
    try:
        d["groups"] = json.loads(d["groups"]) if d["groups"] else ["latest"]
    except (json.JSONDecodeError, TypeError):
        d["groups"] = ["latest"]
    d["citation_count"] = int(d.get("citation_count") or 0)
    d["isLocal"] = True
    return d

def get_all_papers():
    conn = _connect()
    rows = conn.execute("SELECT * FROM papers ORDER BY year DESC, title ASC").fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def search_papers(query):
    """Search papers by matching keyword tokens across title, authors, preview, summary, datacenter, metrics, and link."""
    conn = _connect()
    fields = ["title", "authors", "preview", "summary", "datacenter", "metrics", "link"]
    tokens = _keyword_tokens(query)
    if not tokens:
        tokens = [query.strip().lower()]
    clauses = []
    params = []
    for token in tokens:
        like = f"%{token}%"
        clauses.append("(" + " OR ".join(f"{field} LIKE ?" for field in fields) + ")")
        params.extend([like] * len(fields))
    where_clause = " AND ".join(clauses) if clauses else "1=1"
    rows = conn.execute(
        f"""SELECT * FROM papers
           WHERE {where_clause}
           ORDER BY year DESC, title ASC""",
        tuple(params)
    ).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]

def get_paper(paper_id):
    conn = _connect()
    row = conn.execute("SELECT * FROM papers WHERE id = ?", (paper_id,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None

def upsert_paper(data):
    now = datetime.datetime.now().isoformat()
    groups = json.dumps(data.get("groups", ["latest"]))
    conn = _connect()
    conn.execute("""
        INSERT INTO papers (id, title, authors, year, citation_count, preview, summary,
                            datacenter, metrics, link, pdf_path, image_path,
                            source, groups, pinned,
                            created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, authors=excluded.authors,
            year=excluded.year, citation_count=excluded.citation_count,
            preview=excluded.preview, summary=excluded.summary,
            datacenter=excluded.datacenter, metrics=excluded.metrics, link=excluded.link,
            pdf_path=excluded.pdf_path, image_path=excluded.image_path,
            source=excluded.source,
            groups=excluded.groups, pinned=excluded.pinned,
            updated_at=excluded.updated_at
    """, (
        data["id"], data.get("title", ""),
        data.get("authors", ""), data.get("year", 2024),
        int(data.get("citation_count", 0) or 0),
        data.get("preview", ""), data.get("summary", ""),
        data.get("datacenter", ""), data.get("metrics", ""),
        data.get("link", ""), data.get("pdf_path"),
        data.get("image_path"), data.get("source", "local"),
        groups, data.get("pinned", 0), now, now
    ))
    conn.commit()
    conn.close()

def update_paper(paper_id, fields):
    """Update only the provided fields for a paper."""
    allowed = {"title", "authors", "year", "preview", "summary", "datacenter",
               "metrics", "link", "pdf_path", "image_path", "source",
               "groups", "pinned", "citation_count"}
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
    """Delete a paper, returning (pdf_path, image_path) for cleanup."""
    conn = _connect()
    row = conn.execute("SELECT pdf_path, image_path FROM papers WHERE id = ?", (paper_id,)).fetchone()
    if not row:
        conn.close()
        return None, None
    pdf_path = row["pdf_path"]
    image_path = row["image_path"]
    conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))
    conn.commit()
    conn.close()
    return pdf_path, image_path

def add_from_discovery(data):
    """Insert a discovery paper into the library. Returns the new paper dict."""
    upsert_paper(data)
    return get_paper(data["id"])

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


# ── CSV-based user management ───────────────────────────────────────────────

_USERS_CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.csv")
_users_cache = []      # list of user dicts
_users_mtime = 0.0     # last-modified time of the CSV file


def _load_users_csv():
    """Read users.csv, caching by file mtime so edits are picked up without restart."""
    global _users_cache, _users_mtime
    try:
        mtime = os.path.getmtime(_USERS_CSV_PATH)
    except OSError:
        _users_cache = []
        _users_mtime = 0.0
        return _users_cache
    if mtime != _users_mtime:
        users = []
        with open(_USERS_CSV_PATH, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                users.append({
                    "username": row.get("username", "").strip(),
                    "password": row.get("password", "").strip(),
                    "admin": row.get("admin", "N").strip().upper() == "Y",
                })
        _users_cache = users
        _users_mtime = mtime
    return _users_cache


def get_user_csv(username):
    """Look up a user by username (case-insensitive). Returns dict or None."""
    for u in _load_users_csv():
        if u["username"].lower() == username.lower():
            return u
    return None


def verify_user_csv(username, password):
    """Verify credentials against CSV. Returns user dict or None."""
    user = get_user_csv(username)
    if user and user["password"] == password:
        return user
    return None
