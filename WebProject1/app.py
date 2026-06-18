"""
app.py
Flask backend for the AI Architecture Papers Portal.

Serves the site, provides a REST API for paper CRUD + discovery,
stores metadata in SQLite, and integrates the folder watcher as a
background thread.

Usage:
    python app.py                   # run dev server on port 5000
    flask --app app run --debug     # alternative via Flask CLI
"""

import os
import signal

# ── Kill previous server instance if still running ──────────────────────────────
PID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flask.pid")

def _kill_old_server():
    if os.path.exists(PID_FILE):
        try:
            old_pid = int(open(PID_FILE).read().strip())
            os.kill(old_pid, signal.SIGTERM)
            print(f"  Killed old server (PID {old_pid})")
        except (ProcessLookupError, ValueError, PermissionError, OSError):
            pass
        try:
            os.remove(PID_FILE)
        except OSError:
            pass

def _write_pid():
    with open(PID_FILE, "w") as f:
        f.write(str(os.getpid()))

import atexit
def _cleanup_pid():
    try:
        if os.path.exists(PID_FILE) and int(open(PID_FILE).read().strip()) == os.getpid():
            os.remove(PID_FILE)
    except (ValueError, OSError):
        pass
atexit.register(_cleanup_pid)

_kill_old_server()
_write_pid()

# ── Intel proxy configuration ───────────────────────────────────────────────
# Outbound HTTP goes through the corporate proxy; localhost is excluded.
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1,*.intel.com")
os.environ.setdefault("no_proxy", "localhost,127.0.0.1,*.intel.com")
os.environ.setdefault("HTTP_PROXY", "http://proxy-dmz.intel.com:912")
os.environ.setdefault("HTTPS_PROXY", "http://proxy-dmz.intel.com:912")

import re
import json
import time
import datetime
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import base64
import tempfile
import io
import zipfile
import sqlite3
import uuid
from xml.etree import ElementTree as ET
from queue import Queue, Empty

from flask import (
    Flask, jsonify, request, send_from_directory, send_file,
    Response, stream_with_context, abort, redirect, url_for
)
from werkzeug.utils import secure_filename
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import requests as http_requests
from openai import AzureOpenAI
import fitz  # PyMuPDF

from models import (
    init_db, get_all_papers, search_papers, get_paper, upsert_paper,
    update_paper, delete_paper, add_from_discovery,
    slugify, infer_year, to_display_title,
    get_user_csv, verify_user_csv,
)

# ── App setup ───────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder=None)  # we serve static files manually
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB upload limit
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-in-production")

# ── Flask-Login setup ──────────────────────────────────────────────────────

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"


@login_manager.unauthorized_handler
def unauthorized():
    if request.path.startswith("/api/"):
        return jsonify({"error": "Authentication required"}), 401
    return redirect(url_for("login", next=request.path))


class User(UserMixin):
    def __init__(self, user_dict):
        self.id = user_dict["username"]          # session key = username
        self.username = user_dict["username"]
        self.is_admin = user_dict.get("admin", False)


@login_manager.user_loader
def load_user(user_id):
    u = get_user_csv(user_id)                     # user_id is now the username string
    return User(u) if u else None

PAPER_FOLDER = "AI papers for WebProject1"
KEYWORD_IMG_FOLDER = "Key Word Images"

# ── SSE infrastructure ─────────────────────────────────────────────────────

_sse_clients = []
_sse_lock = threading.Lock()


def notify_clients():
    with _sse_lock:
        for q in list(_sse_clients):
            try:
                q.put("reload")
            except Exception:
                pass


# ── Folder watcher (background thread) ─────────────────────────────────────

POLL_INTERVAL = 5  # seconds


def _load_sidecar(filename):
    """Detect infographic image for a single PDF (sidecars no longer used)."""
    base = os.path.splitext(filename)[0]
    image_path = None

    for ext in (".jpg", ".JPG", ".jpeg", ".JPEG"):
        jpg_path = os.path.join(PAPER_FOLDER, base + ext)
        if os.path.exists(jpg_path):
            image_path = PAPER_FOLDER + "/" + base + ext
            break

    return {"image_path": image_path}


def _infer_groups(filename):
    lower = filename.lower()
    groups = ["latest"]
    if "survey" in lower or "technical report" in lower or "benchmark" in lower:
        groups.append("read")
    return groups


def _import_pdf(filename):
    """Import a single PDF into the database (skips if already exists)."""
    paper_id = f"local-{slugify(filename)}"

    # If the paper already exists, only update image_path / pdf_path — preserve metadata
    existing = get_paper(paper_id)
    if existing:
        detected = _load_sidecar(filename)
        updates = {}
        pdf_path = f"{PAPER_FOLDER}/{filename}"
        if existing.get("pdf_path") != pdf_path:
            updates["pdf_path"] = pdf_path
            updates["link"] = pdf_path
        new_img = detected.get("image_path")
        if new_img and existing.get("image_path") != new_img:
            updates["image_path"] = new_img
        if updates:
            update_paper(paper_id, updates)
        return

    detected = _load_sidecar(filename)
    year = infer_year(filename)
    title = to_display_title(filename)
    groups = _infer_groups(filename)
    pdf_path = f"{PAPER_FOLDER}/{filename}"

    upsert_paper({
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
        "image_path": detected.get("image_path"),
        "source": "local",
    })


def watch_loop():
    """Background thread: polls the paper folder for new/removed PDFs and JPGs."""
    last_files = None      # sorted list of PDFs
    last_jpg_set = None    # set of JPG basenames (without extension)
    while True:
        try:
            all_entries = os.listdir(PAPER_FOLDER)
        except FileNotFoundError:
            all_entries = []

        files = sorted(f for f in all_entries if f.lower().endswith(".pdf"))
        jpg_set = set(
            os.path.splitext(f)[0]
            for f in all_entries
            if f.lower().endswith((".jpg", ".jpeg"))
        )

        changed = False

        if files != last_files:
            # Import any new PDFs
            old_set = set(last_files) if last_files is not None else set()
            for f in files:
                if f not in old_set:
                    _import_pdf(f)
                    print(f"  [watcher] Imported: {f}")
            changed = last_files is not None
            last_files = files

        # Detect new JPG infographics and re-import their PDFs
        if last_jpg_set is not None and jpg_set != last_jpg_set:
            new_jpgs = jpg_set - last_jpg_set
            for base in new_jpgs:
                # Find the matching PDF
                for f in files:
                    if os.path.splitext(f)[0] == base:
                        _import_pdf(f)
                        print(f"  [watcher] Re-imported (new infographic): {f}")
                        break
            changed = True
        last_jpg_set = jpg_set

        if changed:
            now = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"[{now}] Folder change detected — signalling browsers")
            notify_clients()

        time.sleep(POLL_INTERVAL)


# ── Authentication routes ───────────────────────────────────────────────────

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("serve_index"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        user = verify_user_csv(username, password)
        if user:
            login_user(User(user), remember=True)
            next_page = request.args.get("next") or url_for("serve_index")
            return redirect(next_page)
        else:
            return redirect(url_for("login", error="Invalid username or password"))

    return send_from_directory(".", "login.html")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


# ── Static file serving ────────────────────────────────────────────────────

@app.route("/")
@login_required
def serve_index():
    return send_from_directory(".", "index.html")


@app.route("/styles.css")
def serve_css():
    return send_from_directory(".", "styles.css")


@app.route("/app.js")
def serve_js():
    return send_from_directory(".", "app.js")


@app.route(f"/{PAPER_FOLDER}/<path:filename>")
def serve_paper(filename):
    return send_from_directory(PAPER_FOLDER, filename)


@app.route(f"/{KEYWORD_IMG_FOLDER}/<path:filename>")
def serve_keyword_image(filename):
    return send_from_directory(KEYWORD_IMG_FOLDER, filename)


# ── REST API: Papers ────────────────────────────────────────────────────────

@app.route("/api/papers", methods=["GET"])
@login_required
def api_list_papers():
    q = request.args.get("q", "").strip()
    if q:
        return jsonify(search_papers(q))
    return jsonify(get_all_papers())


@app.route("/api/papers/<paper_id>", methods=["GET"])
@login_required
def api_get_paper(paper_id):
    p = get_paper(paper_id)
    if not p:
        abort(404)
    return jsonify(p)


@app.route("/api/papers", methods=["POST"])
@login_required
def api_create_paper():
    """Upload a new paper (multipart/form-data with 'pdf' file + metadata fields)."""
    if "pdf" not in request.files:
        return jsonify({"error": "No PDF file provided"}), 400

    pdf_file = request.files["pdf"]
    if not pdf_file.filename or not pdf_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "File must be a PDF"}), 400

    filename = secure_filename(pdf_file.filename)
    # Preserve original name if secure_filename didn't mangle it too much
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"

    save_path = os.path.join(PAPER_FOLDER, filename)
    if os.path.exists(save_path):
        return jsonify({"error": "A paper with this filename already exists"}), 409

    pdf_file.save(save_path)

    # Build paper record from form fields + inference
    paper_id = f"local-{slugify(filename)}"
    year = request.form.get("year", type=int) or infer_year(filename)
    title = request.form.get("title", "").strip() or to_display_title(filename)

    paper = {
        "id": paper_id,
        "title": title,
        "authors": request.form.get("authors", "").strip(),
        "year": year,
        "groups": ["latest"],
        "pinned": 0,
        "preview": request.form.get("preview", "").strip(),
        "summary": request.form.get("summary", "").strip(),
        "datacenter": request.form.get("datacenter", "").strip(),
        "metrics": request.form.get("metrics", "").strip(),
        "link": f"{PAPER_FOLDER}/{filename}",
        "pdf_path": f"{PAPER_FOLDER}/{filename}",
        "image_path": None,
        "source": "local",
    }

    upsert_paper(paper)
    notify_clients()

    return jsonify(get_paper(paper_id)), 201


@app.route("/api/me")
@login_required
def api_me():
    """Return the current user's username and admin status."""
    return jsonify({"username": current_user.username, "is_admin": current_user.is_admin})


@app.route("/api/papers/<paper_id>", methods=["PUT"])
@login_required
def api_update_paper(paper_id):
    """Update metadata fields for an existing paper."""
    p = get_paper(paper_id)
    if not p:
        abort(404)

    fields = request.get_json(silent=True) or {}

    # Admin gate: only admins may add/remove the matts_picks tag
    new_groups = fields.get("groups")
    if isinstance(new_groups, list):
        old_has = "matts_picks" in (p.get("groups") or [])
        new_has = "matts_picks" in new_groups
        if old_has != new_has and not current_user.is_admin:
            return jsonify({"error": "Only admin users can change Matt's Recommended Reading"}), 403

    updated = update_paper(paper_id, fields)
    if updated is None:
        return jsonify({"error": "No valid fields provided"}), 400

    notify_clients()
    return jsonify(updated)


@app.route("/api/papers/<paper_id>", methods=["DELETE"])
@login_required
def api_delete_paper(paper_id):
    """Delete a paper from the database and remove its files from disk."""
    pdf_path, image_path = delete_paper(paper_id)
    if pdf_path is None and image_path is None:
        # Check if the paper existed at all
        if not get_paper(paper_id):
            abort(404)

    # Clean up files on disk
    if pdf_path and os.path.exists(pdf_path):
        os.remove(pdf_path)
    if image_path and os.path.exists(image_path):
        os.remove(image_path)

    notify_clients()
    return "", 204


# ── REST API: LLM Metadata Generation ──────────────────────────────────────

_METADATA_FIELDS = ("title", "authors", "year", "preview", "summary", "datacenter", "metrics")


@app.route("/api/papers/<paper_id>/generate-metadata", methods=["POST"])
@login_required
def api_generate_metadata(paper_id):
    """Use LLM to fill in blank metadata fields for an existing library paper."""
    paper = get_paper(paper_id)
    if not paper:
        return jsonify({"error": "Paper not found"}), 404

    pdf_path = paper.get("pdf_path", "")
    if not pdf_path or not os.path.exists(pdf_path):
        return jsonify({"error": "No local PDF available for this paper"}), 400

    # Determine which fields are blank
    blank_fields = [f for f in _METADATA_FIELDS if not str(paper.get(f) or "").strip()]
    if not blank_fields:
        return jsonify({"message": "All metadata fields are already populated", "paper": paper}), 200

    generated = _generate_metadata_from_pdf(
        pdf_path,
        title_hint=paper.get("title", ""),
        year_hint=paper.get("year", 2024),
    )
    if not generated:
        return jsonify({"error": "LLM metadata generation failed. Check Azure OpenAI configuration."}), 502

    # Only overwrite fields that are currently blank
    updates = {}
    for field in blank_fields:
        value = generated.get(field)
        if value is not None and str(value).strip():
            updates[field] = value

    if not updates:
        return jsonify({"message": "LLM could not generate any missing fields", "paper": paper}), 200

    updated = update_paper(paper_id, updates)
    notify_clients()
    return jsonify({
        "paper": updated,
        "fields_updated": list(updates.keys()),
    })


# ── REST API: Image Generation ──────────────────────────────────────────────

@app.route("/api/papers/<paper_id>/generate-infographic", methods=["POST"])
@login_required
def api_generate_infographic(paper_id):
    """Generate only the infographic for a library paper (Library View button)."""
    paper = get_paper(paper_id)
    if not paper:
        abort(404)

    result = {"image_path": None, "errors": []}
    try:
        info_path = _generate_infographic(paper, paper_id)
        if info_path:
            update_paper(paper_id, {"image_path": info_path})
            result["image_path"] = info_path
        else:
            result["errors"].append("Infographic generation returned no result")
    except Exception as e:
        result["errors"].append(f"Infographic generation failed: {e}")

    notify_clients()
    status = 200 if result["image_path"] else 502
    return jsonify(result), status


@app.route("/api/papers/<paper_id>/generate-images", methods=["POST"])
@login_required
def api_generate_images(paper_id):
    """Generate best-figure and infographic for a library paper."""
    paper = get_paper(paper_id)
    if not paper:
        abort(404)

    result = {"image_path": None, "errors": []}

    # Extract best figure from PDF
    pdf_path = paper.get("pdf_path", "")
    if pdf_path and os.path.exists(pdf_path):
        try:
            fig_path = _extract_best_figure(pdf_path, paper_id)
            if fig_path:
                update_paper(paper_id, {"image_path": fig_path})
                result["image_path"] = fig_path
            else:
                result["errors"].append("Best figure extraction returned no result")
        except Exception as e:
            result["errors"].append(f"Best figure extraction failed: {e}")
    else:
        result["errors"].append(f"PDF not found: {pdf_path}")

    # Generate infographic (overwrites best_figure if successful)
    try:
        info_path = _generate_infographic(paper, paper_id)
        if info_path:
            update_paper(paper_id, {"image_path": info_path})
            result["image_path"] = info_path
        else:
            result["errors"].append("Infographic generation returned no result (model may not support image generation)")
    except Exception as e:
        result["errors"].append(f"Infographic generation failed: {e}")

    notify_clients()

    status = 200 if result["image_path"] else 502
    return jsonify(result), status


@app.route("/api/discover/figure", methods=["POST"])
@login_required
def api_discover_figure():
    """Extract best figure from a discovery paper's PDF URL. Returns base64."""
    data = request.get_json(silent=True) or {}
    pdf_url = data.get("pdf_url", "").strip()
    if not pdf_url:
        return jsonify({"error": "pdf_url is required"}), 400

    # Convert arxiv abstract URLs to PDF URLs
    if "arxiv.org/abs/" in pdf_url:
        pdf_url = pdf_url.replace("arxiv.org/abs/", "arxiv.org/pdf/")
    elif "arxiv.org" in pdf_url and not pdf_url.endswith(".pdf"):
        import re as _re
        m = _re.search(r'(\d{4}\.\d{4,5})', pdf_url)
        if m:
            pdf_url = f"https://arxiv.org/pdf/{m.group(1)}"

    request_id = str(uuid.uuid4())

    try:
        result = _extract_figure_from_url(pdf_url)
        status = (result or {}).get("status") or "error"
        payload = {
            "status": status,
            "reason": (result or {}).get("reason", "unknown"),
            "message": (result or {}).get("message", ""),
            "request_id": request_id,
            "pdf_url": pdf_url,
            "figure_base64": (result or {}).get("figure_base64"),
            "page": (result or {}).get("page"),
            "bbox": (result or {}).get("bbox"),
            "bbox_found": bool((result or {}).get("bbox")),
            "model": (result or {}).get("model", "gpt-4o"),
            "confidence": (result or {}).get("confidence"),
        }
        if status in {"found", "none", "uncertain"}:
            return jsonify(payload), 200
        return jsonify(payload), 502
    except Exception as e:
        return jsonify({
            "status": "error",
            "reason": "exception",
            "message": str(e),
            "request_id": request_id,
            "pdf_url": pdf_url,
            "figure_base64": None,
            "bbox": None,
            "bbox_found": False,
        }), 500


def _normalize_manual_bbox(raw_bbox):
    """Validate and normalize a client-supplied bbox payload."""
    if not isinstance(raw_bbox, dict):
        return None
    try:
        x1 = max(0.0, min(1.0, float(raw_bbox.get("x1"))))
        y1 = max(0.0, min(1.0, float(raw_bbox.get("y1"))))
        x2 = max(0.0, min(1.0, float(raw_bbox.get("x2"))))
        y2 = max(0.0, min(1.0, float(raw_bbox.get("y2"))))
    except (TypeError, ValueError):
        return None

    width = x2 - x1
    height = y2 - y1
    if width < 0.05 or height < 0.05:
        return None
    if x1 >= x2 or y1 >= y2:
        return None

    return {
        "x1": round(x1, 4),
        "y1": round(y1, 4),
        "x2": round(x2, 4),
        "y2": round(y2, 4),
    }


def _normalize_bbox_loose(raw_bbox):
    """Normalize bbox without enforcing minimum area."""
    if not isinstance(raw_bbox, dict):
        return None
    try:
        x1 = max(0.0, min(1.0, float(raw_bbox.get("x1"))))
        y1 = max(0.0, min(1.0, float(raw_bbox.get("y1"))))
        x2 = max(0.0, min(1.0, float(raw_bbox.get("x2"))))
        y2 = max(0.0, min(1.0, float(raw_bbox.get("y2"))))
    except (TypeError, ValueError):
        return None
    if x1 >= x2 or y1 >= y2:
        return None
    return {
        "x1": round(x1, 4),
        "y1": round(y1, 4),
        "x2": round(x2, 4),
        "y2": round(y2, 4),
    }


def _normalize_discovery_pdf_url(pdf_url):
    """Convert discovery links to direct PDF URLs when possible."""
    if "arxiv.org/abs/" in pdf_url:
        return pdf_url.replace("arxiv.org/abs/", "arxiv.org/pdf/")
    if "arxiv.org" in pdf_url and not pdf_url.endswith(".pdf"):
        m = re.search(r'(\d{4}\.\d{4,5})', pdf_url)
        if m:
            return f"https://arxiv.org/pdf/{m.group(1)}"
    return pdf_url


def _download_pdf_to_temp(pdf_url):
    """Download a PDF URL to a temp file path or return an error message."""
    try:
        r = http_requests.get(pdf_url, timeout=30, proxies=_proxies, stream=True)
        if not r.ok:
            return None, f"Could not download PDF (HTTP {r.status_code})"
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            for chunk in r.iter_content(8192):
                tmp.write(chunk)
            return tmp.name, ""
    except Exception as e:
        return None, f"PDF download failed: {e}"


def _extract_page_image_from_url(pdf_url, page_num=0, base_bbox=None, dpi=220):
    """Download PDF and render requested page/region as JPEG data URL."""
    tmp_path, download_error = _download_pdf_to_temp(pdf_url)
    if not tmp_path:
        return {"error": download_error}

    try:
        doc = fitz.open(tmp_path)
        page_count = len(doc)
        if page_count <= 0:
            doc.close()
            return {"error": "PDF has no pages"}

        safe_idx = min(max(int(page_num or 0), 0), page_count - 1)
        page = doc[safe_idx]
        pw, ph = page.rect.width, page.rect.height
        clip_rect = fitz.Rect(0, 0, pw, ph)
        normalized_bbox = _normalize_bbox_loose(base_bbox) if base_bbox else {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0}
        if normalized_bbox:
            clip_rect = fitz.Rect(
                normalized_bbox["x1"] * pw,
                normalized_bbox["y1"] * ph,
                normalized_bbox["x2"] * pw,
                normalized_bbox["y2"] * ph,
            )

        render_dpi = max(96, min(int(dpi or 220), 300))
        mat = fitz.Matrix(render_dpi / 72, render_dpi / 72)
        pix = page.get_pixmap(matrix=mat, clip=clip_rect)
        img_bytes = pix.tobytes("jpeg", 90)
        doc.close()
        return {
            "image_base64": f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode('ascii')}",
            "page": safe_idx,
            "page_count": page_count,
            "base_bbox": normalized_bbox,
            "width": pix.width,
            "height": pix.height,
        }
    except Exception as e:
        return {"error": f"Page render failed: {e}"}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.route("/api/discover/figure/manual-bbox", methods=["POST"])
@login_required
def api_discover_figure_manual_bbox():
    """Accept a user-tuned manual bounding box for a discovery figure."""
    data = request.get_json(silent=True) or {}
    pdf_url = (data.get("pdf_url") or "").strip()
    manual_bbox = _normalize_manual_bbox(data.get("manual_bbox"))
    if not pdf_url:
        return jsonify({"error": "pdf_url is required"}), 400
    if manual_bbox is None:
        return jsonify({"error": "manual_bbox must be normalized 0..1 and at least 5% width/height"}), 400

    return jsonify({
        "ok": True,
        "bbox_validated": True,
        "bbox": manual_bbox,
    })


@app.route("/api/discover/pdf-page", methods=["POST"])
@login_required
def api_discover_pdf_page():
    """Render a specific paper page (or page region) for modal editing."""
    data = request.get_json(silent=True) or {}
    pdf_url = (data.get("pdf_url") or "").strip()
    if not pdf_url:
        return jsonify({"error": "pdf_url is required"}), 400

    normalized_url = _normalize_discovery_pdf_url(pdf_url)
    result = _extract_page_image_from_url(
        normalized_url,
        data.get("page", 0),
        base_bbox=data.get("base_bbox"),
        dpi=data.get("dpi", 220),
    )
    if result.get("error"):
        return jsonify({"error": result.get("error")}), 502
    return jsonify(result)


# ── REST API: AI-Powered Discovery ──────────────────────────────────────────

PROXY_URL = os.environ.get("HTTP_PROXY", "http://proxy-dmz.intel.com:912")
_proxies = {"http": PROXY_URL, "https": PROXY_URL}

# In-memory discovery cache — discovery results are NOT stored in the DB.
# Users add papers to the library explicitly via /api/papers/import-discovery.
_discovery_cache = {}
_discovery_cache_lock = threading.Lock()

_DISCOVERY_QUERIES = [
    "LLM transformer architecture mixture of experts attention mechanism",
    "large language model inference serving GPU efficiency",
    "mixture of experts sparse neural network scaling",
    "flash attention KV cache transformer memory optimization",
    "LLM quantization compression fine-tuning efficiency",
    "distributed training data parallelism model architecture",
    "AI inference throughput latency serving datacenter optimization",
    "foundation model pretraining scaling laws emergent capabilities",
    "agentic AI autonomous LLM agents planning tool use multi-agent systems",
    "dataflow architecture AI accelerator systolic array neural network hardware",
    "AMD GPU AI accelerator ROCm CDNA MI300 machine learning architecture",
    "Nvidia next generation GPU architecture AI HPC accelerator interconnect",
]
_discovery_query_index = 0
_index_lock = threading.Lock()
_RANK_LOG_SNIPPET_CHARS = 700
_DISCOVERY_PROGRESS_LOCK = threading.Lock()
_DISCOVERY_PROGRESS = {}

# CORE Paper Repository token relevance controls.
_CORE_ENABLE_TOKEN_FILTER = True
_CORE_TOKEN_FILTER_MODE = "soft"  # soft | off
_CORE_MIN_TOKEN_MATCH_RATIO = 0.34
_CORE_MIN_TOKEN_MATCH_COUNT = 1


def _default_discovery_progress():
    return {
        "stage": "idle",
        "active": False,
        "processed": 0,
        "total": 0,
        "found": 0,
        "source_counts": {"core-pr": 0, "openalex": 0, "arxiv": 0},
        "message": "Ready",
        "query": "",
        "updated_at": 0.0,
    }


def _set_discovery_progress(user_key, **updates):
    with _DISCOVERY_PROGRESS_LOCK:
        current = dict(_DISCOVERY_PROGRESS.get(user_key) or _default_discovery_progress())
        current.update(updates)
        current["updated_at"] = time.time()
        _DISCOVERY_PROGRESS[user_key] = current
        return dict(current)


def _get_discovery_progress(user_key):
    with _DISCOVERY_PROGRESS_LOCK:
        return dict(_DISCOVERY_PROGRESS.get(user_key) or _default_discovery_progress())


def _count_source_counts(papers):
    counts = {"core-pr": 0, "openalex": 0, "arxiv": 0}
    for paper in papers or []:
        source = (paper.get("source") or "").strip().lower()
        if source in counts:
            counts[source] += 1
    return counts

_RANKING_TEAMS = {
    "oie": "OIE - AI on GPU Optimization",
    "e2o": "E2O - Network, Switch, Optical",
    "ai_on_ia": "AI on iA - Agentic and Head Node CPU Optimization",
    "hickory_delta": "Federal Research - Cache, Reliability, Wafer Scale",
}

_ARCH_SCORE_WEIGHTS = {
    "compute_arch_fit": 0.24,
    "memory_hierarchy_impact": 0.20,
    "cluster_scalability": 0.20,
    "implementation_readiness": 0.18,
    "efficiency_tco": 0.18,
}

_ARCH_SCORE_KEYS = list(_ARCH_SCORE_WEIGHTS.keys())

_TEAM_DEFAULT_CRITERIA_QUESTIONS = {
    "oie": {
        "compute_arch_fit": "Does this work show measurable gains in GPU utilization, throughput, or latency on modern accelerator stacks?",
        "memory_hierarchy_impact": "How effectively does it reduce pressure in HBM, cache, KV cache, or activation memory footprints?",
        "cluster_scalability": "Are results validated at realistic scale with multi-GPU or multi-node communication effects included?",
        "implementation_readiness": "Does it provide deployable kernel, runtime, or scheduling details that can be implemented in production?",
        "efficiency_tco": "What is the performance gain versus accuracy, power, complexity, and cost tradeoff?",
    },
    "e2o": {
        "compute_arch_fit": "Does the proposal directly improve network, switch, or optical handling of AI workload traffic patterns?",
        "memory_hierarchy_impact": "How does it impact data movement pressure between endpoints, buffers, and memory-adjacent network paths?",
        "cluster_scalability": "How well does the architecture scale across pods and fabrics under all-reduce, all-to-all, or inference fan-out traffic?",
        "implementation_readiness": "Does it address deployment constraints like protocol compatibility, observability, and failure handling?",
        "efficiency_tco": "What is the expected datacenter-level performance-per-dollar and power-per-bit impact?",
    },
    "ai_on_ia": {
        "compute_arch_fit": "Does this work improve CPU-side orchestration for agentic workflows such as tool calls, planning loops, or routing?",
        "memory_hierarchy_impact": "Does it address head-node memory locality, serialization overhead, and I/O bottlenecks on CPU critical paths?",
        "cluster_scalability": "How well does it handle bursty multi-agent loads while maintaining predictable end-to-end latency?",
        "implementation_readiness": "Is the approach production-ready for debuggability, security boundaries, and fault isolation?",
        "efficiency_tco": "Does it improve CPU-GPU partitioning efficiency and reduce orchestration overhead at cluster scale?",
    },
    "hickory_delta": {
        "compute_arch_fit": "Does it introduce a meaningful architectural mechanism in cache, coherence, dataflow, or wafer-scale compute design?",
        "memory_hierarchy_impact": "How strong is the paper's contribution to memory hierarchy efficiency or data movement reduction?",
        "cluster_scalability": "Does the evaluation credibly address scale constraints such as interconnect limits, thermals, and manufacturability?",
        "implementation_readiness": "Is the methodology rigorous enough for research translation, including realistic fault and sensitivity analysis?",
        "efficiency_tco": "Does this direction have strong long-horizon impact potential versus complexity and risk?",
    },
}


def _normalize_ranking_team(team_value):
    raw = str(team_value or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "oie": "oie",
        "e2o": "e2o",
        "ai_on_ia": "ai_on_ia",
        "aionia": "ai_on_ia",
        "ai_onia": "ai_on_ia",
        "hickory_delta": "hickory_delta",
        "hickorydelta": "hickory_delta",
    }
    team = aliases.get(raw, raw)
    if team in _RANKING_TEAMS:
        return team
    return None


def _default_slider_values_from_weights():
    if not _ARCH_SCORE_WEIGHTS:
        return {}
    max_w = max(_ARCH_SCORE_WEIGHTS.values()) or 1.0
    sliders = {}
    for key in _ARCH_SCORE_KEYS:
        raw = _ARCH_SCORE_WEIGHTS.get(key, 0.0)
        if raw <= 0:
            sliders[key] = 0.0
            continue
        scaled = (raw / max_w) * 10.0
        sliders[key] = round(max(1.0, min(10.0, scaled)), 1)
    return sliders


_SESSION_RANKING_LOCK = threading.Lock()
_SESSION_CRITERIA_QUESTIONS_BY_TEAM = {
    team_id: dict(_TEAM_DEFAULT_CRITERIA_QUESTIONS[team_id])
    for team_id in _RANKING_TEAMS.keys()
}
_SESSION_CRITERIA_SLIDERS_BY_TEAM = {
    team_id: _default_slider_values_from_weights()
    for team_id in _RANKING_TEAMS.keys()
}


def _reset_session_ranking_criteria(team_id=None):
    with _SESSION_RANKING_LOCK:
        if team_id:
            _SESSION_CRITERIA_QUESTIONS_BY_TEAM[team_id] = dict(_TEAM_DEFAULT_CRITERIA_QUESTIONS[team_id])
            _SESSION_CRITERIA_SLIDERS_BY_TEAM[team_id] = _default_slider_values_from_weights()
            return
        for tid in _RANKING_TEAMS.keys():
            _SESSION_CRITERIA_QUESTIONS_BY_TEAM[tid] = dict(_TEAM_DEFAULT_CRITERIA_QUESTIONS[tid])
            _SESSION_CRITERIA_SLIDERS_BY_TEAM[tid] = _default_slider_values_from_weights()


def _get_session_ranking_config(team_id):
    with _SESSION_RANKING_LOCK:
        keys = list(_ARCH_SCORE_KEYS)
        team_questions = _SESSION_CRITERIA_QUESTIONS_BY_TEAM.get(team_id) or dict(_TEAM_DEFAULT_CRITERIA_QUESTIONS[team_id])
        team_sliders = _SESSION_CRITERIA_SLIDERS_BY_TEAM.get(team_id) or _default_slider_values_from_weights()
        sliders = {k: float(team_sliders.get(k, 0.0)) for k in keys}
        slider_sum = sum(v for v in sliders.values() if v > 0)
        if slider_sum <= 0:
            equal = 1.0 / len(keys) if keys else 0.0
            weights = {k: equal for k in keys}
        else:
            weights = {k: (sliders[k] / slider_sum if sliders[k] > 0 else 0.0) for k in keys}
        questions = {k: (team_questions.get(k) or _TEAM_DEFAULT_CRITERIA_QUESTIONS[team_id].get(k, k)) for k in keys}
    return {
        "team": team_id,
        "team_label": _RANKING_TEAMS.get(team_id, team_id),
        "keys": keys,
        "questions": questions,
        "sliders": sliders,
        "weights": weights,
    }


@app.route("/api/discover/ranking-criteria", methods=["GET"])
@login_required
def api_discover_ranking_criteria():
    """Return question text and weights used by architecture ranking."""
    team_id = _normalize_ranking_team(request.args.get("team"))
    if not team_id:
        return jsonify({"error": "team is required and must be one of: oie, e2o, ai_on_ia, hickory_delta"}), 400

    cfg = _get_session_ranking_config(team_id)
    criteria = []
    for key in cfg["keys"]:
        criteria.append({
            "key": key,
            "question": cfg["questions"].get(key, key.replace("_", " ").capitalize()),
            "slider": round(float(cfg["sliders"].get(key, 0.0)), 1),
            "weight": cfg["weights"].get(key, 0.0),
            "weight_percent": round(cfg["weights"].get(key, 0.0) * 100, 1),
        })
    resp = jsonify({"team": team_id, "team_label": cfg["team_label"], "criteria": criteria})
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


@app.route("/api/discover/ranking-criteria", methods=["POST"])
@login_required
def api_update_discover_ranking_criteria():
    """Update session ranking criteria questions and slider values."""
    data = request.get_json(silent=True) or {}
    team_id = _normalize_ranking_team(data.get("team"))
    if not team_id:
        return jsonify({"error": "team is required and must be one of: oie, e2o, ai_on_ia, hickory_delta"}), 400

    if data.get("reset_defaults"):
        _reset_session_ranking_criteria(team_id)
        cfg = _get_session_ranking_config(team_id)
        criteria = []
        for key in cfg["keys"]:
            criteria.append({
                "key": key,
                "question": cfg["questions"].get(key, key),
                "slider": round(float(cfg["sliders"].get(key, 0.0)), 1),
                "weight": cfg["weights"].get(key, 0.0),
                "weight_percent": round(cfg["weights"].get(key, 0.0) * 100, 1),
            })
        resp = jsonify({"team": team_id, "team_label": cfg["team_label"], "criteria": criteria})
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        return resp

    items = data.get("criteria")
    if not isinstance(items, list) or not items:
        return jsonify({"error": "criteria list is required"}), 400

    allowed_keys = set(_ARCH_SCORE_KEYS)
    with _SESSION_RANKING_LOCK:
        team_questions = _SESSION_CRITERIA_QUESTIONS_BY_TEAM.setdefault(team_id, dict(_TEAM_DEFAULT_CRITERIA_QUESTIONS[team_id]))
        team_sliders = _SESSION_CRITERIA_SLIDERS_BY_TEAM.setdefault(team_id, _default_slider_values_from_weights())
        for item in items:
            if not isinstance(item, dict):
                continue
            key = str(item.get("key") or "").strip()
            if key not in allowed_keys:
                continue

            if "question" in item:
                q = str(item.get("question") or "").strip()
                if q:
                    team_questions[key] = q[:300]

            if "slider" in item:
                try:
                    slider = float(item.get("slider"))
                except (TypeError, ValueError):
                    slider = team_sliders.get(key, 0.0)
                team_sliders[key] = max(0.0, min(10.0, round(slider, 1)))

    cfg = _get_session_ranking_config(team_id)
    criteria = []
    for key in cfg["keys"]:
        criteria.append({
            "key": key,
            "question": cfg["questions"].get(key, key),
            "slider": round(float(cfg["sliders"].get(key, 0.0)), 1),
            "weight": cfg["weights"].get(key, 0.0),
            "weight_percent": round(cfg["weights"].get(key, 0.0) * 100, 1),
        })
    resp = jsonify({"ok": True, "team": team_id, "team_label": cfg["team_label"], "criteria": criteria})
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


@app.route("/api/discover/progress", methods=["GET"])
@login_required
def api_discover_progress():
    user_key = str(current_user.get_id() or getattr(current_user, "username", "anon"))
    return jsonify(_get_discovery_progress(user_key))

# ── Azure OpenAI config loader ──────────────────────────────────────────────

_AZURE_CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "azure_openai_config.txt")

def _load_azure_config():
    """Read azure_openai_config.txt and return a dict with endpoint, api_key, deployment, api_version."""
    if not os.path.exists(_AZURE_CONFIG_FILE):
        return None
    cfg = {}
    with open(_AZURE_CONFIG_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or "=" not in line:
                continue
            key, _, value = line.partition("=")
            cfg[key.strip()] = value.strip()
    if not cfg.get("api_key") or cfg["api_key"] == "REPLACE_WITH_YOUR_KEY_VALUE_HERE":
        return None
    return cfg

_azure_cfg = _load_azure_config()
_azure_client = None

def _get_azure_client():
    """Lazy-init the AzureOpenAI client."""
    global _azure_client, _azure_cfg
    if _azure_client is not None:
        return _azure_client
    if _azure_cfg is None:
        _azure_cfg = _load_azure_config()
    if _azure_cfg is None:
        return None
    _azure_client = AzureOpenAI(
        azure_endpoint=_azure_cfg["endpoint"],
        api_key=_azure_cfg["api_key"],
        api_version=_azure_cfg.get("api_version", "2025-01-01-preview"),
    )
    return _azure_client

# ── Image extraction / generation helpers ───────────────────────────────────

GENERATED_IMG_DIR = os.path.join(PAPER_FOLDER, "generated")
os.makedirs(GENERATED_IMG_DIR, exist_ok=True)


def _render_pdf_pages(pdf_path, dpi=150, max_pages=20):
    """Render PDF pages as JPEG bytes. Returns list of (page_num, jpeg_bytes)."""
    doc = fitz.open(pdf_path)
    pages = []
    for i in range(min(len(doc), max_pages)):
        page = doc[i]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        pages.append((i, pix.tobytes("jpeg", 80)))
    doc.close()
    return pages


def _pdf_has_visual_content(pdf_path, max_pages=10):
    """Best-effort check for non-text visual content in a PDF."""
    try:
        doc = fitz.open(pdf_path)
    except Exception:
        return None

    try:
        for i in range(min(len(doc), max_pages)):
            page = doc[i]
            image_count = len(page.get_images(full=True) or [])
            drawing_count = len(page.get_drawings() or [])
            if image_count > 0 or drawing_count > 10:
                return True
        return False
    finally:
        doc.close()


def _crop_figure_from_page(pdf_path, page_num, client, deployment, feedback_summary=None):
    """Extract the best figure image from a PDF page.

    Strategy (in order):
    1. Use GPT-4o vision to get a bounding box around the most important
       graphical content on the page, then crop the rendered page.
    2. If that fails, return the full page.
    """
    doc = fitz.open(pdf_path)
    page = doc[min(page_num, len(doc) - 1)]

    # GPT-4o vision bounding box ───────────────────────────────────
    print(f"  [Image] Using GPT-4o bbox on page {page_num}")
    medium_dpi = 150
    mat = fitz.Matrix(medium_dpi / 72, medium_dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    medium_bytes = pix.tobytes("jpeg", 80)
    b64 = base64.b64encode(medium_bytes).decode("ascii")

    content = [
        {"type": "text", "text": (
            "This is a page from an academic paper. "
            "Identify the single MOST IMPORTANT figure, diagram, chart, or architecture illustration on this page. "
            "I need the bounding box of ONLY the graphical/visual content — "
            "DO NOT include the figure caption text (e.g. 'Figure 1: ...'), "
            "DO NOT include any body text paragraphs above or below the figure, "
            "DO NOT include figure numbers or labels outside the diagram itself. "
            "The box should tightly wrap just the drawn diagram, chart, or image. "
            "Return normalised coordinates where (0,0) is the top-left and (1,1) is the bottom-right of the page. "
            "Return ONLY a JSON object: "
            "{\"x1\": <left>, \"y1\": <top>, \"x2\": <right>, \"y2\": <bottom>}"
        )},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"}},
    ]

    if feedback_summary and feedback_summary.get("bad_count", 0) > feedback_summary.get("good_count", 0):
        content[0]["text"] += (
            " Prior feedback indicates earlier crops were often too loose or included text. "
            "Be stricter: tightly isolate only the diagram pixels and exclude captions/body text."
        )

    bbox = None
    try:
        completion = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": content}],
            max_tokens=150,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        data = json.loads(completion.choices[0].message.content)
        x1, y1 = float(data["x1"]), float(data["y1"])
        x2, y2 = float(data["x2"]), float(data["y2"])
        # Sanity checks
        if 0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1 and (x2 - x1) > 0.05 and (y2 - y1) > 0.05:
            bbox = (x1, y1, x2, y2)
    except Exception as e:
        print(f"  [Image] Bounding-box detection failed: {e}")
        doc.close()
        return None, None

    if bbox is None:
        doc.close()
        return None, None

    # ── Render cropped region ─────────────────────────────────────
    render_dpi = 300
    x1, y1, x2, y2 = bbox
    pw, ph = page.rect.width, page.rect.height
    clip = fitz.Rect(x1 * pw, y1 * ph, x2 * pw, y2 * ph)
    mat = fitz.Matrix(render_dpi / 72, render_dpi / 72)
    pix = page.get_pixmap(matrix=mat, clip=clip)

    result = pix.tobytes("jpeg", 92)
    doc.close()
    x1, y1, x2, y2 = bbox
    bbox_payload = {
        "x1": round(x1, 4),
        "y1": round(y1, 4),
        "x2": round(x2, 4),
        "y2": round(y2, 4),
    }
    return result, bbox_payload


def _extract_best_figure(pdf_path, paper_id):
    """Use GPT-4o vision to find the best figure page, save it as JPEG. Returns relative path or None."""
    client = _get_azure_client()
    if client is None:
        return None
    deployment = (_azure_cfg or {}).get("deployment", "gpt-4o")

    pages = _render_pdf_pages(pdf_path, dpi=100, max_pages=15)
    if not pages:
        return None

    # Build vision content: send thumbnails of all pages
    content = [{"type": "text", "text": (
        "You are analyzing pages from an academic paper PDF. "
        "Each image is a page from the paper. "
        "Which page number (0-indexed) contains the MOST IMPORTANT figure, "
        "diagram, or chart that best illustrates the paper's primary contribution or architecture? "
        "Prefer architecture diagrams, system overviews, and result charts over tables of numbers. "
        "Skip the title page and pages that are mostly text. "
        f"There are {len(pages)} pages (numbered 0 to {len(pages)-1}). "
        "Return ONLY a JSON object: {\"page\": <number>, \"reason\": \"<brief reason>\"}"
    )}]
    for page_num, jpeg_bytes in pages:
        b64 = base64.b64encode(jpeg_bytes).decode("ascii")
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"}
        })

    try:
        completion = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": content}],
            max_tokens=200,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content
        data = json.loads(raw)
        best_page = int(data.get("page", 1))
    except Exception as e:
        print(f"  [Image] Vision best-figure failed for {paper_id}: {e}")
        return None

    # Crop just the figure from the chosen page and save
    hq_bytes, _ = _crop_figure_from_page(pdf_path, best_page, client, deployment)
    if hq_bytes is None:
        return None
    safe_id = re.sub(r'[^a-z0-9_-]', '_', paper_id)
    filename = f"{safe_id}_figure.jpg"
    save_path = os.path.join(GENERATED_IMG_DIR, filename)
    with open(save_path, "wb") as f:
        f.write(hq_bytes)

    return f"{PAPER_FOLDER}/generated/{filename}"


def _generate_infographic(paper_dict, paper_id):
    """Use Azure OpenAI image generation to create an infographic. Returns relative path or None."""
    client = _get_azure_client()
    if client is None:
        return None

    prompt = (
        "Generate a detailed high-resolution JPEG Infographic in landscape mode with a white background "
        "that illustrates the primary point of emphasis of the white paper titled "
        f"\"{paper_dict.get('title', 'AI Research Paper')}\". "
        f"Key contribution: {paper_dict.get('summary', '')[:300]}. "
        f"Datacenter relevance: {paper_dict.get('datacenter', '')[:200]}. "
        f"Key metrics: {paper_dict.get('metrics', '')[:150]}. "
        "The audience for the infographic is AI System Architects, Hardware & Software Engineers, "
        "and Technical Leaders. Be sure to include in the diagram enough detailed specifics."
    )

    safe_id = re.sub(r'[^a-z0-9_-]', '_', paper_id)
    filename = f"{safe_id}_infographic.jpg"
    save_path = os.path.join(GENERATED_IMG_DIR, filename)
    rel_path = f"{PAPER_FOLDER}/generated/{filename}"

    # Try gpt-4o image generation first, then dall-e-3 fallback
    for model_name in ["gpt-4o", "dall-e-3"]:
        try:
            response = client.images.generate(
                model=model_name,
                prompt=prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            image_url = response.data[0].url
            if image_url:
                # Download the generated image
                img_response = http_requests.get(image_url, timeout=30, proxies={})
                if img_response.ok:
                    with open(save_path, "wb") as f:
                        f.write(img_response.content)
                    print(f"  [Image] Infographic generated via {model_name} for {paper_id}")
                    return rel_path
            # If response has b64_json instead of url
            b64_data = getattr(response.data[0], 'b64_json', None)
            if b64_data:
                with open(save_path, "wb") as f:
                    f.write(base64.b64decode(b64_data))
                print(f"  [Image] Infographic generated via {model_name} (b64) for {paper_id}")
                return rel_path
        except Exception as e:
            print(f"  [Image] Infographic via {model_name} failed for {paper_id}: {e}")
            continue

    return None


def _extract_figure_from_url(pdf_url):
    """Download a PDF from URL, extract best figure, return base64 + extraction metadata."""
    client = _get_azure_client()
    if client is None:
        return {
            "status": "error",
            "reason": "ai_unavailable",
            "message": "Figure extraction AI is not configured.",
        }

    # Download PDF to temp file
    try:
        r = http_requests.get(pdf_url, timeout=30, proxies=_proxies, stream=True)
        if not r.ok:
            return {
                "status": "error",
                "reason": "network_error",
                "message": f"Could not download PDF (HTTP {r.status_code}).",
            }
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            for chunk in r.iter_content(8192):
                tmp.write(chunk)
            tmp_path = tmp.name
    except Exception as e:
        print(f"  [Image] PDF download failed: {e}")
        return {
            "status": "error",
            "reason": "network_error",
            "message": f"PDF download failed: {e}",
        }

    try:
        deployment = (_azure_cfg or {}).get("deployment", "gpt-4o")
        pages = _render_pdf_pages(tmp_path, dpi=100, max_pages=10)
        if not pages:
            return {
                "status": "none",
                "reason": "no_pages",
                "message": "No readable pages were found in this document.",
                "model": deployment,
            }

        has_visual_content = _pdf_has_visual_content(tmp_path, max_pages=10)
        if has_visual_content is False:
            return {
                "status": "none",
                "reason": "text_only",
                "message": "No figure-like visual content was detected in this paper.",
                "model": deployment,
            }

        content = [{"type": "text", "text": (
            "You are analyzing pages from an academic paper PDF. "
            "Which page number (0-indexed) contains the MOST IMPORTANT figure or diagram? "
            f"There are {len(pages)} pages (numbered 0 to {len(pages)-1}). "
            "Return ONLY a JSON object: {\"page\": <number>}"
        )}]
        for page_num, jpeg_bytes in pages:
            b64 = base64.b64encode(jpeg_bytes).decode("ascii")
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"}
            })

        try:
            completion = client.chat.completions.create(
                model=deployment,
                messages=[{"role": "user", "content": content}],
                max_tokens=100,
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            data = json.loads(completion.choices[0].message.content)
            best_page = int(data.get("page", 1))
        except Exception as e:
            return {
                "status": "error",
                "reason": "ai_page_selection_failed",
                "message": f"AI failed to select best figure page: {e}",
            }

        hq_bytes, bbox_payload = _crop_figure_from_page(
            tmp_path,
            best_page,
            client,
            deployment,
        )
        if hq_bytes is None:
            return {
                "status": "error",
                "reason": "figure_extraction_failed",
                "message": "AI figure extraction failed: bounding box detection did not succeed.",
            }
        b64_str = base64.b64encode(hq_bytes).decode("ascii")
        outcome = {
            "status": "found",
            "reason": "detected_figure",
            "message": "Figure located and extracted.",
            "figure_base64": f"data:image/jpeg;base64,{b64_str}",
            "page": int(best_page),
            "bbox": bbox_payload,
            "model": deployment,
        }
        print(
            f"  [Image] Discovery figure outcome: status={outcome['status']}, "
            f"reason={outcome['reason']}, page={outcome.get('page')}, bbox_found={bool(outcome.get('bbox'))}"
        )
        return outcome
    except Exception as e:
        print(f"  [Image] Discovery figure extraction failed: {e}")
        return {
            "status": "error",
            "reason": "extract_failed",
            "message": f"Figure extraction failed: {e}",
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _make_external_id(source, title, year, suffix=""):
    token = f"{title}-{year}-{suffix or source}"
    return f"{source}-{slugify(token)}"


def _paper_to_external_record(*, source, title, authors, year, preview, summary, datacenter, metrics,
                              link, pdf_url="", citation_count=0, sources=None, indexed_query=""):
    sources = sources or [source]
    canonical_title = (title or "Untitled discovery paper").strip()
    safe_year = int(year or datetime.datetime.now().year)
    return {
        "id": _make_external_id(source, canonical_title, safe_year),
        "title": canonical_title,
        "authors": authors or "",
        "year": safe_year,
        "preview": preview or (summary[:148] if summary else ""),
        "summary": summary or preview or "",
        "datacenter": datacenter or "",
        "metrics": metrics or "",
        "source": source,
        "sources": sources,
        "link": link or pdf_url or "",
        "pdf_url": pdf_url or "",
        "citation_count": int(citation_count or 0),
        "verified_by_ai": True,
        "indexed_query": indexed_query,
        "_pubDate": f"{safe_year}-01-01",
        "isDiscovery": True,
    }


_SEARCH_STOPWORDS = {
    "a", "an", "and", "at", "by", "for", "from", "in", "into", "of",
    "on", "or", "the", "to", "via", "with", "using",
}


def _query_keyword_tokens(query_text, limit=6):
    tokens = []
    seen = set()
    for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9+\-]*", (query_text or "").lower()):
        if token in _SEARCH_STOPWORDS or len(token) < 2 or token in seen:
            continue
        seen.add(token)
        tokens.append(token)
        if len(tokens) >= limit:
            break
    return tokens


def _query_keyword_text(query_text):
    return " ".join(_query_keyword_tokens(query_text))


def _dedupe_strings(values):
    seen = set()
    deduped = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


def _token_overlap_stats(required_tokens, search_corpus):
    if not required_tokens:
        return {
            "match_count": 0,
            "total_tokens": 0,
            "match_ratio": 1.0,
            "matched_tokens": [],
        }
    matched_tokens = [token for token in required_tokens if token in search_corpus]
    match_count = len(matched_tokens)
    total_tokens = len(required_tokens)
    return {
        "match_count": match_count,
        "total_tokens": total_tokens,
        "match_ratio": (match_count / total_tokens) if total_tokens else 1.0,
        "matched_tokens": matched_tokens,
    }


def _fetch_core_pr_candidates(query_text, year_from, year_to, limit=10):
    results = []
    required_tokens = _query_keyword_tokens(query_text)
    search_variants = _dedupe_strings([
        _query_keyword_text(query_text),
        (query_text or "").strip(),
    ])
    print(
        f"[Index] [CORE] Starting: query='{query_text}', year=[{year_from},{year_to}], "
        f"variants={len(search_variants)}, mode={_CORE_TOKEN_FILTER_MODE}, required_tokens={required_tokens}"
    )

    soft_mode_enabled = bool(_CORE_ENABLE_TOKEN_FILTER and _CORE_TOKEN_FILTER_MODE == "soft")
    ratio_threshold = max(0.0, min(1.0, float(_CORE_MIN_TOKEN_MATCH_RATIO)))
    min_count_threshold = max(1, int(_CORE_MIN_TOKEN_MATCH_COUNT))
    any_variant_ok = False
    last_error_code = None

    for variant_idx, search_text in enumerate(search_variants, 1):
        if not search_text:
            continue

        print(f"[Index] [CORE] Variant {variant_idx}: '{search_text}'")
        try:
            r = http_requests.get(
                "https://api.core.ac.uk/v3/search/works",
                params={
                    "q": search_text,
                    "limit": limit,
                    "offset": 0,
                },
                timeout=15,
                proxies=_proxies,
            )
        except Exception as variant_err:
            print(f"[Index] [CORE] Variant {variant_idx} request failed: {variant_err}")
            continue
        if not r.ok:
            print(f"[Index] [CORE] Variant {variant_idx} HTTP {r.status_code}: {r.reason}")
            last_error_code = r.status_code
            continue
        any_variant_ok = True

        payload = r.json() or {}
        raw_data = payload.get("results", [])
        print(f"[Index] [CORE] Variant {variant_idx}: Raw API response: {len(raw_data)} papers")
        year_dropped = 0
        token_dropped = 0
        variant_passed = 0
        accepted_ratio_sum = 0.0
        dropped_samples = []

        for entry in raw_data:
            title = (entry.get("title") or "").strip()
            if not title:
                continue

            year = int(entry.get("yearPublished") or datetime.datetime.now().year)
            if year < year_from or year > year_to:
                year_dropped += 1
                continue

            authors = ", ".join(
                a.get("name", "") if isinstance(a, dict) else str(a)
                for a in (entry.get("authors") or [])[:4]
            )
            summary = _clean_abstract(entry.get("abstract") or "")
            journals = entry.get("journals") or []
            venue = ""
            if journals and isinstance(journals[0], dict):
                venue = (journals[0].get("title") or "").strip()
            search_corpus = " ".join([title, authors, summary, venue]).lower()
            overlap = _token_overlap_stats(required_tokens, search_corpus)

            if soft_mode_enabled and overlap["total_tokens"] > 0:
                ratio_needed = int(overlap["total_tokens"] * ratio_threshold + 0.9999)
                min_needed = max(min_count_threshold, ratio_needed)
                if overlap["total_tokens"] <= 2:
                    min_needed = 1
                if overlap["match_count"] < min_needed:
                    token_dropped += 1
                    if len(dropped_samples) < 3:
                        dropped_samples.append(
                            f"'{title[:60]}' ({overlap['match_count']}/{overlap['total_tokens']})"
                        )
                    continue

            doi = (entry.get("doi") or "").strip()
            download_url = (entry.get("downloadUrl") or "").strip()
            links = entry.get("links") or []
            display_url = ""
            if isinstance(links, list):
                for candidate in links:
                    if isinstance(candidate, dict) and candidate.get("type") == "display":
                        display_url = (candidate.get("url") or "").strip()
                        break
            pdf_url = _normalize_discovery_pdf_url(download_url)
            link = pdf_url or (f"https://doi.org/{doi}" if doi else "") or display_url or ""
            results.append(_paper_to_external_record(
                source="core-pr",
                title=title,
                authors=authors or "CORE Paper Repository",
                year=year,
                preview=summary[:148],
                summary=summary,
                datacenter="",
                metrics="",
                link=link,
                pdf_url=pdf_url,
                citation_count=entry.get("citationCount", 0),
                sources=["core-pr"],
                indexed_query=search_text,
            ))
            variant_passed += 1
            accepted_ratio_sum += overlap["match_ratio"]

        avg_ratio = (accepted_ratio_sum / variant_passed) if variant_passed else 0.0
        print(
            f"[Index] [CORE] Variant {variant_idx}: {len(raw_data)} raw → "
            f"{year_dropped} year-filtered → {token_dropped} token-filtered → {variant_passed} passed "
            f"(avg_match_ratio={avg_ratio:.2f})"
        )
        if dropped_samples:
            print(f"[Index] [CORE] Variant {variant_idx} token drops (sample): {', '.join(dropped_samples)}")
    print(f"[Index] [CORE] Complete: {len(results)} total papers from all variants")
    if not any_variant_ok and search_variants:
        if last_error_code == 429:
            error = "Rate limited"
        elif last_error_code:
            error = f"HTTP {last_error_code}"
        else:
            error = "Unreachable"
    else:
        error = None
    return results, error


def _fetch_openalex_candidates(query_text, year_from, year_to, limit=10):
    try:
        oa_filter = f"publication_date:>{year_from-1}-12-31,publication_date:<{year_to+1}-01-01"
        results = []
        search_variants = _dedupe_strings([
            _query_keyword_text(query_text),
            (query_text or "").strip(),
        ])
        any_variant_ok = False
        last_error_code = None
        print(f"[Index] [OA] Starting: query='{query_text}', year=[{year_from},{year_to}], variants={len(search_variants)}")

        for variant_idx, search_text in enumerate(search_variants, 1):
            if not search_text:
                continue
            print(f"[Index] [OA] Variant {variant_idx}: '{search_text}'")

            r = http_requests.get(
                "https://api.openalex.org/works",
                params={"search": search_text, "sort": "publication_date:desc",
                        "filter": oa_filter, "per-page": str(limit)},
                headers={"Accept": "application/json"},
                timeout=15,
                proxies=_proxies,
            )
            if not r.ok:
                print(f"[Index] [OA] Variant {variant_idx} HTTP {r.status_code}: {r.reason}")
                last_error_code = r.status_code
                continue
            any_variant_ok = True

            raw_data = r.json().get("results", [])
            print(f"[Index] [OA] Variant {variant_idx}: Raw API response: {len(raw_data)} papers")
            year_dropped = 0
            variant_passed = 0

            for entry in raw_data:
                title = (entry.get("title") or "").strip()
                if not title:
                    continue
                pub_date = entry.get("publication_date", "")
                year = int(pub_date[:4]) if pub_date else datetime.datetime.now().year
                if year < year_from or year > year_to:
                    year_dropped += 1
                    continue
                authorships = entry.get("authorships") or []
                authors = ", ".join(a.get("author", {}).get("display_name", "") for a in authorships[:4])
                link = (entry.get("open_access") or {}).get("oa_url") or entry.get("doi") or entry.get("primary_location", {}).get("landing_page_url") or ""
                abstract = _clean_abstract(_reconstruct_abstract(entry.get("abstract_inverted_index")))
                results.append(_paper_to_external_record(
                    source="openalex",
                    title=title,
                    authors=authors or "OpenAlex",
                    year=year,
                    preview=(abstract[:148] if abstract else title[:148]),
                    summary=abstract or title,
                    datacenter="",
                    metrics="",
                    link=link,
                    pdf_url=(entry.get("open_access") or {}).get("oa_url") or "",
                    citation_count=entry.get("cited_by_count", 0),
                    sources=["openalex"],
                    indexed_query=search_text,
                ))
                variant_passed += 1
            print(f"[Index] [OA] Variant {variant_idx}: {len(raw_data)} raw → {year_dropped} year-filtered → {variant_passed} passed")
        print(f"[Index] [OA] Complete: {len(results)} total papers from all variants")
        if not any_variant_ok and search_variants:
            if last_error_code == 429:
                error = "Rate limited"
            elif last_error_code:
                error = f"HTTP {last_error_code}"
            else:
                error = "Unreachable"
        else:
            error = None
        return results, error
    except Exception as e:
        print(f"[Index] [OA] Exception: {e}")
        return [], "Unreachable"


def _fetch_arxiv_candidates(query_text, year_from, year_to, limit=10):
    try:
        ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
        results = []
        tokens = _query_keyword_tokens(query_text)
        query_variants = _dedupe_strings([
            " AND ".join(f"all:{token}" for token in tokens[:4]) if len(tokens) >= 2 else "",
            f'all:"{query_text.strip()}"' if (query_text or "").strip() else "",
            " OR ".join(f"all:{token}" for token in tokens[:4]) if len(tokens) >= 2 else "",
        ])
        any_variant_ok = False
        last_error_code = None
        print(f"[Index] [arXiv] Starting: query='{query_text}', tokens={tokens}, year=[{year_from},{year_to}], variants={len(query_variants)}")

        for variant_idx, search_query in enumerate(query_variants, 1):
            if not search_query:
                continue
            print(f"[Index] [arXiv] Variant {variant_idx}: '{search_query}'")

            try:
                r = http_requests.get(
                    "http://export.arxiv.org/api/query",
                    params={
                        "search_query": search_query,
                        "start": 0,
                        "max_results": limit,
                        "sortBy": "submittedDate",
                        "sortOrder": "descending",
                    },
                    timeout=20,
                    proxies=_proxies,
                )
            except Exception as variant_err:
                print(f"[Index] [arXiv] Variant {variant_idx} request failed: {variant_err}")
                continue

            if not r.ok:
                print(f"[Index] [arXiv] Variant {variant_idx} HTTP {r.status_code}: {r.reason}")
                last_error_code = r.status_code
                continue
            any_variant_ok = True

            root = ET.fromstring(r.text)
            raw_data = root.findall("atom:entry", ns)
            print(f"[Index] [arXiv] Variant {variant_idx}: Raw API response: {len(raw_data)} papers")
            year_dropped = 0
            variant_passed = 0

            for entry in raw_data:
                title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
                if not title:
                    continue
                published = entry.findtext("atom:published", default="", namespaces=ns)
                year = int(published[:4]) if published else datetime.datetime.now().year
                if year < year_from or year > year_to:
                    year_dropped += 1
                    continue
                summary = _clean_abstract(entry.findtext("atom:summary", default="", namespaces=ns))
                authors = ", ".join(
                    a.findtext("atom:name", default="", namespaces=ns)
                    for a in entry.findall("atom:author", ns)
                ).strip(", ") or "arXiv"
                arxiv_id = (entry.findtext("atom:id", default="", namespaces=ns) or "").rsplit("/", 1)[-1]
                pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf" if arxiv_id else ""
                results.append(_paper_to_external_record(
                    source="arxiv",
                    title=title,
                    authors=authors,
                    year=year,
                    preview=summary[:148],
                    summary=summary,
                    datacenter="",
                    metrics="",
                    link=pdf_url or entry.findtext("atom:id", default="", namespaces=ns) or "",
                    pdf_url=pdf_url,
                    citation_count=0,
                    sources=["arxiv"],
                    indexed_query=search_query,
                ))
                variant_passed += 1
            print(f"[Index] [arXiv] Variant {variant_idx}: {len(raw_data)} raw → {year_dropped} year-filtered → {variant_passed} passed")
        print(f"[Index] [arXiv] Complete: {len(results)} total papers from all variants")
        if not any_variant_ok and query_variants:
            if last_error_code == 429:
                error = "Rate limited"
            elif last_error_code:
                error = f"HTTP {last_error_code}"
            else:
                error = "Unreachable"
        else:
            error = None
        return results, error
    except Exception as e:
        print(f"[Index] [arXiv] Exception: {e}")
        return [], "Unreachable"


def _safe_json_snippet(value, limit=_RANK_LOG_SNIPPET_CHARS):
    try:
        text = str(value or "")
    except Exception:
        text = ""
    text = text.replace("\n", "\\n").replace("\r", "")
    return text[:limit]

def _extract_json_object_text(raw_text):
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("Empty LLM response content")

    # Handle markdown fenced JSON blocks if the model includes formatting.
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\\s*```$", "", text)
        text = text.strip()

    if text.startswith("{") and text.endswith("}"):
        return text

    first = text.find("{")
    last = text.rfind("}")
    if first >= 0 and last > first:
        return text[first:last + 1]

    raise ValueError("No JSON object found in LLM response")


def _build_score_sequence(active_keys, score_breakdown):
    seq = []
    for idx, key in enumerate(active_keys):
        try:
            raw = float(score_breakdown.get(key, 0.0))
        except (TypeError, ValueError):
            raw = 0.0
        seq.append({
            "q": f"Q{idx + 1}",
            "key": key,
            "score": round(max(0.0, min(5.0, raw)), 4),
            "max": 5,
        })
    return seq


def _expand_query_with_ai(query_text, client, deployment):
    """Use the LLM to generate 4-6 alternative search terms for `query_text`.

    Returns a list of synonym/variant strings, or [] if AI is unavailable or fails.
    """
    if not client or not query_text:
        return []
    prompt = (
        "You are a search query expansion assistant. Given a technical research search query, "
        "output 4 to 6 alternative search terms or closely related phrases that would help "
        "find relevant papers on the same topic. Focus on synonyms, acronyms, and closely "
        "related technical concepts. Do not include the original query.\n\n"
        "Respond with ONLY valid JSON in this exact format: "
        "{\"terms\": [\"term1\", \"term2\", \"term3\"]}\n\n"
        f"Query: {query_text}"
    )
    try:
        completion = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        raw = (completion.choices[0].message.content or "").strip()
        data = json.loads(raw)
        terms = data.get("terms") or []
        terms = [str(t).strip() for t in terms if str(t).strip()]
        print(f"[QueryExpand] '{query_text}' → {terms}")
        return terms[:6]
    except Exception as e:
        print(f"[QueryExpand] failed: {e}")
        return []


_PREFILTER_THRESHOLD = 20  # min candidates before pre-filter is applied
_PREFILTER_BATCH_SIZE = 3   # papers per relevance-check batch
_PREFILTER_MAX_WORKERS = 10  # parallel LLM calls during batch pre-filter

# One-line focus description used in the pre-filter relevance prompt per team
_PREFILTER_TEAM_FOCUS = {
    "oie": (
        "OIE - AI on GPU Optimization: GPU utilization, throughput, latency, "
        "quantization, kernel/runtime optimization, memory efficiency (HBM, KV cache, activations) "
        "for large-scale AI training and inference."
    ),
    "e2o": (
        "E2O - Network, Switch, Optical: datacenter networking for AI workloads — "
        "switch architectures, optical interconnects, collective communication (all-reduce, all-to-all), "
        "fabric scaling, and bandwidth/latency optimization."
    ),
    "ai_on_ia": (
        "AI on iA - Agentic and Head Node CPU Optimization: CPU-side orchestration of agentic AI — "
        "tool calls, planning loops, multi-agent scheduling, CPU-GPU partitioning, "
        "serialization overhead, and head-node performance."
    ),
    "hickory_delta": (
        "Federal Research - Cache, Reliability, Wafer Scale: cache and memory hierarchy design, "
        "coherence protocols, wafer-scale integration, reliability/fault tolerance, "
        "and long-horizon architectural innovations."
    ),
}


def _prefilter_candidates_with_ai(query_text, candidates, client, deployment, team_id=None):
    """Filter candidates to query-relevant ones using parallel batched LLM calls.

    Each batch of _PREFILTER_BATCH_SIZE papers gets its own small LLM call asking
    which (if any) are directly relevant to the query for the given team's focus.
    All batches run in parallel.

    Returns (selected, excluded, error_message).
      - selected/excluded are lists of candidates.
      - error_message is None on success, or a string describing the failure.
    On AI-unavailable or complete failure, returns (candidates, [], error_message)
    so the caller can decide whether to surface the error and still rank all papers.
    """
    if not client:
        return candidates, [], "AI endpoint unavailable — pre-filter skipped"
    if len(candidates) <= _PREFILTER_THRESHOLD:
        return candidates, [], None  # too few candidates, no-op

    candidate_ids = {(c.get("id") or c.get("rid") or "") for c in candidates}

    def check_batch(batch):
        """Return list of relevant candidate IDs from this batch, or raise on failure."""
        lines = []
        for i, c in enumerate(batch, 1):
            cid = c.get("id") or c.get("rid") or ""
            title = (c.get("title") or "")[:120]
            lines.append(f"{i}. [{cid}] {title}")
        papers_block = "\n".join(lines)

        team_focus = _PREFILTER_TEAM_FOCUS.get(team_id or "", "")
        focus_line = f"Team focus: {team_focus}\n\n" if team_focus else ""

        prompt = (
            f"Query: {query_text}\n\n"
            f"{focus_line}"
            f"Papers:\n{papers_block}\n\n"
            f"Which of these papers are directly relevant to both the query AND the team focus? "
            f"A paper is relevant if it directly addresses the query topic in a way useful to the team. "
            f"Return ONLY valid JSON: {{\"relevant_ids\": [\"id1\", ...]}} "
            f"using the exact IDs shown in brackets. "
            f"If none are relevant, return {{\"relevant_ids\": []}}"
        )
        completion = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        raw = (completion.choices[0].message.content or "").strip()
        data = json.loads(raw)
        ids = [str(i) for i in (data.get("relevant_ids") or [])]
        # Only return IDs that actually exist in this batch (guard against LLM hallucination)
        batch_ids = {c.get("id") or c.get("rid") or "" for c in batch}
        return [rid for rid in ids if rid in batch_ids]

    batches = [candidates[i:i + _PREFILTER_BATCH_SIZE]
               for i in range(0, len(candidates), _PREFILTER_BATCH_SIZE)]
    selected_ids = set()
    batch_errors = []

    with ThreadPoolExecutor(max_workers=_PREFILTER_MAX_WORKERS) as executor:
        future_to_idx = {executor.submit(check_batch, batch): idx
                         for idx, batch in enumerate(batches)}
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                selected_ids.update(future.result())
            except Exception as e:
                batch = batches[idx]
                sample = batch[0].get("title", "")[:40] if batch else "?"
                batch_errors.append(f"batch {idx} ('{sample}...'): {e}")

    print(
        f"[Prefilter] {len(candidates)} candidates, {len(batches)} batches, "
        f"{len(batch_errors)} batch errors, {len(selected_ids)} IDs matched"
    )

    error_message = None
    if batch_errors:
        error_message = f"Pre-filter: {len(batch_errors)}/{len(batches)} batches failed — {batch_errors[0]}"
        print(f"[Prefilter] errors: {batch_errors}")

    # Validate against real candidate IDs (double-check LLM didn't hallucinate)
    valid_selected = selected_ids & candidate_ids

    if not valid_selected:
        # Every batch failed or LLM returned no relevant papers
        no_match_msg = error_message or "Pre-filter: no relevant papers identified — ranking all"
        return candidates, [], no_match_msg

    selected = [c for c in candidates if (c.get("id") or c.get("rid") or "") in valid_selected]
    excluded = [c for c in candidates if (c.get("id") or c.get("rid") or "") not in valid_selected]
    print(f"[Prefilter] → {len(selected)} selected, {len(excluded)} excluded")
    return selected, excluded, error_message


def _rank_candidates_with_ai(query_text, candidates, progress_callback=None, team_id="oie", ranking_run_id=None):
    cfg = _get_session_ranking_config(team_id)
    active_keys = cfg["keys"]
    active_weights = cfg["weights"]
    active_questions = cfg["questions"]
    ranking_run_id = str(ranking_run_id or time.time_ns())

    client = _get_azure_client()
    total_scored = len(candidates)

    if client is None or not candidates:
        ranked = []
        for c in candidates:
            copy = dict(c)
            copy["score_error"] = "AI endpoint unavailable"
            copy["total_score"] = None
            ranked.append(copy)
        if progress_callback:
            progress_callback(total_scored, total_scored, "completed")
        return ranked

    deployment = (_azure_cfg or {}).get("deployment", "gpt-4o")
    payload = [
        {
            "title": c.get("title", ""),
            "year": c.get("year", 0),
            "source": c.get("source", ""),
            "has_pdf": bool(c.get("pdf_url") or c.get("link")),
            "summary": (c.get("summary") or c.get("preview") or "")[:110],
            "datacenter": (c.get("datacenter") or "")[:80],
        }
        for c in candidates
    ]
    payload_ids = [c["id"] for c in candidates]

    weighted_criteria = []
    for key in active_keys:
        try:
            weight = float(active_weights.get(key, 0.0))
        except (TypeError, ValueError):
            weight = 0.0
        if weight > 0.0:
            weighted_criteria.append({
                "key": key,
                "weight": weight,
                "question": active_questions.get(key, key),
            })

    if not weighted_criteria:
        print("  [Rank] All criteria weights are zero; skipping LLM ranking.")
        if progress_callback:
            progress_callback(total_scored, total_scored, "completed")
        return list(candidates)

    try:
        print(
            "  [Rank] Starting per-criterion scoring: "
            f"query='{_safe_json_snippet(query_text, 120)}', "
            f"candidates={len(payload)}, weighted_criteria={len(weighted_criteria)}"
        )
        by_id = {c["id"]: c for c in candidates}
        score_by_id = {cid: {k: None for k in active_keys} for cid in by_id.keys()}
        rationale_parts_by_id = {cid: [] for cid in by_id.keys()}
        criterion_success = {item["key"]: False for item in weighted_criteria}
        processed_papers = 0
        for idx, paper_payload in enumerate(payload):
            rid = payload_ids[idx]
            for criterion in weighted_criteria:
                key = criterion["key"]
                question = criterion["question"]
                weight = criterion["weight"]

                print(
                    "  [Rank] Criterion request: "
                    f"key='{key}', weight={round(weight, 4)}, "
                    f"question_len={len(str(question or ''))}, paper_idx={idx}"
                )

                prompt_payload = {
                    "ranking_run_id": ranking_run_id,
                    "query": query_text,
                    "criterion": {
                        "key": key,
                        "question": question,
                        "weight": weight,
                        "scale": "0-5",
                    },
                    "output_contract": {
                        "format": "json_object",
                        "key": "score",
                        "score_type": "number",
                        "score_range": [0, 5],
                    },
                    "paper": paper_payload,
                }

                try:
                    started = time.time()
                    completion = client.chat.completions.create(
                        model=deployment,
                        messages=[
                            {"role": "system", "content": (
                                "You score one paper for one criterion. "
                                "Return ONLY JSON with exactly one key: {\"score\": <number from 0 to 5>}. "
                                "No markdown, no prose, no extra keys."
                            )},
                            {"role": "user", "content": json.dumps(prompt_payload, ensure_ascii=False)},
                        ],
                        max_tokens=40,
                        temperature=0.0,
                        extra_headers={
                            "Cache-Control": "no-cache, no-store",
                            "Pragma": "no-cache",
                            "x-ms-client-request-id": str(uuid.uuid4()),
                        },
                        response_format={"type": "json_object"},
                    )
                    elapsed_ms = int((time.time() - started) * 1000)
                    choice = completion.choices[0] if completion and completion.choices else None
                    finish_reason = choice.finish_reason if choice else "unknown"
                    raw_content = (choice.message.content if choice and choice.message else "") or ""

                    data = None
                    try:
                        data = json.loads(_extract_json_object_text(raw_content))
                    except Exception as parse_error:
                        print(
                            "  [Rank] JSON parse error (paper first pass): "
                            f"key='{key}', paper_idx={idx}, error={parse_error}, snippet='{_safe_json_snippet(raw_content)}'"
                        )

                        retry_completion = client.chat.completions.create(
                            model=deployment,
                            messages=[
                                {"role": "system", "content": (
                                    "Return strict JSON only in this exact shape: {\"score\": number}. "
                                    "Score must be between 0 and 5. No extra keys."
                                )},
                                {"role": "user", "content": json.dumps(prompt_payload, ensure_ascii=False)},
                            ],
                            max_tokens=60,
                            temperature=0.0,
                            extra_headers={
                                "Cache-Control": "no-cache, no-store",
                                "Pragma": "no-cache",
                                "x-ms-client-request-id": str(uuid.uuid4()),
                            },
                            response_format={"type": "json_object"},
                        )
                        retry_choice = retry_completion.choices[0] if retry_completion and retry_completion.choices else None
                        retry_raw = (retry_choice.message.content if retry_choice and retry_choice.message else "") or ""
                        data = json.loads(_extract_json_object_text(retry_raw))

                    try:
                        num = float((data or {}).get("score", 0.0))
                    except (TypeError, ValueError):
                        num = 0.0
                    num = max(0.0, min(5.0, num))
                    score_by_id[rid][key] = num
                    criterion_success[key] = True

                    print(
                        "  [Rank] Paper scored: "
                        f"key='{key}', paper_idx={idx}, finish_reason={finish_reason}, elapsed_ms={elapsed_ms}, score={num}"
                    )
                except Exception as paper_error:
                    score_by_id[rid][key] = None
                    print(
                        "  [Index] AI paper scoring failed: "
                        f"key='{key}', paper_idx={idx}, error={paper_error}"
                    )

            processed_papers += 1
            if progress_callback:
                progress_callback(processed_papers, len(payload), "ranking")

        successful_criteria = sum(1 for item in weighted_criteria if criterion_success.get(item["key"]))

        annotated = []
        for cid, cand in by_id.items():
            normalized = score_by_id[cid]
            # Find which keys have valid scores (not None)
            scored_keys = [k for k in active_keys if normalized.get(k) is not None]
            failed_keys = [k for k in active_keys if normalized.get(k) is None]

            copy = dict(cand)
            if failed_keys and not scored_keys:
                copy["score_error"] = f"AI scoring failed for: {', '.join(failed_keys)}"
                copy["total_score"] = 0
                copy["score_breakdown"] = {k: v for k, v in normalized.items() if v is not None}
                copy["score_sequence"] = _build_score_sequence(scored_keys, normalized)
            else:
                # Compute total_score only from scored keys (ignore None)
                total_score = sum(
                    normalized[k] * float(active_weights.get(k, 0.0) or 0.0)
                    for k in scored_keys
                )
                conf = len(scored_keys) / max(1, len(weighted_criteria))
                copy["total_score"] = round(total_score, 4)
                copy["score_confidence"] = max(0.0, min(1.0, conf))
                copy["score_breakdown"] = {k: v for k, v in normalized.items() if v is not None}
                copy["score_sequence"] = _build_score_sequence(scored_keys, normalized)
                if failed_keys:
                    copy["score_error"] = f"Partial scoring — failed criteria: {', '.join(failed_keys)}"
            annotated.append(copy)

        ranked = sorted(
            annotated,
            key=lambda c: (c.get("total_score") or 0, c.get("citation_count") or 0, c.get("year") or 0),
            reverse=True,
        )
        if progress_callback:
            progress_callback(total_scored, total_scored, "completed")
        return ranked
    except Exception as e:
        print(f"  [Index] AI ranking failed: {e}")
        ranked = []
        for c in candidates:
            copy = dict(c)
            copy["score_error"] = f"AI ranking failed: {e}"
            copy["total_score"] = None
            ranked.append(copy)
        if progress_callback:
            progress_callback(total_scored, total_scored, "completed")
        return ranked


def _normalize_title(title):
    """Lowercase, strip punctuation/whitespace for title comparison."""
    return " ".join(re.findall(r"[a-z0-9]+", (title or "").lower()))


def _dedup_candidates_by_title(candidates):
    """Merge candidates across sources that refer to the same paper by title similarity.
    Keeps the record with the highest citation_count; on ties prefers openalex > arxiv > core-pr.
    Merges the `sources` lists so provenance is preserved."""
    SOURCE_PRIORITY = {"openalex": 0, "arxiv": 1, "core-pr": 2}
    groups = []   # list of lists of candidate indices
    indexed = []  # (normalized_title_tokens, candidate_idx)

    for idx, cand in enumerate(candidates):
        norm = _normalize_title(cand.get("title", ""))
        tokens = set(norm.split())
        if not tokens:
            groups.append([idx])
            continue
        merged = False
        for group in groups:
            rep_tokens = set(_normalize_title(candidates[group[0]].get("title", "")).split())
            if not rep_tokens:
                continue
            overlap = len(tokens & rep_tokens) / max(len(tokens), len(rep_tokens))
            if overlap >= 0.85:
                group.append(idx)
                merged = True
                break
        if not merged:
            groups.append([idx])

    result = []
    for group in groups:
        if len(group) == 1:
            result.append(candidates[group[0]])
            continue
        # Pick best: highest citation_count, ties broken by source priority
        best = max(
            (candidates[i] for i in group),
            key=lambda c: (
                int(c.get("citation_count") or 0),
                -SOURCE_PRIORITY.get((c.get("source") or "").lower(), 99),
            ),
        )
        # Merge sources list
        all_sources = []
        seen_src = set()
        for i in group:
            for s in (candidates[i].get("sources") or [candidates[i].get("source", "")]):
                if s and s not in seen_src:
                    all_sources.append(s)
                    seen_src.add(s)
        merged_cand = dict(best)
        merged_cand["sources"] = all_sources
        result.append(merged_cand)

    return result


def _store_external_candidates(candidates, indexed_query):
    """Store candidates in the in-memory discovery cache (not in DB)."""
    for cand in candidates:
        _discovery_cache[cand.get("id", "")] = dict(cand)


def _build_external_index(seeds, year_from, year_to, source_progress_callback=None):
    """Fetch candidates from all sources for each seed query, deduplicate by title, and store.

    `seeds` is a list of query strings (the original query plus any LLM-expanded terms).
    Returns (all_candidates, source_errors).
    """
    if isinstance(seeds, str):
        # Backwards-compat: accept a plain query string
        seeds = [seeds] if seeds else []
    all_candidates = []
    source_counts = {"core-pr": 0, "openalex": 0, "arxiv": 0}
    source_errors = {"core-pr": None, "openalex": None, "arxiv": None}
    for seed in seeds:
        core_items, core_err = _fetch_core_pr_candidates(seed, year_from, year_to)
        all_candidates.extend(core_items)
        source_counts["core-pr"] += len(core_items)
        if core_err:
            source_errors["core-pr"] = core_err
        if source_progress_callback:
            source_progress_callback(dict(source_counts))

        openalex_items, oa_err = _fetch_openalex_candidates(seed, year_from, year_to)
        all_candidates.extend(openalex_items)
        source_counts["openalex"] += len(openalex_items)
        if oa_err:
            source_errors["openalex"] = oa_err
        if source_progress_callback:
            source_progress_callback(dict(source_counts))

        arxiv_items, arxiv_err = _fetch_arxiv_candidates(seed, year_from, year_to)
        all_candidates.extend(arxiv_items)
        source_counts["arxiv"] += len(arxiv_items)
        if arxiv_err:
            source_errors["arxiv"] = arxiv_err
        if source_progress_callback:
            source_progress_callback(dict(source_counts))

    print(f"[Index] Raw candidates: {len(all_candidates)} total, source_counts={source_counts}")

    # Deduplicate by title similarity across sources
    deduped = _dedup_candidates_by_title(all_candidates)
    print(f"[Index] After title dedup: {len(deduped)} (removed {len(all_candidates) - len(deduped)})")

    primary_query = seeds[0] if seeds else ""
    _store_external_candidates(deduped, primary_query)
    return deduped, source_errors


# ── Discovery helpers ───────────────────────────────────────────────────────

def _months_ago_date(months):
    d = datetime.datetime.now()
    d = d.replace(month=d.month - months) if d.month > months else d.replace(
        year=d.year - 1, month=d.month - months + 12)
    return d.strftime("%Y-%m-%d")


def _clean_abstract(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", text)).strip()


def _reconstruct_abstract(inverted_index):
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""
    words = {}
    for word, positions in inverted_index.items():
        for pos in positions:
            words[pos] = word
    return " ".join(words[i] for i in sorted(words))


def _parse_year_param(value, default_year, min_year=1990, max_year=2100):
    try:
        year = int(str(value).strip())
    except (ValueError, TypeError, AttributeError):
        return default_year
    if year < min_year or year > max_year:
        return default_year
    return year


def _paper_year_or_default(value, default_year):
    try:
        return int(value)
    except (ValueError, TypeError):
        return default_year


def _filter_discovery_candidates(candidates, year_from, year_to):
    allowed_sources = {"openalex", "arxiv", "core-pr"}
    pre_source_count = len(candidates)
    filtered = [
        c for c in (candidates or [])
        if set(c.get("sources") or [c.get("source", "")]).issubset(allowed_sources)
    ]
    print(
        f"[Discovery] Source filter: {pre_source_count} indexed → {len(filtered)} allowed "
        f"(dropped {pre_source_count - len(filtered)})"
    )

    pre_year_count = len(filtered)
    filtered = [
        r for r in filtered
        if year_from <= _paper_year_or_default(r.get("year"), datetime.datetime.now().year) <= year_to
    ]
    print(
        f"[Discovery] Year range enforcement [{year_from},{year_to}]: {pre_year_count} → {len(filtered)} "
        f"(dropped {pre_year_count - len(filtered)})"
    )
    return filtered


def _fetch_openalex_citation_count(paper):
    """Look up a paper's citation count live from OpenAlex.
    Returns an int on success, or None if the count could not be retrieved."""
    title = (paper.get("title") or "").strip()
    link = (paper.get("link") or "").strip()

    # Try DOI lookup first (most accurate)
    doi = None
    if "doi.org/" in link:
        doi = link.split("doi.org/", 1)[-1].strip().rstrip("/")
    if doi:
        try:
            r = http_requests.get(
                f"https://api.openalex.org/works/doi:{doi}",
                headers={"Accept": "application/json"},
                timeout=15,
                proxies=_proxies,
            )
            if r.ok:
                data = r.json()
                count = data.get("cited_by_count")
                if count is not None:
                    return int(count)
        except Exception as e:
            print(f"[Citations] DOI lookup failed for '{title}': {e}")

    # Fall back to title search
    if not title:
        return None
    try:
        r = http_requests.get(
            "https://api.openalex.org/works",
            params={"search": title, "per-page": "1"},
            headers={"Accept": "application/json"},
            timeout=15,
            proxies=_proxies,
        )
        if not r.ok:
            return None
        results = r.json().get("results", [])
        if not results:
            return None
        # Verify title similarity to avoid mismatches
        result_title = (results[0].get("title") or "").lower()
        query_tokens = set(re.findall(r"[a-z0-9]+", title.lower()))
        result_tokens = set(re.findall(r"[a-z0-9]+", result_title))
        if not query_tokens:
            return None
        overlap = len(query_tokens & result_tokens) / len(query_tokens)
        if overlap < 0.8:
            print(f"[Citations] Title match too low ({overlap:.0%}) for '{title}' -> '{results[0].get('title')}'")
            return None
        count = results[0].get("cited_by_count")
        return int(count) if count is not None else None
    except Exception as e:
        print(f"[Citations] Title search failed for '{title}': {e}")
        return None


@app.route("/api/papers/citation-counts", methods=["GET"])
@login_required
def api_citation_counts():
    """Fetch live citation counts from OpenAlex for all library papers."""
    all_papers = get_all_papers()
    result = {}
    for paper in all_papers:
        pid = paper.get("id")
        if not pid:
            continue
        count = _fetch_openalex_citation_count(paper)
        result[pid] = count  # int or None
        print(f"[Citations] {pid}: {count if count is not None else 'not found'}")
    return jsonify(result)


@app.route("/api/clipboard/download-zip", methods=["POST"])
@login_required
def api_clipboard_download_zip():
    """Bundle PDFs for clipboard papers into a ZIP archive and return it."""
    data = request.get_json(silent=True) or {}
    papers = data.get("papers", [])
    if not papers:
        return jsonify({"error": "No papers provided"}), 400

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zfile:
        for paper in papers:
            pdf_url = (paper.get("pdf_url") or "").strip()
            title = (paper.get("title") or paper.get("id") or "paper").strip()
            safe_name = slugify(title)
            if not pdf_url:
                zfile.writestr(safe_name + "_error.txt", "No PDF URL available for this paper.")
                continue
            tmp_path, err = _download_pdf_to_temp(pdf_url)
            if not tmp_path:
                zfile.writestr(safe_name + "_error.txt", f"Download failed: {err}")
                continue
            try:
                with open(tmp_path, "rb") as f:
                    zfile.writestr(safe_name + ".pdf", f.read())
            except Exception as e:
                zfile.writestr(safe_name + "_error.txt", f"Read error: {e}")
            finally:
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
    buf.seek(0)
    return send_file(buf, mimetype="application/zip",
                     download_name="clipboard_papers.zip", as_attachment=True)


@app.route("/api/clipboard/report", methods=["POST"])
@login_required
def api_clipboard_report():
    """Generate an LLM one-page report for a set of discovery papers."""
    data = request.get_json(silent=True) or {}
    papers = data.get("papers", [])
    mode = data.get("mode", "summary")
    if not papers:
        return jsonify({"error": "No papers provided"}), 400

    client = _get_azure_client()
    if client is None:
        return jsonify({"error": "AI service is not configured"}), 503

    cfg = _load_azure_config() or {}
    deployment = cfg.get("deployment", "gpt-4o")

    system_prompts = {
        "summary": (
            "You are a research assistant. Write a concise one-page report "
            "containing a clear individual summary for each of the papers listed below. "
            "For each paper write a short paragraph covering: what it does, key findings, "
            "and relevance to datacenter AI. Use the paper title as a heading."
        ),
        "synthesis": (
            "You are a research assistant. Write a concise one-page synthesis report "
            "that identifies the major shared themes, trends, and collective insights "
            "across all the papers listed below. Do not summarize papers individually; "
            "synthesize them into a unified narrative."
        ),
        "comparison": (
            "You are a research assistant. Write a concise one-page comparison report "
            "for the papers listed below. Highlight key differences in approach, "
            "methodology, results, and practical implications. Use a structured format "
            "that makes contrasts easy to read at a glance."
        ),
    }
    system_prompt = system_prompts.get(mode, system_prompts["summary"])

    paper_blocks = []
    for i, p in enumerate(papers, 1):
        block = f"Paper {i}: {p.get('title', 'Unknown')}\n"
        if p.get("authors"):    block += f"Authors: {p['authors']}\n"
        if p.get("year"):       block += f"Year: {p['year']}\n"
        if p.get("summary"):    block += f"Summary: {p['summary']}\n"
        if p.get("datacenter"): block += f"Datacenter Relevance: {p['datacenter']}\n"
        if p.get("metrics"):    block += f"Key Metrics: {p['metrics']}\n"
        paper_blocks.append(block)
    user_content = "Papers:\n\n" + "\n---\n".join(paper_blocks)

    try:
        completion = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_content},
            ],
            max_tokens=1500,
            temperature=0.3,
        )
        report_text = completion.choices[0].message.content or ""
        return jsonify({"report": report_text, "mode": mode, "paper_count": len(papers)})
    except Exception as e:
        return jsonify({"error": f"Report generation failed: {e}"}), 500


@app.route("/api/discover/search", methods=["GET"])
@login_required
def api_discover_search():
    # Clear the in-memory discovery cache on each new search
    with _discovery_cache_lock:
        _discovery_cache.clear()
    query_text = request.args.get("q", "").strip()
    year_from = _parse_year_param(request.args.get("year_from", "2025", type=str), 2025)
    year_to = _parse_year_param(request.args.get("year_to", "2026", type=str), 2026)
    if year_from > year_to:
        year_from, year_to = year_to, year_from

    user_key = str(current_user.get_id() or getattr(current_user, "username", "anon"))
    ai_available = _get_azure_client() is not None

    if not query_text:
        _set_discovery_progress(
            user_key,
            stage="idle",
            active=False,
            processed=0,
            total=0,
            found=0,
            source_counts={"core-pr": 0, "openalex": 0, "arxiv": 0},
            message="Enter a query and click Search.",
            query="",
        )
        return jsonify({
            "results": [],
            "query": "",
            "ai_available": ai_available,
            "applied_year_from": year_from,
            "applied_year_to": year_to,
            "index_count": 0,
            "source_counts": {"core-pr": 0, "openalex": 0, "arxiv": 0},
            "top_k": 0,
            "errors": [],
            "empty_reason": "Enter a search query, then click Search.",
        })

    errors = []
    indexed = []
    source_errors = {"core-pr": None, "openalex": None, "arxiv": None}
    expanded_terms = []

    # LLM query expansion — generates synonym/variant search terms
    cfg = _load_azure_config() or {}
    deployment = cfg.get("deployment", "gpt-4o")
    client = _get_azure_client()
    if client:
        _set_discovery_progress(
            user_key,
            stage="searching",
            active=True,
            processed=0,
            total=1,
            found=0,
            source_counts={"core-pr": 0, "openalex": 0, "arxiv": 0},
            message="Expanding query with AI...",
            query=query_text,
        )
        expanded_terms = _expand_query_with_ai(query_text, client, deployment)

    seeds = [query_text] + expanded_terms
    total_fetches = len(seeds) * 3  # 3 sources per seed
    _fetch_counter = [0]  # mutable counter for closure

    _set_discovery_progress(
        user_key,
        stage="searching",
        active=True,
        processed=0,
        total=total_fetches,
        found=0,
        source_counts={"core-pr": 0, "openalex": 0, "arxiv": 0},
        message=f"Fetching from 3 sources \u00d7 {len(seeds)} search terms (0/{total_fetches})...",
        query=query_text,
    )

    try:
        with _index_lock:
            def _source_progress_update(source_counts):
                _fetch_counter[0] += 1
                done = _fetch_counter[0]
                _set_discovery_progress(
                    user_key,
                    stage="searching",
                    active=True,
                    processed=done,
                    total=total_fetches,
                    found=int(sum(source_counts.values())),
                    source_counts=source_counts,
                    message=f"Fetching from sources ({done}/{total_fetches})... {sum(source_counts.values())} papers found so far",
                    query=query_text,
                )

            indexed, source_errors = _build_external_index(seeds, year_from, year_to, source_progress_callback=_source_progress_update)
    except Exception as e:
        errors.append(f"Index build: {e}")

    filtered = _filter_discovery_candidates(indexed, year_from, year_to)
    source_counts = _count_source_counts(filtered)

    if not filtered:
        if errors:
            empty_reason = "No papers found because configured sources failed: " + "; ".join(errors)
        else:
            empty_reason = "No papers found for this query and year range from CORE Paper Repository, OpenAlex, or arXiv."
    else:
        empty_reason = ""

    _set_discovery_progress(
        user_key,
        stage="searched",
        active=False,
        processed=0,
        total=0,
        found=int(sum(source_counts.values())),
        source_counts=source_counts,
        message="Search complete. Click one team rank button to score results.",
        query=query_text,
    )

    return jsonify({
        "results": filtered,
        "query": query_text,
        "ai_available": ai_available,
        "applied_year_from": year_from,
        "applied_year_to": year_to,
        "index_count": len(filtered),
        "source_counts": source_counts,
        "source_errors": source_errors,
        "expanded_terms": expanded_terms,
        "top_k": len(filtered),
        "errors": errors,
        "empty_reason": empty_reason,
    })


@app.route("/api/discover/rank", methods=["POST"])
@login_required
def api_discover_rank():
    payload = request.get_json(silent=True) or {}
    ranking_run_id = str(payload.get("ranking_run_id") or time.time_ns())
    team_id = _normalize_ranking_team(payload.get("team"))
    if not team_id:
        return jsonify({"error": "team is required and must be one of: oie, e2o, ai_on_ia, hickory_delta"}), 400

    team_label = _RANKING_TEAMS.get(team_id, team_id)
    query_text = (payload.get("query") or "").strip()
    year_from = _parse_year_param(payload.get("year_from", 2025), 2025)
    year_to = _parse_year_param(payload.get("year_to", 2026), 2026)
    if year_from > year_to:
        year_from, year_to = year_to, year_from

    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        return jsonify({"error": "candidates list is required"}), 400

    source_errors = payload.get("source_errors") or {"core-pr": None, "openalex": None, "arxiv": None}
    user_key = str(current_user.get_id() or getattr(current_user, "username", "anon"))
    ai_available = _get_azure_client() is not None
    errors = []

    filtered = _filter_discovery_candidates(candidates, year_from, year_to)
    source_counts = _count_source_counts(filtered)

    # LLM relevance pre-filter: use batched parallel LLM calls to drop irrelevant papers
    prefilter_applied = False
    prefilter_error = None
    excluded_by_prefilter = []
    if filtered and query_text:
        _set_discovery_progress(
            user_key,
            stage="pre-filtering",
            active=True,
            processed=0,
            total=len(filtered),
            found=int(sum(source_counts.values())),
            source_counts=source_counts,
            message=f"Pre-filtering {len(filtered)} candidates for relevance ({_PREFILTER_BATCH_SIZE} per batch)...",
            query=query_text,
        )
        cfg_pf = _load_azure_config() or {}
        deploy_pf = cfg_pf.get("deployment", "gpt-4o")
        client_pf = _get_azure_client()
        to_rank, excluded_by_prefilter, prefilter_error = _prefilter_candidates_with_ai(
            query_text, filtered, client_pf, deploy_pf, team_id=team_id
        )
        if excluded_by_prefilter:
            prefilter_applied = True
            filtered = to_rank
            source_counts = _count_source_counts(filtered)
        if prefilter_error:
            errors.append(prefilter_error)

    total_to_process = len(filtered)

    _set_discovery_progress(
        user_key,
        stage="ranking",
        active=total_to_process > 0,
        processed=0,
        total=total_to_process,
        found=int(sum(source_counts.values())),
        source_counts=source_counts,
        message=(
            f"Ranking 0 of {total_to_process} papers for {team_label}..."
            if total_to_process > 0
            else "No papers available to rank."
        ),
        query=query_text,
    )

    ranked = []
    try:
        if filtered:
            def _progress_callback(processed_count, total_count, stage_name):
                safe_total = max(0, int(total_count or total_to_process or 0))
                safe_processed = max(0, min(int(processed_count or 0), safe_total if safe_total > 0 else int(processed_count or 0)))
                _set_discovery_progress(
                    user_key,
                    stage=stage_name,
                    active=(stage_name != "completed" and safe_total > 0),
                    processed=safe_processed,
                    total=safe_total,
                    found=int(sum(source_counts.values())),
                    source_counts=source_counts,
                    message=(
                        f"Ranking complete for {team_label}."
                        if stage_name == "completed"
                        else f"Ranking {safe_processed} of {safe_total} papers for {team_label}..."
                    ),
                    query=query_text,
                )

            ranked = _rank_candidates_with_ai(
                query_text,
                filtered,
                progress_callback=_progress_callback,
                team_id=team_id,
                ranking_run_id=ranking_run_id,
            )
        else:
            _set_discovery_progress(
                user_key,
                stage="completed",
                active=False,
                processed=0,
                total=0,
                found=0,
                source_counts=source_counts,
                message="No papers available to rank.",
                query=query_text,
            )
    except Exception as e:
        errors.append(f"AI ranking: {e}")
        _set_discovery_progress(
            user_key,
            stage="failed",
            active=False,
            processed=len(filtered),
            total=len(filtered),
            found=int(sum(source_counts.values())),
            source_counts=source_counts,
            message="Ranking failed.",
            query=query_text,
        )
        return jsonify({"error": str(e)}), 500

    # Append pre-filter-excluded papers with explanatory score_error, after ranked results
    if excluded_by_prefilter:
        for c in excluded_by_prefilter:
            c["score_error"] = "Not pre-selected — lower estimated relevance to query"
            c["total_score"] = 0
        ranked = ranked + excluded_by_prefilter

    if not ranked and not errors:
        empty_reason = "No papers were available to rank."
    elif not ranked and errors:
        empty_reason = "Ranking failed: " + "; ".join(errors)
    else:
        empty_reason = ""

    resp = jsonify({
        "results": ranked,
        "query": query_text,
        "ai_available": ai_available,
        "applied_year_from": year_from,
        "applied_year_to": year_to,
        "index_count": len(filtered),
        "source_counts": source_counts,
        "source_errors": source_errors,
        "prefilter_applied": prefilter_applied,
        "top_k": len(ranked),
        "team": team_id,
        "team_label": team_label,
        "ranking_run_id": ranking_run_id,
        "errors": errors,
        "empty_reason": empty_reason,
    })
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


# ── REST API: Import Discovery Paper to Library ─────────────────────────────

_IMPORT_METADATA_PROMPT = """\
You are a research metadata extractor for an AI architecture papers portal.
Given the title and extracted text from the first pages of a research paper,
produce a JSON object with exactly these keys:

{
  "title":       "<clean title string>",
  "authors":     "<Author names, or 'Multiple Authors' if unclear>",
  "year":        <4-digit integer year>,
  "preview":     "<1-sentence plain-English description of what the paper does>",
  "summary":     "<2-3 sentence technical summary covering: what it proposes, key method, and main result>",
  "datacenter":  "<1-2 sentences on relevance to AI datacenter infrastructure (training, inference, networking, memory, or TCO)>",
  "metrics":     "<1 sentence starting 'Key result signal:' describing the most important quantitative or qualitative result>",
  "citation_count": 0
}

Rules:
- Use only information present in the text. Do not invent results.
- If you cannot determine the year, use the year hint provided.
- Return ONLY the JSON object, no markdown, no prose.
"""


def _generate_metadata_from_pdf(pdf_path, title_hint, year_hint):
    """Extract text from the first pages of a local PDF and call LLM to generate metadata."""
    client = _get_azure_client()
    if not client:
        return None
    deployment = (_azure_cfg or {}).get("deployment", "gpt-4o")

    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
            if len(text) >= 4000:
                break
        doc.close()
        text = text[:4000]
    except Exception as e:
        print(f"  [ImportMetadata] PDF text extraction failed: {e}")
        return None

    if not text.strip():
        return None

    user_content = f"Title hint: {title_hint}\nYear hint: {year_hint}\n\nExtracted text (first pages):\n{text}"
    try:
        completion = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": _IMPORT_METADATA_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            max_tokens=600,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        raw = (completion.choices[0].message.content or "").strip()
        return json.loads(raw)
    except Exception as e:
        print(f"  [ImportMetadata] LLM metadata generation failed: {e}")
        return None


@app.route("/api/papers/import-discovery", methods=["POST"])
@login_required
def api_import_discovery():
    """Import a discovery paper into the library.

    Downloads the PDF, generates metadata via LLM, and stores in the papers table.
    """
    data = request.get_json(silent=True) or {}
    paper_id = (data.get("id") or "").strip()
    if not paper_id:
        return jsonify({"error": "Paper id is required"}), 400

    # Look up in discovery cache
    with _discovery_cache_lock:
        discovery = _discovery_cache.get(paper_id)
    if not discovery:
        return jsonify({"error": "Paper not found in discovery results. Try searching again."}), 404

    # Check if already in library
    existing = get_paper(paper_id)
    if existing:
        return jsonify({"error": "Paper already in library", "paper": existing}), 409

    pdf_url = (discovery.get("pdf_url") or discovery.get("link") or "").strip()
    title = discovery.get("title", "Untitled")
    year = discovery.get("year", datetime.datetime.now().year)
    source = discovery.get("source", "discovery")

    pdf_path = None
    image_path = None

    # ── Download PDF ──────────────────────────────────────────────────
    if pdf_url:
        normalized_url = _normalize_discovery_pdf_url(pdf_url)
        safe_name = slugify(title)[:80] + ".pdf"
        save_path = os.path.join(PAPER_FOLDER, safe_name)

        # Avoid overwriting existing files
        counter = 1
        while os.path.exists(save_path):
            safe_name = slugify(title)[:75] + f"-{counter}.pdf"
            save_path = os.path.join(PAPER_FOLDER, safe_name)
            counter += 1

        try:
            r = http_requests.get(normalized_url, timeout=60, proxies=_proxies, stream=True)
            if r.ok:
                with open(save_path, "wb") as f:
                    for chunk in r.iter_content(8192):
                        f.write(chunk)
                pdf_path = f"{PAPER_FOLDER}/{safe_name}"
                print(f"  [Import] Downloaded PDF: {pdf_path}")
            else:
                print(f"  [Import] PDF download failed (HTTP {r.status_code}): {normalized_url}")
        except Exception as e:
            print(f"  [Import] PDF download error: {e}")

    # ── Generate metadata via LLM if PDF available ────────────────────
    generated_meta = None
    if pdf_path and os.path.exists(pdf_path):
        generated_meta = _generate_metadata_from_pdf(pdf_path, title, year)

    # Build final paper record: LLM metadata > discovery metadata > defaults
    gm = generated_meta or {}
    paper = {
        "id": paper_id,
        "title": gm.get("title") or title,
        "authors": gm.get("authors") or discovery.get("authors", ""),
        "year": gm.get("year") or year,
        "citation_count": int(discovery.get("citation_count") or gm.get("citation_count", 0) or 0),
        "preview": gm.get("preview") or discovery.get("preview", ""),
        "summary": gm.get("summary") or discovery.get("summary", ""),
        "datacenter": gm.get("datacenter") or discovery.get("datacenter", ""),
        "metrics": gm.get("metrics") or discovery.get("metrics", ""),
        "link": discovery.get("link") or pdf_url or "",
        "pdf_path": pdf_path,
        "image_path": image_path,
        "source": source,
        "groups": ["latest"],
        "pinned": 0,
    }

    result = add_from_discovery(paper)
    notify_clients()
    return jsonify(result), 201


# ── SSE endpoint ────────────────────────────────────────────────────────────

@app.route("/api/changes")
@login_required
def api_changes():
    def stream():
        q = Queue()
        with _sse_lock:
            _sse_clients.append(q)
        try:
            while True:
                try:
                    msg = q.get(timeout=25)
                    yield f"data: {msg}\n\n"
                except Empty:
                    yield ": ping\n\n"
        except GeneratorExit:
            pass
        finally:
            with _sse_lock:
                try:
                    _sse_clients.remove(q)
                except ValueError:
                    pass

    return Response(
        stream_with_context(stream()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ── Startup ─────────────────────────────────────────────────────────────────

init_db()

# Start folder watcher on a background daemon thread
_watcher = threading.Thread(target=watch_loop, daemon=True)
_watcher.start()

if __name__ == "__main__":
    print(f"\n  Open: http://localhost:5000/")
    print(f"  Watching '{PAPER_FOLDER}' for new PDFs every {POLL_INTERVAL}s")
    print("  Drop a PDF in the folder — the browser tab will refresh automatically.")
    print("  Press Ctrl+C to stop.\n")
    # threaded=True is required so the SSE stream doesn't block other requests
    app.run(debug=True, port=5000, use_reloader=False, threaded=True)
