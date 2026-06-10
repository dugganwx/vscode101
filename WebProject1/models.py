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
            filename TEXT UNIQUE,
            title TEXT,
            authors TEXT,
            year INTEGER,
            citation_count INTEGER DEFAULT 0,
            preview TEXT,
            summary TEXT,
            datacenter TEXT,
            metrics TEXT,
            link TEXT,
            infographic TEXT,
            best_figure TEXT,
            generated_infographic TEXT,
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS site_stats (
            key TEXT PRIMARY KEY,
            value INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS external_papers (
            id TEXT PRIMARY KEY,
            title TEXT,
            authors TEXT,
            year INTEGER,
            preview TEXT,
            summary TEXT,
            datacenter TEXT,
            metrics TEXT,
            source TEXT,
            sources_json TEXT,
            link TEXT,
            pdf_url TEXT,
            citation_count INTEGER DEFAULT 0,
            verified_by_ai INTEGER DEFAULT 1,
            indexed_query TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS figure_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            pdf_url TEXT,
            page INTEGER,
            bbox_json TEXT,
            verdict TEXT,
            notes TEXT,
            model TEXT,
            bbox_source TEXT DEFAULT 'auto',
            created_at TEXT
        )
    """)
    conn.execute("INSERT OR IGNORE INTO site_stats (key, value) VALUES ('visit_count', 0)")
    # Idempotent migration: add columns if they don't exist yet
    for col in ("best_figure", "generated_infographic"):
        try:
            conn.execute(f"ALTER TABLE papers ADD COLUMN {col} TEXT")
        except sqlite3.OperationalError:
            pass  # column already exists
    try:
        conn.execute("ALTER TABLE papers ADD COLUMN citation_count INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # column already exists
    try:
        conn.execute("ALTER TABLE figure_feedback ADD COLUMN bbox_source TEXT DEFAULT 'auto'")
    except sqlite3.OperationalError:
        pass  # column already exists
    conn.commit()
    conn.close()


def _external_row_to_dict(row):
    d = dict(row)
    try:
        d["sources"] = json.loads(d.get("sources_json") or "[]")
    except (json.JSONDecodeError, TypeError):
        d["sources"] = []
    d["verifiedByAI"] = bool(d.get("verified_by_ai", 1))
    d["isDiscovery"] = True
    return d

def _row_to_dict(row):
    d = dict(row)
    # Deserialize groups from JSON string to list
    try:
        d["groups"] = json.loads(d["groups"]) if d["groups"] else ["latest"]
    except (json.JSONDecodeError, TypeError):
        d["groups"] = ["latest"]
    d["citation_count"] = int(d.get("citation_count") or 0)
    d["isLocal"] = True
    d["_hasSidecarGroups"] = d.get("pinned", 0) == 1
    return d

def get_all_papers():
    conn = _connect()
    rows = conn.execute("SELECT * FROM papers ORDER BY year DESC, title ASC").fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def upsert_external_paper(data):
    now = datetime.datetime.now().isoformat()
    sources_json = json.dumps(data.get("sources", []))
    conn = _connect()
    conn.execute("""
        INSERT INTO external_papers (
            id, title, authors, year, preview, summary, datacenter, metrics,
            source, sources_json, link, pdf_url, citation_count, verified_by_ai,
            indexed_query, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            authors=excluded.authors,
            year=excluded.year,
            preview=excluded.preview,
            summary=excluded.summary,
            datacenter=excluded.datacenter,
            metrics=excluded.metrics,
            source=excluded.source,
            sources_json=excluded.sources_json,
            link=excluded.link,
            pdf_url=excluded.pdf_url,
            citation_count=excluded.citation_count,
            verified_by_ai=excluded.verified_by_ai,
            indexed_query=excluded.indexed_query,
            updated_at=excluded.updated_at
    """, (
        data["id"], data.get("title", ""), data.get("authors", ""), data.get("year", 2024),
        data.get("preview", ""), data.get("summary", ""), data.get("datacenter", ""),
        data.get("metrics", ""), data.get("source", ""), sources_json,
        data.get("link", ""), data.get("pdf_url", ""), int(data.get("citation_count", 0) or 0),
        1 if data.get("verified_by_ai", True) else 0, data.get("indexed_query", ""), now, now,
    ))
    conn.commit()
    conn.close()


def search_external_papers(query="", year_from=None, year_to=None, limit=50):
    conn = _connect()
    clauses = []
    params = []
    if query:
        fields = [
            "title", "authors", "preview", "summary", "datacenter", "metrics",
            "source", "indexed_query", "link", "pdf_url",
        ]
        tokens = _keyword_tokens(query)
        if not tokens:
            tokens = [query.strip().lower()]
        for token in tokens:
            like = f"%{token}%"
            clauses.append("(" + " OR ".join(f"{field} LIKE ?" for field in fields) + ")")
            params.extend([like] * len(fields))
    if year_from is not None:
        clauses.append("year >= ?")
        params.append(int(year_from))
    if year_to is not None:
        clauses.append("year <= ?")
        params.append(int(year_to))
    where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"SELECT * FROM external_papers {where_clause} ORDER BY citation_count DESC, year DESC, title ASC LIMIT ?",
        (*params, int(limit)),
    ).fetchall()
    conn.close()
    return [_external_row_to_dict(r) for r in rows]


def external_paper_count():
    conn = _connect()
    count = conn.execute("SELECT COUNT(*) FROM external_papers").fetchone()[0]
    conn.close()
    return count


def save_figure_feedback(data):
    now = datetime.datetime.now().isoformat()
    bbox_json = json.dumps(data.get("bbox")) if data.get("bbox") is not None else None
    conn = _connect()
    conn.execute(
        """INSERT INTO figure_feedback (
               request_id, pdf_url, page, bbox_json, verdict, notes, model, bbox_source, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data.get("request_id", ""),
            data.get("pdf_url", ""),
            data.get("page"),
            bbox_json,
            data.get("verdict", ""),
            data.get("notes", ""),
            data.get("model", ""),
            data.get("bbox_source", "auto"),
            now,
        ),
    )
    conn.commit()
    conn.close()


def get_figure_feedback_summary(pdf_url):
    conn = _connect()
    row = conn.execute(
        """SELECT
               COALESCE(SUM(CASE WHEN verdict = 'good' THEN 1 ELSE 0 END), 0) AS good_count,
               COALESCE(SUM(CASE WHEN verdict = 'bad' THEN 1 ELSE 0 END), 0) AS bad_count,
               COALESCE(SUM(CASE WHEN bbox_source = 'manual' THEN 1 ELSE 0 END), 0) AS manual_count
           FROM figure_feedback
           WHERE pdf_url = ?""",
        (pdf_url,),
    ).fetchone()
    conn.close()
    return {
        "good_count": int(row["good_count"] if row else 0),
        "bad_count": int(row["bad_count"] if row else 0),
        "manual_count": int(row["manual_count"] if row else 0),
    }


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
        INSERT INTO papers (id, filename, title, authors, year, citation_count, preview, summary,
                            datacenter, metrics, link, infographic,
                            best_figure, generated_infographic,
                            groups, pinned,
                            created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            filename=excluded.filename, title=excluded.title, authors=excluded.authors,
            year=excluded.year, citation_count=excluded.citation_count,
            preview=excluded.preview, summary=excluded.summary,
            datacenter=excluded.datacenter, metrics=excluded.metrics, link=excluded.link,
            infographic=excluded.infographic,
            best_figure=excluded.best_figure,
            generated_infographic=excluded.generated_infographic,
            groups=excluded.groups, pinned=excluded.pinned,
            updated_at=excluded.updated_at
    """, (
        data["id"], data.get("filename", ""), data.get("title", ""),
        data.get("authors", "Repository Paper"), data.get("year", 2024),
        int(data.get("citation_count", 0) or 0),
        data.get("preview", ""), data.get("summary", ""),
        data.get("datacenter", ""), data.get("metrics", ""),
        data.get("link", ""), data.get("infographic", ""),
        data.get("best_figure", ""), data.get("generated_infographic", ""),
        groups, data.get("pinned", 0), now, now
    ))
    conn.commit()
    conn.close()

def update_paper(paper_id, fields):
    """Update only the provided fields for a paper."""
    allowed = {"title", "authors", "year", "preview", "summary", "datacenter",
               "metrics", "link", "infographic", "best_figure",
               "generated_infographic", "groups", "pinned", "citation_count"}
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
