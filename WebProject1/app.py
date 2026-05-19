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
import base64
import tempfile
from queue import Queue, Empty

from flask import (
    Flask, jsonify, request, send_from_directory,
    Response, stream_with_context, abort, redirect, url_for
)
from werkzeug.utils import secure_filename
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import requests as http_requests
from openai import AzureOpenAI
import fitz  # PyMuPDF

from models import (
    init_db, get_all_papers, search_papers, get_paper, upsert_paper,
    update_paper, delete_paper, paper_exists,
    slugify, infer_year, to_display_title,
    create_user, get_user_by_id, verify_user, user_count
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
        self.id = user_dict["id"]
        self.username = user_dict["username"]


@login_manager.user_loader
def load_user(user_id):
    u = get_user_by_id(int(user_id))
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
    """Read JSON sidecar + detect infographic for a single PDF."""
    base = os.path.splitext(filename)[0]
    sidecar = {}

    for ext in (".jpg", ".JPG", ".jpeg", ".JPEG"):
        jpg_path = os.path.join(PAPER_FOLDER, base + ext)
        if os.path.exists(jpg_path):
            sidecar["infographic"] = PAPER_FOLDER + "/" + base + ext
            break

    jpath = os.path.join(PAPER_FOLDER, base + ".json")
    if os.path.exists(jpath):
        try:
            with open(jpath, "r", encoding="utf-8") as f:
                data = json.load(f)
            for k in ("title", "authors", "year", "preview", "summary",
                      "datacenter", "metrics", "link", "infographic"):
                if k in data:
                    sidecar[k] = data[k]
        except Exception as e:
            print(f"  [warn] sidecar read error {jpath}: {e}")

    return sidecar


def _infer_groups(filename):
    lower = filename.lower()
    groups = ["latest"]
    if "survey" in lower or "technical report" in lower or "benchmark" in lower:
        groups.append("read")
    return groups


def _import_pdf(filename):
    """Import a single PDF into the database."""
    paper_id = f"local-{slugify(filename)}"
    sidecar = _load_sidecar(filename)
    year = sidecar.get("year") or infer_year(filename)
    title = sidecar.get("title") or to_display_title(filename)
    has_groups = isinstance(sidecar.get("groups"), list) and len(sidecar["groups"]) > 0
    groups = sidecar["groups"] if has_groups else _infer_groups(filename)

    upsert_paper({
        "id": paper_id,
        "filename": filename,
        "title": title,
        "authors": sidecar.get("authors", "Repository Paper"),
        "year": year,
        "groups": groups,
        "pinned": 1 if has_groups else 0,
        "preview": sidecar.get("preview", "Local repository entry loaded from your WebProject1 paper folder."),
        "summary": sidecar.get("summary", "This entry is pulled from the local paper repository."),
        "datacenter": sidecar.get("datacenter", "Potentially relevant to accelerator efficiency, cluster architecture, inference economics, or system-level AI deployment tradeoffs."),
        "metrics": sidecar.get("metrics", "Key result signal not yet extracted. Review and annotate this item for production use."),
        "link": sidecar.get("link") or f"{PAPER_FOLDER}/{filename}",
        "infographic": sidecar.get("infographic", ""),
    })


def watch_loop():
    """Background thread: polls the paper folder for new/removed PDFs."""
    last_files = None
    while True:
        try:
            files = sorted(f for f in os.listdir(PAPER_FOLDER) if f.lower().endswith(".pdf"))
        except FileNotFoundError:
            files = []

        if files != last_files:
            # Import any new PDFs
            old_set = set(last_files) if last_files is not None else set()
            for f in files:
                if f not in old_set:
                    _import_pdf(f)
                    print(f"  [watcher] Imported: {f}")

            if last_files is not None:
                now = datetime.datetime.now().strftime("%H:%M:%S")
                print(f"[{now}] Folder change detected — signalling browsers")
                notify_clients()

            last_files = files

        time.sleep(POLL_INTERVAL)


# ── Authentication routes ───────────────────────────────────────────────────

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("serve_index"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        # First user ever → auto-register
        if user_count() == 0 and username and password:
            create_user(username, password)

        user = verify_user(username, password)
        if user:
            login_user(User(user), remember=True)
            next_page = request.args.get("next") or url_for("serve_index")
            return redirect(next_page)
        else:
            return redirect(url_for("login", error="Invalid username or password"))

    return send_from_directory(".", "login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("serve_index"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm", "")

        if not username or not password:
            return redirect(url_for("register", error="Username and password are required"))
        if len(password) < 4:
            return redirect(url_for("register", error="Password must be at least 4 characters"))
        if password != confirm:
            return redirect(url_for("register", error="Passwords do not match"))

        uid = create_user(username, password)
        if uid is None:
            return redirect(url_for("register", error="Username already taken"))

        user = get_user_by_id(uid)
        login_user(User(user), remember=True)
        return redirect(url_for("serve_index"))

    return send_from_directory(".", "register.html")


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
        "filename": filename,
        "title": title,
        "authors": request.form.get("authors", "Repository Paper").strip(),
        "year": year,
        "groups": ["latest"],
        "pinned": 0,
        "preview": request.form.get("preview", "").strip() or "Local repository entry loaded from your WebProject1 paper folder.",
        "summary": request.form.get("summary", "").strip() or "This entry is pulled from the local paper repository.",
        "datacenter": request.form.get("datacenter", "").strip() or "Potentially relevant to accelerator efficiency, cluster architecture, inference economics, or system-level AI deployment tradeoffs.",
        "metrics": request.form.get("metrics", "").strip() or "Key result signal not yet extracted.",
        "link": f"{PAPER_FOLDER}/{filename}",
        "infographic": "",
    }

    upsert_paper(paper)
    notify_clients()

    return jsonify(get_paper(paper_id)), 201


@app.route("/api/papers/<paper_id>", methods=["PUT"])
@login_required
def api_update_paper(paper_id):
    """Update metadata fields for an existing paper."""
    p = get_paper(paper_id)
    if not p:
        abort(404)

    fields = request.get_json(silent=True) or {}
    updated = update_paper(paper_id, fields)
    if updated is None:
        return jsonify({"error": "No valid fields provided"}), 400

    notify_clients()
    return jsonify(updated)


@app.route("/api/papers/<paper_id>", methods=["DELETE"])
@login_required
def api_delete_paper(paper_id):
    """Delete a paper from the database and remove its files from disk."""
    filename = delete_paper(paper_id)
    if filename is None:
        abort(404)

    # Clean up files on disk
    pdf_path = os.path.join(PAPER_FOLDER, filename)
    if os.path.exists(pdf_path):
        os.remove(pdf_path)

    base = os.path.splitext(filename)[0]
    json_path = os.path.join(PAPER_FOLDER, base + ".json")
    if os.path.exists(json_path):
        os.remove(json_path)

    notify_clients()
    return "", 204


# ── REST API: Image Generation ──────────────────────────────────────────────

@app.route("/api/papers/<paper_id>/generate-images", methods=["POST"])
@login_required
def api_generate_images(paper_id):
    """Generate best-figure and infographic for a library paper."""
    paper = get_paper(paper_id)
    if not paper:
        abort(404)

    result = {"best_figure": None, "generated_infographic": None, "errors": []}

    # Extract best figure from PDF
    pdf_path = os.path.join(PAPER_FOLDER, paper.get("filename", ""))
    if os.path.exists(pdf_path):
        try:
            fig_path = _extract_best_figure(pdf_path, paper_id)
            if fig_path:
                update_paper(paper_id, {"best_figure": fig_path})
                result["best_figure"] = fig_path
            else:
                result["errors"].append("Best figure extraction returned no result")
        except Exception as e:
            result["errors"].append(f"Best figure extraction failed: {e}")
    else:
        result["errors"].append(f"PDF not found: {paper.get('filename', '')}")

    # Generate infographic
    try:
        info_path = _generate_infographic(paper, paper_id)
        if info_path:
            update_paper(paper_id, {"generated_infographic": info_path})
            result["generated_infographic"] = info_path
        else:
            result["errors"].append("Infographic generation returned no result (model may not support image generation)")
    except Exception as e:
        result["errors"].append(f"Infographic generation failed: {e}")

    notify_clients()

    status = 200 if (result["best_figure"] or result["generated_infographic"]) else 502
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

    try:
        figure_b64 = _extract_figure_from_url(pdf_url)
        if figure_b64:
            return jsonify({"figure_base64": figure_b64})
        return jsonify({"error": "Could not extract figure from PDF"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── REST API: AI-Powered Discovery ──────────────────────────────────────────

PROXY_URL = os.environ.get("HTTP_PROXY", "http://proxy-dmz.intel.com:912")
_proxies = {"http": PROXY_URL, "https": PROXY_URL}

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


def _render_single_page(pdf_path, page_num, dpi=250):
    """Render a single PDF page at higher DPI. Returns JPEG bytes."""
    doc = fitz.open(pdf_path)
    page = doc[min(page_num, len(doc) - 1)]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    data = pix.tobytes("jpeg", 90)
    doc.close()
    return data


def _crop_figure_from_page(pdf_path, page_num, client, deployment):
    """Extract the best figure image from a PDF page.

    Strategy (in order):
    1. Use PyMuPDF to extract embedded images from the page.  Pick the
       largest one (by pixel area) that isn't a tiny icon.
    2. If no suitable embedded image is found, fall back to a GPT-4o
       vision call to get a bounding box, then crop the rendered page.
    3. If that also fails, return the full page.
    """
    doc = fitz.open(pdf_path)
    page = doc[min(page_num, len(doc) - 1)]

    # ── Strategy 1: extract embedded images directly ──────────────
    best_img_bytes = None
    best_area = 0
    try:
        for img_info in page.get_images(full=True):
            xref = img_info[0]
            base_image = doc.extract_image(xref)
            if not base_image or not base_image.get("image"):
                continue
            w, h = base_image.get("width", 0), base_image.get("height", 0)
            area = w * h
            # Skip tiny images (icons, logos, bullets) — require at least 150×150
            if w < 150 or h < 150:
                continue
            if area > best_area:
                best_area = area
                best_img_bytes = base_image["image"]
    except Exception as e:
        print(f"  [Image] Embedded image extraction failed: {e}")

    if best_img_bytes and best_area >= 100_000:
        doc.close()
        print(f"  [Image] Extracted embedded image ({best_area} px²) from page {page_num}")
        # Re-encode as JPEG if needed (embedded images can be PNG, JPEG, etc.)
        try:
            pix = fitz.Pixmap(best_img_bytes)
            if pix.alpha:
                pix = fitz.Pixmap(fitz.csRGB, pix)  # drop alpha channel
            return pix.tobytes("jpeg", 92)
        except Exception:
            return best_img_bytes

    # ── Strategy 2: GPT-4o vision bounding box ────────────────────
    print(f"  [Image] No large embedded image on page {page_num}, trying GPT-4o bbox")
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

    # ── Render cropped region (or full page fallback) ─────────────
    render_dpi = 300
    if bbox:
        x1, y1, x2, y2 = bbox
        pw, ph = page.rect.width, page.rect.height
        clip = fitz.Rect(x1 * pw, y1 * ph, x2 * pw, y2 * ph)
        mat = fitz.Matrix(render_dpi / 72, render_dpi / 72)
        pix = page.get_pixmap(matrix=mat, clip=clip)
    else:
        mat = fitz.Matrix(render_dpi / 72, render_dpi / 72)
        pix = page.get_pixmap(matrix=mat)

    result = pix.tobytes("jpeg", 92)
    doc.close()
    return result


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
        # Fallback: pick page 2 (often has architecture diagram)
        best_page = min(1, len(pages) - 1)

    # Crop just the figure from the chosen page and save
    hq_bytes = _crop_figure_from_page(pdf_path, best_page, client, deployment)
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
        f"Create a clean, professional technical infographic for an academic paper titled "
        f"\"{paper_dict.get('title', 'AI Research Paper')}\". "
        f"Key points to visualize: {paper_dict.get('summary', '')[:300]}. "
        f"Datacenter relevance: {paper_dict.get('datacenter', '')[:200]}. "
        f"Key metrics: {paper_dict.get('metrics', '')[:150]}. "
        f"Style: modern flat design, datacenter/AI theme, blue and teal color palette, "
        f"clean icons, minimal text, suitable as a thumbnail for an academic paper portal. "
        f"Do NOT include any text that looks like a title or heading."
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
    """Download a PDF from URL, extract best figure, return base64 data URL or None."""
    client = _get_azure_client()
    if client is None:
        return None

    # Download PDF to temp file
    try:
        r = http_requests.get(pdf_url, timeout=30, proxies=_proxies, stream=True)
        if not r.ok:
            return None
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            for chunk in r.iter_content(8192):
                tmp.write(chunk)
            tmp_path = tmp.name
    except Exception as e:
        print(f"  [Image] PDF download failed: {e}")
        return None

    try:
        deployment = (_azure_cfg or {}).get("deployment", "gpt-4o")
        pages = _render_pdf_pages(tmp_path, dpi=100, max_pages=10)
        if not pages:
            return None

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
        except Exception:
            best_page = min(1, len(pages) - 1)

        hq_bytes = _crop_figure_from_page(tmp_path, best_page, client, deployment)
        b64_str = base64.b64encode(hq_bytes).decode("ascii")
        return f"data:image/jpeg;base64,{b64_str}"
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

# ── LLM paper recommendation ───────────────────────────────────────────────

_LLM_SYSTEM_PROMPT = """You are an expert AI research librarian specializing in datacenter architecture, AI/ML systems, GPU/accelerator design, large language model infrastructure, and high-performance computing.

Your task: Given a research topic, recommend exactly 10 highly relevant, real academic papers or technical reports. Prioritize:
1. Seminal papers that system architects and datacenter engineers must know
2. Recent breakthrough papers (2023-2026) with measurable impact
3. Papers from top venues (NeurIPS, ICML, ISCA, MICRO, ASPLOS, MLSys, arXiv)
4. Papers with concrete datacenter/infrastructure implications

Return a JSON object with a single key "papers" containing an array of exactly 10 objects. Each object must have:
- "title": exact paper title (be precise — this will be used for lookup)
- "authors": comma-separated author names (first 3-4 authors)
- "year": publication year (integer)
- "summary": 2-3 sentence technical summary focusing on the key contribution
- "datacenter_relevance": 1 sentence on why this matters for datacenter architects
- "key_metrics": specific quantitative results or impact metrics from the paper

Only recommend papers you are highly confident actually exist. Do not fabricate titles."""

def _llm_recommend_papers(query):
    """Ask Azure OpenAI for paper recommendations. Returns list of dicts or empty list."""
    client = _get_azure_client()
    if client is None:
        return []
    deployment = (_azure_cfg or {}).get("deployment", "gpt-4o")
    try:
        completion = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": _LLM_SYSTEM_PROMPT},
                {"role": "user", "content": f"Recommend 10 papers on: {query}"},
            ],
            max_tokens=4096,
            temperature=0.7,
            top_p=0.95,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content
        data = json.loads(raw)
        papers = data.get("papers", [])
        if isinstance(papers, list):
            return papers[:10]
    except Exception as e:
        print(f"  [AI Discovery] LLM error: {e}")
    return []

# ── Semantic Scholar validation ─────────────────────────────────────────────

def _validate_with_semantic_scholar(llm_papers):
    """Enrich LLM-recommended papers with real links from Semantic Scholar."""
    enriched = []
    for paper in llm_papers:
        title = paper.get("title", "")
        if not title:
            enriched.append(paper)
            continue
        try:
            r = http_requests.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params={
                    "query": title,
                    "limit": 3,
                    "fields": "title,authors,year,abstract,externalIds,openAccessPdf,url,citationCount",
                },
                timeout=10,
                proxies=_proxies,
            )
            if r.ok:
                results = r.json().get("data", [])
                # Find best match by title similarity
                best = None
                title_lower = title.lower().strip()
                for result in results:
                    result_title = (result.get("title") or "").lower().strip()
                    if result_title == title_lower or title_lower in result_title or result_title in title_lower:
                        best = result
                        break
                if best is None and results:
                    best = results[0]  # fall back to top result
                if best:
                    # Enrich with real data
                    oa_pdf = best.get("openAccessPdf") or {}
                    ext_ids = best.get("externalIds") or {}
                    arxiv_id = ext_ids.get("ArXiv")
                    doi = ext_ids.get("DOI")
                    link = (oa_pdf.get("url")
                            or (f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else None)
                            or (f"https://doi.org/{doi}" if doi else None)
                            or best.get("url")
                            or "")
                    paper["link"] = link
                    paper["citation_count"] = best.get("citationCount", 0)
                    if best.get("abstract"):
                        paper["abstract"] = best["abstract"][:400]
                    if best.get("year"):
                        paper["year"] = best["year"]
                    # Use Semantic Scholar's canonical title if very close
                    if best.get("title"):
                        paper["title"] = best["title"]
                    if best.get("authors"):
                        paper["authors"] = ", ".join(
                            a.get("name", "") for a in best["authors"][:4]
                        )
        except Exception as e:
            print(f"  [AI Discovery] Semantic Scholar lookup failed for '{title[:40]}': {e}")
        enriched.append(paper)
        time.sleep(0.15)  # rate-limit: ~6.6 req/sec (under 100/min limit)
    return enriched

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


def _infer_datacenter_impact(text):
    lower = text.lower()
    if any(w in lower for w in ("mixture", "moe", "expert")):
        return "This likely affects sparse routing behavior, all-to-all traffic patterns, and cluster scheduling strategy for MoE workloads."
    if any(w in lower for w in ("inference", "serving", "latency")):
        return "This is likely relevant to serving economics, memory footprint control, and latency-throughput tuning in production datacenters."
    if any(w in lower for w in ("dataflow", "interconnect", "memory")):
        return "This likely impacts memory hierarchy design, interconnect utilization, and accelerator data movement efficiency."
    return "This likely provides useful guidance for balancing quality, throughput, and total infrastructure cost in enterprise AI clusters."


def _infer_key_result(text, year):
    m = re.search(r'\b\d+(?:\.\d+)?\s?(?:x|%|b|m|tokens|gpu|gpus|ms)\b', text, re.IGNORECASE)
    if m:
        return f"Key result signal: reported metric includes {m.group(0)}, indicating measurable system or model impact."
    return f"Key result signal: recent ({year}) technical contribution with architecture relevance worth deeper validation."


def _llm_paper_to_discovery(paper, index):
    """Convert an LLM-recommended paper dict to our standard discovery format."""
    title = (paper.get("title") or "Untitled AI paper").strip()
    year = int(paper.get("year", datetime.datetime.now().year))
    authors = paper.get("authors", "AI Discovery")
    link = paper.get("link", "")
    summary = paper.get("summary", "")
    abstract = paper.get("abstract", "")
    full_text = abstract if abstract else summary
    preview = full_text[:148] if full_text else summary[:148]
    datacenter = paper.get("datacenter_relevance") or _infer_datacenter_impact(f"{title} {summary}")
    metrics = paper.get("key_metrics") or _infer_key_result(summary, year)
    citations = paper.get("citation_count")
    if citations and isinstance(citations, int) and citations > 0:
        metrics = f"{metrics} ({citations:,} citations)"

    return {
        "id": f"ai-rec-{slugify(f'{title}-{year}-{index}')}",
        "title": title, "authors": authors, "year": year,
        "groups": ["latest", "read"],
        "preview": preview,
        "summary": (full_text or summary) + ("" if (full_text or summary).endswith(".") else "."),
        "datacenter": datacenter,
        "metrics": metrics,
        "link": link, "isDiscovery": True,
        "source": "ai-recommended",
        "_pubDate": f"{year}-01-01",
    }


def _openalex_to_paper(entry, index):
    title = (entry.get("title") or "Untitled discovery paper").strip()
    pub_date = entry.get("publication_date", "")
    year = int(pub_date[:4]) if pub_date else datetime.datetime.now().year
    authorships = entry.get("authorships") or []
    authors = ", ".join(
        a.get("author", {}).get("display_name", "") for a in authorships[:3]
    ) or "Web Discovery"
    link = (entry.get("open_access") or {}).get("oa_url") or entry.get("doi") or "https://openalex.org"
    abstract = _clean_abstract(_reconstruct_abstract(entry.get("abstract_inverted_index")))
    summary_base = abstract[:320] if len(abstract) > 60 else \
        "This result was discovered from the live search and appears relevant to LLM architecture, MoE, or dataflow optimization."

    return {
        "id": f"web-live-{slugify(f'{title}-{year}-{index}')}",
        "title": title, "authors": authors, "year": year,
        "groups": ["latest", "read"],
        "preview": summary_base[:148],
        "summary": summary_base + ("" if summary_base.endswith(".") else "."),
        "datacenter": _infer_datacenter_impact(f"{title} {summary_base}"),
        "metrics": _infer_key_result(summary_base, year),
        "link": link, "isDiscovery": True,
        "source": "openalex",
        "_pubDate": pub_date or f"{year}-01-01",
    }


@app.route("/api/discover", methods=["GET"])
@login_required
def api_discover():
    global _discovery_query_index

    # Accept free-text query or fall back to rotating predefined topic
    query_text = request.args.get("q", "").strip()
    if not query_text:
        query_text = _DISCOVERY_QUERIES[_discovery_query_index % len(_DISCOVERY_QUERIES)]
        _discovery_query_index += 1

    results = []
    errors = []
    ai_available = _get_azure_client() is not None

    # Stage 1: LLM paper recommendations (primary source)
    if ai_available:
        try:
            llm_papers = _llm_recommend_papers(query_text)
            if llm_papers:
                # Stage 2: Enrich with Semantic Scholar real links
                llm_papers = _validate_with_semantic_scholar(llm_papers)
                for i, paper in enumerate(llm_papers):
                    results.append(_llm_paper_to_discovery(paper, i))
        except Exception as e:
            errors.append(f"AI recommendation: {e}")

    # Stage 3: OpenAlex supplemental search
    try:
        year_from = request.args.get("year_from", "2020", type=str)
        year_to = request.args.get("year_to", "2026", type=str)
        oa_filter = f"publication_date:>{year_from}-01-01,publication_date:<{year_to}-12-31"
        r = http_requests.get(
            "https://api.openalex.org/works",
            params={"search": query_text, "sort": "publication_date:desc",
                    "filter": oa_filter, "per-page": "15"},
            headers={"Accept": "application/json"},
            timeout=15,
            proxies=_proxies,
        )
        if r.ok:
            for i, entry in enumerate(r.json().get("results", [])):
                results.append(_openalex_to_paper(entry, i))
        else:
            errors.append(f"OpenAlex returned HTTP {r.status_code}")
    except Exception as e:
        errors.append(f"OpenAlex: {e}")

    if not results and errors:
        return jsonify({"error": "All sources failed", "details": errors}), 502

    # Dedupe against local library
    local_titles = {p["title"].lower().strip() for p in get_all_papers()}
    results = [r for r in results if r["title"].lower().strip() not in local_titles]

    # Dedupe within results (AI-recommended first, so they win on conflicts)
    seen = set()
    deduped = []
    for r in results:
        key = r["title"].lower().strip()
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    # Sort: AI-recommended first, then by date
    deduped.sort(key=lambda x: (0 if x.get("source") == "ai-recommended" else 1, x.get("_pubDate", "")), reverse=False)
    # Actually: AI first, then within each group reverse-chronological
    ai_papers = [d for d in deduped if d.get("source") == "ai-recommended"]
    oa_papers = [d for d in deduped if d.get("source") != "ai-recommended"]
    oa_papers.sort(key=lambda x: x.get("_pubDate", ""), reverse=True)
    final = ai_papers + oa_papers

    return jsonify({
        "results": final[:30],
        "query": query_text,
        "ai_available": ai_available,
        "errors": errors,
    })


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
