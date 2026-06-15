"""
migrate_consolidate.py
One-time migration: converts the old multi-table papers.db to the new
single-table schema, deletes JSON sidecars, and removes manifest files.

Safe to re-run — it checks whether migration has already been done.

Usage:
    python migrate_consolidate.py
"""

import os
import sys
import glob
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "papers.db")
PAPER_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AI papers for WebProject1")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _has_old_schema(conn):
    """Check whether the old schema (filename column in papers) still exists."""
    cursor = conn.execute("PRAGMA table_info(papers)")
    columns = {row[1] for row in cursor.fetchall()}
    return "filename" in columns


def _table_exists(conn, name):
    row = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row[0] > 0


def migrate():
    if not os.path.exists(DB_PATH):
        print("No papers.db found — nothing to migrate.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    if not _has_old_schema(conn):
        print("Database already uses the new schema — skipping migration.")
        conn.close()
        return

    # ── Step 1: Read all rows from old papers table ────────────────────────
    old_rows = conn.execute("SELECT * FROM papers").fetchall()
    print(f"Found {len(old_rows)} papers in old schema.")

    migrated = []
    for row in old_rows:
        d = dict(row)
        filename = d.get("filename", "")
        pdf_path = f"AI papers for WebProject1/{filename}" if filename else None

        # Pick best image: generated_infographic > best_figure > infographic
        image_path = (
            d.get("generated_infographic")
            or d.get("best_figure")
            or d.get("infographic")
            or None
        )
        # Ensure empty strings become None
        if image_path is not None and not image_path.strip():
            image_path = None

        migrated.append({
            "id": d["id"],
            "title": d.get("title", ""),
            "authors": d.get("authors", ""),
            "year": d.get("year", 2024),
            "citation_count": int(d.get("citation_count") or 0),
            "preview": d.get("preview", ""),
            "summary": d.get("summary", ""),
            "datacenter": d.get("datacenter", ""),
            "metrics": d.get("metrics", ""),
            "link": d.get("link", ""),
            "pdf_path": pdf_path,
            "image_path": image_path,
            "source": "local",
            "groups": d.get("groups", '["latest"]'),
            "pinned": d.get("pinned", 0),
            "created_at": d.get("created_at", ""),
            "updated_at": d.get("updated_at", ""),
        })

    # ── Step 2: Drop old tables and recreate ───────────────────────────────
    conn.execute("DROP TABLE IF EXISTS papers")
    conn.execute("DROP TABLE IF EXISTS external_papers")
    conn.execute("DROP TABLE IF EXISTS site_stats")
    conn.execute("DROP TABLE IF EXISTS figure_feedback")

    conn.execute("""
        CREATE TABLE papers (
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

    # ── Step 3: Insert migrated rows ───────────────────────────────────────
    for m in migrated:
        conn.execute("""
            INSERT INTO papers (id, title, authors, year, citation_count,
                                preview, summary, datacenter, metrics, link,
                                pdf_path, image_path, source, groups, pinned,
                                created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            m["id"], m["title"], m["authors"], m["year"], m["citation_count"],
            m["preview"], m["summary"], m["datacenter"], m["metrics"], m["link"],
            m["pdf_path"], m["image_path"], m["source"], m["groups"], m["pinned"],
            m["created_at"], m["updated_at"],
        ))

    conn.commit()

    # Verify
    count = conn.execute("SELECT COUNT(*) FROM papers").fetchone()[0]
    tables = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()]
    conn.close()

    print(f"Migration complete: {count} papers in new schema.")
    print(f"Tables remaining: {tables}")

    # ── Step 4: Delete JSON sidecars ───────────────────────────────────────
    json_files = glob.glob(os.path.join(PAPER_FOLDER, "*.json"))
    if json_files:
        for jf in json_files:
            os.remove(jf)
        print(f"Deleted {len(json_files)} JSON sidecar files.")
    else:
        print("No JSON sidecar files to delete.")

    # ── Step 5: Delete manifest files ──────────────────────────────────────
    for name in ("papers-manifest.js", "papers-manifest.json"):
        path = os.path.join(BASE_DIR, name)
        if os.path.exists(path):
            os.remove(path)
            print(f"Deleted {name}")


if __name__ == "__main__":
    migrate()
