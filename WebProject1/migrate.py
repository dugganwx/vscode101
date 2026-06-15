"""
migrate.py
One-time migration: reads PDFs + detects images from the paper folder
and imports them into the SQLite database.

Safe to re-run (upserts, not inserts).

Usage:
    python migrate.py
"""

import os
from models import init_db, upsert_paper, slugify, infer_year, to_display_title

FOLDER = "AI papers for WebProject1"


def detect_image(files_set, base):
    """Auto-detect a .jpg/.jpeg image with the same base name."""
    for ext in (".jpg", ".JPG", ".jpeg", ".JPEG"):
        if base + ext in files_set:
            return FOLDER + "/" + base + ext
    return None


def infer_groups(filename):
    lower = filename.lower()
    groups = ["latest"]
    if "survey" in lower or "technical report" in lower or "benchmark" in lower:
        groups.append("read")
    return groups


def main():
    init_db()

    try:
        all_entries = os.listdir(FOLDER)
        files = sorted(f for f in all_entries if f.lower().endswith(".pdf"))
    except FileNotFoundError:
        print(f"Folder not found: {FOLDER}")
        return

    files_set = set(all_entries)

    for fname in files:
        base = os.path.splitext(fname)[0]
        paper_id = f"local-{slugify(fname)}"
        year = infer_year(fname)
        title = to_display_title(fname)
        groups = infer_groups(fname)
        pdf_path = f"{FOLDER}/{fname}"
        image_path = detect_image(files_set, base)

        paper = {
            "id": paper_id,
            "title": title,
            "authors": "",
            "year": year,
            "groups": groups,
            "pinned": 0,
            "preview": "",
            "summary": "",
            "datacenter": "",
            "metrics": "",
            "link": pdf_path,
            "pdf_path": pdf_path,
            "image_path": image_path,
            "source": "local",
        }

        upsert_paper(paper)

    print(f"Migrated {len(files)} papers")


if __name__ == "__main__":
    main()
