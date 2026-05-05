"""
migrate.py
One-time migration: reads PDFs + JSON sidecars from the paper folder
and imports them into the SQLite database.

Safe to re-run (upserts, not inserts).

Usage:
    python migrate.py
"""

import os
import json
from models import init_db, upsert_paper, slugify, infer_year, to_display_title

FOLDER = "AI papers for WebProject1"


def load_sidecar_metadata(files):
    """Read JSON sidecar + detect infographic images for each PDF."""
    metadata = {}
    for fname in files:
        base = os.path.splitext(fname)[0]

        # Auto-detect a .jpg infographic with the same base name
        for ext in (".jpg", ".JPG", ".jpeg", ".JPEG"):
            jpg_path = os.path.join(FOLDER, base + ext)
            if os.path.exists(jpg_path):
                metadata.setdefault(fname, {})["infographic"] = FOLDER + "/" + base + ext
                break

        jpath = os.path.join(FOLDER, base + ".json")
        if not os.path.exists(jpath):
            continue
        try:
            with open(jpath, "r", encoding="utf-8") as f:
                data = json.load(f)
            sidecar = {k: data[k] for k in
                       ("title", "authors", "year", "preview", "summary",
                        "datacenter", "metrics", "link", "infographic")
                       if k in data}
            metadata[fname] = {**metadata.get(fname, {}), **sidecar}
        except Exception as e:
            print(f"  [warn] Could not read sidecar {jpath}: {e}")

    return metadata


def infer_groups(filename):
    lower = filename.lower()
    groups = ["latest"]
    if "survey" in lower or "technical report" in lower or "benchmark" in lower:
        groups.append("read")
    return groups


def main():
    init_db()

    try:
        files = sorted(f for f in os.listdir(FOLDER) if f.lower().endswith(".pdf"))
    except FileNotFoundError:
        print(f"Folder not found: {FOLDER}")
        return

    metadata = load_sidecar_metadata(files)
    rich = 0

    for fname in files:
        sidecar = metadata.get(fname, {})
        paper_id = f"local-{slugify(fname)}"
        year = sidecar.get("year") or infer_year(fname)
        title = sidecar.get("title") or to_display_title(fname)

        has_sidecar_groups = isinstance(sidecar.get("groups"), list) and len(sidecar["groups"]) > 0
        groups = sidecar["groups"] if has_sidecar_groups else infer_groups(fname)
        relative_path = f"{FOLDER}/{fname}"

        paper = {
            "id": paper_id,
            "filename": fname,
            "title": title,
            "authors": sidecar.get("authors", "Repository Paper"),
            "year": year,
            "groups": groups,
            "pinned": 1 if has_sidecar_groups else 0,
            "preview": sidecar.get("preview", "Local repository entry loaded from your WebProject1 paper folder."),
            "summary": sidecar.get("summary", "This entry is pulled from the local paper repository."),
            "datacenter": sidecar.get("datacenter", "Potentially relevant to accelerator efficiency, cluster architecture, inference economics, or system-level AI deployment tradeoffs."),
            "metrics": sidecar.get("metrics", "Key result signal not yet extracted. Review and annotate this item for production use."),
            "link": sidecar.get("link") or relative_path,
            "infographic": sidecar.get("infographic", ""),
        }

        upsert_paper(paper)
        if fname in metadata:
            rich += 1

    print(f"Migrated {len(files)} papers ({rich} with metadata)")


if __name__ == "__main__":
    main()
