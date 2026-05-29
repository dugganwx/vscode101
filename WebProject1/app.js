// ── AI Architecture Papers Portal — SPA with 3 pages ──────────────────────
// Page 1: Discovery — AI-powered paper search with year range
// Page 2: Search Library — text search within local library + upload
// Page 3: Library View — all papers + filters + full summaries

let discoveredWebPapers = [];
let dynamicLocalPapers = [];
let papers = [];
let activeFilter = "all";
let _discoverySourceCounts = { arxiv: 0, openalex: 0, "core-pr": 0 };
let _discoverySourceErrors = { arxiv: null, openalex: null, "core-pr": null };
let _liveCitationCounts = {}; // { paper_id: int | null } — null means could not be retrieved

// ── DOM refs ───────────────────────────────────────────────────────────────

const discoveryFeedEl     = document.getElementById("discoveryFeed");
const discoveryCountEl    = document.getElementById("discoveryCount");
const discoveryQueryEl    = document.getElementById("discoveryQuery");
const discoveryStatusEl   = document.getElementById("discoveryStatus");
const discoveryProgressWrapEl = document.getElementById("discoveryProgressWrap");
const discoveryProgressFillEl = document.getElementById("discoveryProgressFill");
const discoveryProgressTextEl = document.getElementById("discoveryProgressText");
const findNewPapersBtn    = document.getElementById("findNewPapersBtn");
const rankTeamBtns        = [...document.querySelectorAll(".rank-papers-btn[data-team]")];
const rankingCriteriaTeamBtns = [...document.querySelectorAll(".ranking-criteria-pill[data-team]")];
const resetRankingCriteriaBtn = document.getElementById("resetRankingCriteriaBtn");
const backToDiscoveryBtn = document.getElementById("backToDiscoveryBtn");
const rankingCriteriaListEl = document.getElementById("rankingCriteriaList");
const rankingCriteriaTitleEl = document.getElementById("rankingCriteriaTitle");
const rankingCriteriaCopyEl = document.getElementById("rankingCriteriaCopy");
const librarySearchFeedEl = document.getElementById("librarySearchFeed");
const librarySearchInput  = document.getElementById("librarySearchInput");
const librarySearchCount  = document.getElementById("librarySearchCount");
const libraryFeedEl       = document.getElementById("libraryFeed");
const feedCountEl         = document.getElementById("feedCount");
const sectionEl           = document.getElementById("fullSections");
const filterButtons       = [...document.querySelectorAll(".filter-btn")];

let _rankingCriteriaLoaded = false;
let _rankingCriteriaState = [];
let _criteriaSaveTimer = null;
let _activeCriteriaTeam = "oie";
let _discoveryEmptyReason = "";
let _discoveryProgressPollTimer = null;
let _discoverySearchInFlight = false;
let _discoveryRankInFlight = false;
let _discoverySearchContext = { query: "", year_from: "2020", year_to: "2026" };

const _rankingTeams = {
  oie: { code: "OIE", label: "OIE - AI on GPU Optimization" },
  e2o: { code: "E2O", label: "E2O - Network, Switch, Optical" },
  ai_on_ia: { code: "AI on iA", label: "AI on iA - Agentic and Head Node CPU Optimization" },
  hickory_delta: { code: "Hickory Delta", label: "Hickory Delta - Cache, Reliability, Wafer Scale" },
};

function _getTeamLabel(teamId) {
  return (_rankingTeams[teamId] || {}).label || teamId;
}

function _setAllRankButtonsDisabled(disabled) {
  rankTeamBtns.forEach((btn) => { btn.disabled = !!disabled; });
}

function _setRankButtonsEnabledByResults() {
  const enabled = !_discoveryRankInFlight && !_discoverySearchInFlight && discoveredWebPapers.length > 0;
  rankTeamBtns.forEach((btn) => { btn.disabled = !enabled; });
}

function _renderDiscoveryCount() {
  if (!discoveryCountEl) return;
  const fmt = (src) => {
    const err = _discoverySourceErrors?.[src];
    if (err) return err;
    return String(Number(_discoverySourceCounts?.[src] || 0));
  };
  const sourceText = `CORE:${fmt("core-pr")} | arXiv:${fmt("arxiv")} | OpenAlex:${fmt("openalex")}`;
  discoveryCountEl.textContent = `${sourceText} | ${discoveredWebPapers.length} results`;
}

function _setDiscoveryProgressBar(processed, total, active, text) {
  if (!discoveryProgressWrapEl || !discoveryProgressFillEl || !discoveryProgressTextEl) return;
  const safeTotal = Math.max(0, parseInt(total || 0, 10));
  const safeProcessed = Math.max(0, parseInt(processed || 0, 10));
  const ratio = safeTotal > 0 ? Math.min(1, Math.max(0, safeProcessed / safeTotal)) : 0;

  discoveryProgressWrapEl.classList.toggle("is-active", !!active);
  discoveryProgressFillEl.style.width = `${(ratio * 100).toFixed(1)}%`;

  if (text) {
    discoveryProgressTextEl.textContent = text;
  } else if (safeTotal > 0) {
    discoveryProgressTextEl.textContent = `Ranking ${Math.min(safeProcessed, safeTotal)} of ${safeTotal} papers`;
  } else {
    discoveryProgressTextEl.textContent = "Search first, then click one team rank button.";
  }
}

async function _pollDiscoveryProgress() {
  try {
    const res = await fetch("/api/discover/progress");
    if (!res.ok) return;
    const data = await res.json();
    const processed = Number(data.processed || 0);
    const total = Number(data.total || 0);
    const active = !!data.active;
    const text = data.message || "";
    if (data.source_counts && typeof data.source_counts === "object") {
      _discoverySourceCounts = {
        "core-pr": Number(data.source_counts["core-pr"] || 0),
        arxiv: Number(data.source_counts.arxiv || 0),
        openalex: Number(data.source_counts.openalex || 0),
      };
    }
    if (data.source_errors && typeof data.source_errors === "object") {
      _discoverySourceErrors = {
        "core-pr": data.source_errors["core-pr"] || null,
        arxiv: data.source_errors.arxiv || null,
        openalex: data.source_errors.openalex || null,
      };
    }
    if (data.source_counts || data.source_errors) {
      _renderDiscoveryCount();
    }
    _setDiscoveryProgressBar(processed, total, active, text);
  } catch (_) {}
}

function _startDiscoveryProgressPolling() {
  _stopDiscoveryProgressPolling();
  _pollDiscoveryProgress();
  _discoveryProgressPollTimer = setInterval(_pollDiscoveryProgress, 500);
}

function _stopDiscoveryProgressPolling() {
  if (_discoveryProgressPollTimer) {
    clearInterval(_discoveryProgressPollTimer);
    _discoveryProgressPollTimer = null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(value) {
  return value.toLowerCase().replace(/\.pdf$/i, "").replace(/^[0-9]+\./, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function groupLabel(group) {
  if (group === "important") return "Most Important";
  if (group === "read")      return "Most Read";
  if (group === "latest")    return "Latest";
  if (group === "citations") return "Most Citations";
  return group;
}

function groupClass(group) { return group; }

function discoverySourceLabel(source) {
  const labels = {
    "core-pr": "CORE Paper Repository",
    openalex: "OpenAlex",
    arxiv: "arXiv",
    "multi-source": "Multi-source",
  };
  return labels[source] || "Verified Index";
}

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Importance scorer ──────────────────────────────────────────────────────

const _hwTier1 = [
  /\bgpu\b/i, /\btpu\b/i, /\bcuda\b/i, /\brocm\b/i, /\baccelerator\b/i,
  /\basic\b/i, /\bsystolic\b/i, /\bgemm\b/i, /tensor\s*core/i, /matrix\s*core/i,
  /\binterconnect\b/i, /\bnvlink\b/i, /\binfiniband\b/i, /\bhbm\b/i,
  /\bbandwidth\b/i, /\bmi300\b/i, /\bcdna\b/i, /\bh100\b/i, /\ba100\b/i,
  /\bhopper\b/i, /\bblackwell\b/i, /\bdataflow\b/i, /\bphotonic\b/i,
  /\bflops\b/i, /\bthroughput\b/i, /\btdp\b/i, /\bwafer\b/i,
];
const _hwTier2 = [
  /\binference\b/i, /\bserving\b/i, /quantiz/i, /\bfp8\b/i, /\bfp4\b/i,
  /\bint8\b/i, /\bsparsit/i, /\bparallelism\b/i, /\bdistributed\b/i,
  /kv[\s-]?cache/i, /\bdatacenter\b/i, /\btco\b/i, /\blatency\b/i,
  /\befficiency\b/i, /speculative\s*decod/i, /\bcompression\b/i, /fine[\s-]?tun/i,
];

function _hwImportanceScore(paper) {
  const corpus = [paper.title, paper.preview, paper.summary, paper.datacenter, paper.metrics].join(" ").toLowerCase();
  let score = 0;
  for (const re of _hwTier1) { if (re.test(corpus)) score += 4; }
  for (const re of _hwTier2) { if (re.test(corpus)) score += 2; }
  const currentYear = new Date().getFullYear();
  score += Math.max(0, 8 - (currentYear - paper.year));
  paper._importanceScore = score;
  return score;
}

function tagImportantPapers(paperList) {
  const TOP_N = 5;
  const eligible = paperList.filter((p) => !p._hasSidecarGroups);
  eligible.slice().sort((a, b) => _hwImportanceScore(b) - _hwImportanceScore(a))
    .forEach((paper, idx) => {
      if (idx < TOP_N) {
        if (!paper.groups.includes("important")) paper.groups.push("important");
      } else {
        paper.groups = paper.groups.filter((g) => g !== "important");
      }
    });
}

function tagMostCitedPapers(paperList) {
  const TOP_N = 5;
  // All papers are eligible — live counts override stored values
  const eligible = paperList.slice();
  eligible.sort((a, b) => {
    const ca = typeof a.live_citation_count === "number" ? a.live_citation_count : -1;
    const cb = typeof b.live_citation_count === "number" ? b.live_citation_count : -1;
    return cb - ca;
  });
  eligible.forEach((paper, idx) => {
    const count = typeof paper.live_citation_count === "number" ? paper.live_citation_count : -1;
    if (idx < TOP_N && count > 0) {
      if (!paper.groups.includes("citations")) paper.groups.push("citations");
    } else {
      paper.groups = paper.groups.filter((g) => g !== "citations");
    }
  });
}

function rebuildPapers() {
  papers = [...dynamicLocalPapers];
  // Apply any already-fetched live citation counts
  if (Object.keys(_liveCitationCounts).length > 0) {
    papers.forEach((p) => {
      if (p.id in _liveCitationCounts) p.live_citation_count = _liveCitationCounts[p.id];
    });
  }
  tagImportantPapers(papers);
  tagMostCitedPapers(papers);
}

async function _refreshCitationCounts() {
  try {
    const res = await fetch("/api/papers/citation-counts");
    if (!res.ok) return;
    _liveCitationCounts = await res.json();
    // Apply to current papers array
    papers.forEach((p) => {
      if (p.id in _liveCitationCounts) p.live_citation_count = _liveCitationCounts[p.id];
    });
    tagMostCitedPapers(papers);
    // Re-render whichever library view is active
    const activePage = document.querySelector(".page-section.page-active");
    if (activePage && activePage.id === "page-library-view") {
      renderLibraryView();
      renderFullSections();
    }
  } catch (_) {}
}

// ── API calls ──────────────────────────────────────────────────────────────

let _lastPapersJSON = "";

async function fetchPapersFromApi() {
  try {
    const res = await fetch("/api/papers");
    if (!res.ok) return;
    const data = await res.json();
    const json = JSON.stringify(data);
    if (json === _lastPapersJSON) return;
    _lastPapersJSON = json;
    dynamicLocalPapers = data.map((p) => ({
      ...p, isLocal: true,
      _hasSidecarGroups: !!p._hasSidecarGroups,
      groups: Array.isArray(p.groups) ? p.groups : [],
    }));
    rebuildPapers();
    // Re-render whichever page is active
    const activePage = document.querySelector(".page-section.page-active");
    if (activePage) {
      if (activePage.id === "page-search-library") renderSearchLibrary();
      if (activePage.id === "page-library-view") { renderLibraryView(); renderFullSections(); }
    }
  } catch (_) {}
}

async function uploadPaper(file, metadata) {
  const form = new FormData();
  form.append("pdf", file);
  for (const [k, v] of Object.entries(metadata)) { if (v) form.append(k, v); }
  const res = await fetch("/api/papers", { method: "POST", body: form });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Upload failed"); }
  await fetchPapersFromApi();
}

async function updatePaperMetadata(paperId, fields) {
  const res = await fetch(`/api/papers/${encodeURIComponent(paperId)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("Update failed");
  await fetchPapersFromApi();
}

async function deletePaperById(paperId) {
  const res = await fetch(`/api/papers/${encodeURIComponent(paperId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
  await fetchPapersFromApi();
}

// ── Image placeholder SVG ──────────────────────────────────────────────────

const _imgPlaceholder = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef2f8" rx="4"/><rect x="20" y="20" width="260" height="160" fill="none" stroke="#c8d8d2" stroke-width="1" rx="3"/><text x="150" y="96" text-anchor="middle" font-family="monospace" font-size="11" fill="#4a5d66" dominant-baseline="middle">No image</text></svg>'
)}`;

// ── Image generation API calls ─────────────────────────────────────────────

async function generateImagesForPaper(paperId) {
  const res = await fetch(`/api/papers/${encodeURIComponent(paperId)}/generate-images`, { method: "POST" });
  const data = await res.json();
  if (!res.ok && !data.best_figure && !data.generated_infographic) {
    throw new Error((data.errors || []).join("; ") || "Image generation failed");
  }
  return data;
}

async function findDiscoveryFigure(pdfUrl) {
  const res = await fetch("/api/discover/figure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdf_url: pdfUrl }),
  });
  const data = await res.json();
  const status = (data.status || "").toLowerCase();
  if (!res.ok || status === "error") {
    throw new Error(data.message || data.error || "Could not extract figure");
  }
  if (!data.status) {
    data.status = data.figure_base64 ? "found" : "none";
  }
  return data;
}

async function fetchDiscoveryPdfPage(payload) {
  const res = await fetch("/api/discover/pdf-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not load PDF page");
  }
  return data;
}

async function submitDiscoveryManualBBox(payload) {
  const res = await fetch("/api/discover/figure/manual-bbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not save manual crop");
  }
  return data;
}

async function fetchRankingCriteria(teamId) {
  const res = await fetch(`/api/discover/ranking-criteria?team=${encodeURIComponent(teamId)}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load ranking criteria");
  return Array.isArray(data.criteria) ? data.criteria : [];
}

async function updateRankingCriteria(teamId, criteria) {
  const res = await fetch("/api/discover/ranking-criteria", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    body: JSON.stringify({ team: teamId, criteria }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not save ranking criteria");
  return Array.isArray(data.criteria) ? data.criteria : [];
}

async function resetRankingCriteriaToDefaults(teamId) {
  const res = await fetch("/api/discover/ranking-criteria", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    body: JSON.stringify({ team: teamId, reset_defaults: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not reset ranking criteria");
  return Array.isArray(data.criteria) ? data.criteria : [];
}

function _calcRelativeWeightPercent(items, key) {
  const total = items.reduce((acc, it) => acc + Math.max(0, parseFloat(it.slider) || 0), 0);
  if (total <= 0) return 0;
  const me = Math.max(0, parseFloat((items.find((it) => it.key === key) || {}).slider) || 0);
  return (me / total) * 100;
}

function _setCriteriaSaveStatus(text) {
  if (!rankingCriteriaListEl) return;
  let status = document.getElementById("criteriaSaveStatus");
  if (!status) {
    status = document.createElement("div");
    status.id = "criteriaSaveStatus";
    status.className = "criteria-save-status";
    rankingCriteriaListEl.insertAdjacentElement("afterend", status);
  }
  status.textContent = text;
}

function _scheduleCriteriaSave() {
  if (_criteriaSaveTimer) clearTimeout(_criteriaSaveTimer);
  _setCriteriaSaveStatus("Saving changes...");
  _criteriaSaveTimer = setTimeout(async () => {
    try {
      const payload = _rankingCriteriaState.map((item) => ({
        key: item.key,
        question: item.question,
        slider: item.slider,
      }));
      const saved = await updateRankingCriteria(_activeCriteriaTeam, payload);
      _rankingCriteriaState = saved.map((it) => ({ ...it }));
      renderRankingCriteria(_rankingCriteriaState);
      _setCriteriaSaveStatus(`Saved. ${_getTeamLabel(_activeCriteriaTeam)} ranking now uses these questions and weights.`);
    } catch (e) {
      _setCriteriaSaveStatus(`Save failed: ${e.message || "try again"}`);
    }
  }, 350);
}

function renderRankingCriteria(items) {
  if (!rankingCriteriaListEl) return;
  if (!items.length) {
    rankingCriteriaListEl.innerHTML = `<div class="criteria-item"><span class="criteria-question">No ranking criteria available.</span><span>-</span><span class="criteria-weight">-</span></div>`;
    return;
  }
  rankingCriteriaListEl.innerHTML = items.map((item) => `
    <div class="criteria-item" data-criteria-key="${escapeHtml(item.key || "")}">
      <span class="criteria-question" data-question-text tabindex="0">${escapeHtml(item.question || item.key || "Unnamed criterion")}</span>
      <label class="criteria-slider-wrap">
        <input class="criteria-slider" type="range" min="0" max="10" step="1" value="${Number.isFinite(parseFloat(item.slider)) ? parseFloat(item.slider) : 0}" data-slider-input />
        <span class="criteria-slider-value" data-slider-value>${Number.isFinite(parseFloat(item.slider)) ? parseFloat(item.slider).toFixed(0) : "0"}</span>
      </label>
      <span class="criteria-weight">${_calcRelativeWeightPercent(items, item.key).toFixed(1)}%</span>
    </div>
  `).join("");

  rankingCriteriaListEl.querySelectorAll(".criteria-item").forEach((row) => {
    const key = row.getAttribute("data-criteria-key");
    const qEl = row.querySelector("[data-question-text]");
    const sliderEl = row.querySelector("[data-slider-input]");
    const sliderValueEl = row.querySelector("[data-slider-value]");

    if (qEl) {
      const startEdit = () => {
        const current = (_rankingCriteriaState.find((it) => it.key === key) || {}).question || "";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "criteria-question-edit";
        input.value = current;
        qEl.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => {
          const nextText = (input.value || "").trim() || current;
          const rec = _rankingCriteriaState.find((it) => it.key === key);
          if (rec && rec.question !== nextText) {
            rec.question = nextText;
            _scheduleCriteriaSave();
          } else {
            renderRankingCriteria(_rankingCriteriaState);
          }
        };

        input.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter") {
            evt.preventDefault();
            commit();
          }
          if (evt.key === "Escape") {
            renderRankingCriteria(_rankingCriteriaState);
          }
        });
        input.addEventListener("blur", commit);
      };

      qEl.addEventListener("click", startEdit);
      qEl.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          evt.preventDefault();
          startEdit();
        }
      });
    }

    if (sliderEl && sliderValueEl) {
      sliderEl.addEventListener("input", () => {
        sliderValueEl.textContent = String(parseInt(sliderEl.value, 10));
        const rec = _rankingCriteriaState.find((it) => it.key === key);
        if (rec) rec.slider = parseInt(sliderEl.value, 10);
        rankingCriteriaListEl.querySelectorAll(".criteria-item").forEach((weightRow) => {
          const wk = weightRow.getAttribute("data-criteria-key");
          const weightEl = weightRow.querySelector(".criteria-weight");
          if (weightEl) weightEl.textContent = `${_calcRelativeWeightPercent(_rankingCriteriaState, wk).toFixed(1)}%`;
        });
        _scheduleCriteriaSave();
      });
    }
  });
}

async function openRankingCriteriaPage(teamId) {
  _activeCriteriaTeam = teamId;
  switchPage("page-discovery-criteria");
  if (rankingCriteriaTitleEl) {
    rankingCriteriaTitleEl.textContent = `Discovery Ranking Criteria - ${_getTeamLabel(teamId)}`;
  }
  if (rankingCriteriaCopyEl) {
    rankingCriteriaCopyEl.textContent = "Edit question wording and importance sliders. Changes apply only to the selected team.";
  }
  if (!rankingCriteriaListEl) return;
  rankingCriteriaListEl.innerHTML = `<div class="criteria-item"><span class="criteria-question">Loading ranking criteria...</span><span>...</span><span class="criteria-weight">...</span></div>`;
  try {
    const items = await fetchRankingCriteria(teamId);
    _rankingCriteriaState = items.map((it) => ({
      ...it,
      slider: Number.isFinite(parseFloat(it.slider)) ? parseFloat(it.slider) : 0,
      question: (it.question || it.key || "").trim(),
    }));
    renderRankingCriteria(_rankingCriteriaState);
    _rankingCriteriaLoaded = true;
    _setCriteriaSaveStatus(`Editing ${_getTeamLabel(teamId)} criteria. Click a question to edit text and move sliders to set relative importance.`);
  } catch (e) {
    rankingCriteriaListEl.innerHTML = `<div class="criteria-item"><span class="criteria-question">Failed to load criteria: ${escapeHtml(e.message || "try again")}</span><span>-</span><span class="criteria-weight">-</span></div>`;
  }
}

async function handleResetRankingCriteria() {
  if (!resetRankingCriteriaBtn) return;
  if (_criteriaSaveTimer) {
    clearTimeout(_criteriaSaveTimer);
    _criteriaSaveTimer = null;
  }

  resetRankingCriteriaBtn.disabled = true;
  _setCriteriaSaveStatus("Resetting to defaults...");
  try {
    const items = await resetRankingCriteriaToDefaults(_activeCriteriaTeam);
    _rankingCriteriaState = items.map((it) => ({
      ...it,
      slider: Number.isFinite(parseFloat(it.slider)) ? parseFloat(it.slider) : 0,
      question: (it.question || it.key || "").trim(),
    }));
    renderRankingCriteria(_rankingCriteriaState);
    _setCriteriaSaveStatus(`Defaults restored for ${_getTeamLabel(_activeCriteriaTeam)}.`);
  } catch (e) {
    _setCriteriaSaveStatus(`Reset failed: ${e.message || "try again"}`);
  } finally {
    resetRankingCriteriaBtn.disabled = false;
  }
}

function _clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function _isValidBBox(bbox) {
  if (!bbox) return false;
  const width = bbox.x2 - bbox.x1;
  const height = bbox.y2 - bbox.y1;
  return width >= 0.05 && height >= 0.05 && bbox.x1 >= 0 && bbox.y1 >= 0 && bbox.x2 <= 1 && bbox.y2 <= 1;
}

function _normalizeBBox(bbox) {
  if (!bbox) return null;
  const x1 = _clamp01(Math.min(bbox.x1, bbox.x2));
  const y1 = _clamp01(Math.min(bbox.y1, bbox.y2));
  const x2 = _clamp01(Math.max(bbox.x1, bbox.x2));
  const y2 = _clamp01(Math.max(bbox.y1, bbox.y2));
  return { x1, y1, x2, y2 };
}

function _bboxToStyle(bbox) {
  if (!bbox) return "display:none;";
  const left = bbox.x1 * 100;
  const top = bbox.y1 * 100;
  const width = (bbox.x2 - bbox.x1) * 100;
  const height = (bbox.y2 - bbox.y1) * 100;
  return `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;width:${width.toFixed(2)}%;height:${height.toFixed(2)}%;`;
}

function _baseFigureBBox(paper) {
  if (paper && paper._figureBbox && _isValidBBox(_normalizeBBox(paper._figureBbox))) {
    return _normalizeBBox(paper._figureBbox);
  }
  return { x1: 0, y1: 0, x2: 1, y2: 1 };
}

function _localToPageBBox(localBBox, baseBBox) {
  const local = _normalizeBBox(localBBox);
  const base = _normalizeBBox(baseBBox);
  if (!local || !base) return null;
  const spanX = base.x2 - base.x1;
  const spanY = base.y2 - base.y1;
  return _normalizeBBox({
    x1: base.x1 + local.x1 * spanX,
    y1: base.y1 + local.y1 * spanY,
    x2: base.x1 + local.x2 * spanX,
    y2: base.y1 + local.y2 * spanY,
  });
}

function _pageToLocalBBox(pageBBox, baseBBox) {
  const page = _normalizeBBox(pageBBox);
  const base = _normalizeBBox(baseBBox);
  if (!page || !base) return null;
  const spanX = base.x2 - base.x1;
  const spanY = base.y2 - base.y1;
  if (spanX <= 0 || spanY <= 0) return null;
  return _normalizeBBox({
    x1: (page.x1 - base.x1) / spanX,
    y1: (page.y1 - base.y1) / spanY,
    x2: (page.x2 - base.x1) / spanX,
    y2: (page.y2 - base.y1) / spanY,
  });
}

function _initFigureEditorState(paper) {
  if (!paper) return;
  if (!paper._manualBboxLocal) paper._manualBboxLocal = null;
  if (!paper._manualBboxPage) paper._manualBboxPage = null;
}

function _getFigureSourceForEditing(paper) {
  return paper._discoveryFigureOriginal || paper._discoveryFigure || "";
}

function _cropImageDataUrl(sourceUrl, bbox) {
  return new Promise((resolve, reject) => {
    const normalized = _normalizeBBox(bbox);
    if (!sourceUrl || !normalized || !_isValidBBox(normalized)) {
      resolve(sourceUrl || "");
      return;
    }
    const img = new Image();
    img.onload = () => {
      const sx = Math.max(0, Math.floor(normalized.x1 * img.naturalWidth));
      const sy = Math.max(0, Math.floor(normalized.y1 * img.naturalHeight));
      const sw = Math.max(1, Math.floor((normalized.x2 - normalized.x1) * img.naturalWidth));
      const sh = Math.max(1, Math.floor((normalized.y2 - normalized.y1) * img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(sourceUrl);
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not render crop preview"));
    img.src = sourceUrl;
  });
}

// ── Metadata download ──────────────────────────────────────────────────────

function downloadPaperMetadata(paper) {
  const sidecar = {
    title: paper.title, authors: paper.authors, year: paper.year,
    preview: paper.preview, summary: paper.summary,
    datacenter: paper.datacenter, metrics: paper.metrics, link: paper.link,
  };
  const blob = new Blob([JSON.stringify(sidecar, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${slugify(paper.title)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Expanded card renderer (shared by all 3 pages) ─────────────────────────

function _buildImageBlock(paper, libraryViewMode) {
  // Library View mode: show ONLY the infographic (no best_figure)
  if (paper.isLocal && libraryViewMode) {
    const infoSrc = paper.generated_infographic || paper.infographic;
    if (infoSrc) {
      return `<div class="card-image-wrap">
        <img class="card-image card-image-wide" src="${escapeHtml(infoSrc)}" alt="Infographic" />
      </div>`;
    }
    // No infographic yet — show generate button
    return `<div class="card-image-wrap card-image-placeholder">
      <button class="generate-infographic-btn" type="button" data-id="${escapeHtml(paper.id)}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Generate Infographic
      </button>
    </div>`;
  }

  // Search Library mode: show ONLY the infographic (no best_figure)
  if (paper.isLocal) {
    const infoSrc = paper.generated_infographic || paper.infographic;
    if (infoSrc) {
      return `<div class="card-image-wrap">
        <img class="card-image card-image-wide" src="${escapeHtml(infoSrc)}" alt="Infographic" />
      </div>`;
    }
    return `<div class="card-image-wrap card-image-placeholder">
      <button class="generate-images-btn" type="button" data-id="${escapeHtml(paper.id)}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Generate Images
      </button>
    </div>`;
  }

  // Discovery papers: always show image area + horizontal action row
  _initFigureEditorState(paper);
  const hasFigure = !!paper._discoveryFigure;
  const hasManual = _isValidBBox(_normalizeBBox(paper._manualBboxLocal));
  const figureStatus = (paper._figureStatus || (hasFigure ? "found" : "idle")).toLowerCase();
  const figureStatusMessage = (paper._figureStatusMessage || "").trim();
  const manualHint = figureStatus === "none"
    ? "No figure detected. You can recheck this paper if needed."
    : hasFigure
      ? (hasManual ? "Manual crop saved. Use modal editor to adjust again." : "Use modal editor to tune the selected image.")
      : "Find a figure before opening the crop editor.";
  const statusText = figureStatusMessage || paper._figureFeedbackStatus || "";
  const feedbackStatus = statusText
    ? `<span class="figure-feedback-status status-${escapeHtml(figureStatus || "idle")}" data-feedback-status>${escapeHtml(statusText)}</span>`
    : `<span class="figure-feedback-status" data-feedback-status></span>`;
  let findLabel = hasFigure ? "Find Again" : "Find Figure";
  if (figureStatus === "none") findLabel = "No Figure Detected";
  if (figureStatus === "uncertain") findLabel = "Figure (Low Confidence)";
  if (figureStatus === "error") findLabel = "Retry Find Figure";
  const figureBtnClass = ["find-figure-btn", figureStatus ? `is-${figureStatus}` : ""].filter(Boolean).join(" ");
  const controls = `<div class="figure-feedback-bar ${hasFigure ? "" : "figure-feedback-bar-inline"}" data-feedback-bar>
      <button class="${figureBtnClass}" type="button" ${paper.link ? "" : "disabled"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
        ${findLabel}
      </button>
      <button class="bbox-modal-open-btn" type="button" ${hasFigure ? "" : "disabled"}>Edit in Modal</button>
      <span class="figure-feedback-hint">${escapeHtml(manualHint)}</span>
      ${feedbackStatus}
    </div>`;

  if (!hasFigure) {
    return controls;
  }

  const imagePane = `<div class="discovery-image-shell has-image">
      <img class="card-image discovery-image-pane" src="${escapeHtml(paper._discoveryFigure)}" alt="Key figure" draggable="false" />
    </div>`;

  return `<div class="card-image-wrap">
    ${imagePane}
    ${controls}
  </div>`;
}

function _wireBBoxEditor(overlayEl, rectEl, paper, onUpdate) {
  if (!overlayEl || !rectEl || !paper) return;
  let dragStart = null;

  function getLocalPoint(evt, clampToBounds = false) {
    const rect = overlayEl.getBoundingClientRect();
    const clientX = evt.clientX;
    const clientY = evt.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const withinX = clientX >= rect.left && clientX <= right;
    const withinY = clientY >= rect.top && clientY <= bottom;
    if (!clampToBounds && (!withinX || !withinY)) {
      return null;
    }

    const localX = clampToBounds
      ? Math.max(rect.left, Math.min(right, clientX))
      : clientX;
    const localY = clampToBounds
      ? Math.max(rect.top, Math.min(bottom, clientY))
      : clientY;
    return {
      x: _clamp01((localX - rect.left) / rect.width),
      y: _clamp01((localY - rect.top) / rect.height),
    };
  }

  function applyRect(localBBox) {
    const normalized = _normalizeBBox(localBBox);
    paper._manualBboxLocal = normalized;
    rectEl.style.cssText = _bboxToStyle(normalized);
    if (typeof onUpdate === "function") onUpdate();
  }

  overlayEl.addEventListener("pointerdown", (evt) => {
    if (overlayEl.dataset.editorMode !== "modal") return;
    const start = getLocalPoint(evt);
    if (!start) return;
    evt.preventDefault();
    dragStart = start;
    overlayEl.setPointerCapture(evt.pointerId);
    applyRect({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });
  });

  overlayEl.addEventListener("pointermove", (evt) => {
    if (!dragStart) return;
    const point = getLocalPoint(evt, true);
    if (!point) return;
    evt.preventDefault();
    applyRect({ x1: dragStart.x, y1: dragStart.y, x2: point.x, y2: point.y });
  });

  overlayEl.addEventListener("pointerup", (evt) => {
    if (!dragStart) return;
    const point = getLocalPoint(evt, true) || dragStart;
    evt.preventDefault();
    const next = _normalizeBBox({ x1: dragStart.x, y1: dragStart.y, x2: point.x, y2: point.y });
    if (_isValidBBox(next)) {
      applyRect(next);
    } else {
      paper._manualBboxLocal = null;
      rectEl.style.cssText = "display:none;";
      if (typeof onUpdate === "function") onUpdate();
    }
    dragStart = null;
    try { overlayEl.releasePointerCapture(evt.pointerId); } catch (_) {}
  });

  overlayEl.addEventListener("keydown", (evt) => {
    if (!paper._manualBboxLocal) return;
    const step = evt.shiftKey ? 0.02 : 0.01;
    const box = { ...paper._manualBboxLocal };
    if (evt.key === "ArrowLeft") { box.x1 -= step; box.x2 -= step; }
    else if (evt.key === "ArrowRight") { box.x1 += step; box.x2 += step; }
    else if (evt.key === "ArrowUp") { box.y1 -= step; box.y2 -= step; }
    else if (evt.key === "ArrowDown") { box.y1 += step; box.y2 += step; }
    else if (evt.key === "Escape") { paper._manualBboxLocal = null; rectEl.style.cssText = "display:none;"; if (typeof onUpdate === "function") onUpdate(); return; }
    else return;
    evt.preventDefault();
    const width = box.x2 - box.x1;
    const height = box.y2 - box.y1;
    box.x1 = _clamp01(box.x1);
    box.y1 = _clamp01(box.y1);
    box.x2 = _clamp01(box.x1 + width);
    box.y2 = _clamp01(box.y1 + height);
    applyRect(box);
  });
}

async function _saveManualBBoxForPaper(paper) {
  const options = arguments[1] || {};
  const local = _normalizeBBox(paper._manualBboxLocal);
  if (!_isValidBBox(local)) {
    throw new Error("Draw a crop box of at least 5% width and height");
  }
  const activeBaseBBox = _normalizeBBox(options.baseBBox) || _normalizeBBox(paper._modalBaseBboxPage) || _baseFigureBBox(paper);
  const pageBBox = _localToPageBBox(local, activeBaseBBox);
  if (!_isValidBBox(pageBBox)) {
    throw new Error("Manual crop could not be mapped to page coordinates");
  }
  const payload = {
    request_id: paper._figureRequestId,
    pdf_url: paper.link,
    page: (options.page ?? paper._figurePage),
    manual_bbox: pageBBox,
    model: paper._figureModel || "gpt-4o",
  };
  const result = await submitDiscoveryManualBBox(payload);
  paper._manualBboxLocal = local;
  paper._manualBboxPage = result.bbox || pageBBox;
  paper._manualBboxPageIndex = Number.isFinite(Number(options.page)) ? Number(options.page) : paper._figurePage;
  const editSource = options.previewSource || _getFigureSourceForEditing(paper);
  try {
    paper._discoveryFigure = await _cropImageDataUrl(editSource, local);
  } catch (_) {}
  paper._figureFeedbackStatus = "Manual crop saved.";
}

async function _openBBoxModal(paper, card) {
  const modal = document.getElementById("bboxEditorModal");
  const modalImage = document.getElementById("bboxModalImage");
  const overlay = document.getElementById("bboxModalOverlay");
  const status = document.getElementById("bboxModalStatus");
  const saveBtn = document.getElementById("bboxModalSaveBtn");
  const prevPageBtn = document.getElementById("bboxModalPrevPageBtn");
  const nextPageBtn = document.getElementById("bboxModalNextPageBtn");
  const pageLabel = document.getElementById("bboxModalPageLabel");
  const resetBtn = document.getElementById("bboxModalResetBtn");
  const clearBtn = document.getElementById("bboxModalClearBtn");
  if (!modal || !modalImage || !overlay || !status || !saveBtn || !prevPageBtn || !nextPageBtn || !pageLabel || !resetBtn || !clearBtn) return;
  if (!paper.link) return;

  const freshOverlay = overlay.cloneNode(true);
  overlay.parentNode.replaceChild(freshOverlay, overlay);
  const rect = freshOverlay.querySelector("#bboxModalRect");
  if (!rect) return;

  modal.dataset.paperLink = paper.link || "";
  freshOverlay.dataset.editorMode = "modal";
  let currentPage = Number.isFinite(Number(paper._modalPageIndex))
    ? Number(paper._modalPageIndex)
    : (Number.isFinite(Number(paper._figurePage)) ? Number(paper._figurePage) : 0);
  let pageCount = Number.isFinite(Number(paper._modalPageCount)) ? Number(paper._modalPageCount) : 1;
  const modalBaseBBoxPage = { x1: 0, y1: 0, x2: 1, y2: 1 };
  let modalImageSource = paper._modalImageSource || _getFigureSourceForEditing(paper);
  let localBox = _normalizeBBox(paper._manualBboxLocal);
  if (!localBox && paper._manualBboxPage && Number(paper._manualBboxPageIndex) === Number(currentPage)) {
    localBox = _pageToLocalBBox(paper._manualBboxPage, modalBaseBBoxPage);
    if (_isValidBBox(localBox)) paper._manualBboxLocal = localBox;
  }

  modalImage.src = modalImageSource;
  rect.style.cssText = _bboxToStyle(_normalizeBBox(paper._manualBboxLocal));
  status.textContent = "Loading page image...";
  saveBtn.disabled = true;
  resetBtn.disabled = !paper._discoveryFigureOriginal;
  clearBtn.disabled = true;

  function syncModalButtons() {
    const valid = _isValidBBox(_normalizeBBox(paper._manualBboxLocal));
    rect.style.cssText = _bboxToStyle(_normalizeBBox(paper._manualBboxLocal));
    saveBtn.disabled = !valid;
    clearBtn.disabled = !valid;
    pageLabel.textContent = `Page ${currentPage + 1} of ${Math.max(1, pageCount)}`;
    prevPageBtn.disabled = currentPage <= 0;
    nextPageBtn.disabled = currentPage >= (pageCount - 1);
    status.textContent = valid
      ? `Manual crop selected on page ${currentPage + 1}. Save to apply.`
      : `Draw a crop rectangle on page ${currentPage + 1}.`;
  }

  async function loadRenderedPage(pageIndex, preserveSelection = false) {
    status.textContent = `Loading page ${pageIndex + 1}...`;
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    try {
      const rendered = await fetchDiscoveryPdfPage({
        pdf_url: paper.link,
        page: pageIndex,
        dpi: 220,
      });
      pageCount = Number.isFinite(Number(rendered.page_count)) ? Number(rendered.page_count) : pageCount;
      currentPage = Number.isFinite(Number(rendered.page)) ? Number(rendered.page) : pageIndex;
      modalImageSource = rendered.image_base64 || modalImageSource;
      paper._modalPageIndex = currentPage;
      paper._modalPageCount = pageCount;
      paper._modalBaseBboxPage = modalBaseBBoxPage;
      paper._modalImageSource = modalImageSource;
      modalImage.src = modalImageSource;

      if (!preserveSelection || Number(paper._manualBboxPageIndex) !== Number(currentPage)) {
        paper._manualBboxLocal = null;
      } else if (paper._manualBboxPage) {
        const remappedLocal = _pageToLocalBBox(paper._manualBboxPage, modalBaseBBoxPage);
        paper._manualBboxLocal = _isValidBBox(remappedLocal) ? remappedLocal : null;
      }
      syncModalButtons();
    } catch (e) {
      status.textContent = `Page load failed: ${e.message || "try again"}`;
      syncModalButtons();
    }
  }

  _wireBBoxEditor(freshOverlay, rect, paper, syncModalButtons);

  await loadRenderedPage(currentPage, true);

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    status.textContent = "Saving manual crop...";
    try {
      await _saveManualBBoxForPaper(paper, {
        baseBBox: modalBaseBBoxPage,
        previewSource: modalImageSource,
        page: currentPage,
      });
      paper._modalBaseBboxPage = modalBaseBBoxPage;
      paper._modalImageSource = modalImageSource;
      paper._figurePage = currentPage;
      status.textContent = "Manual crop saved.";
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      const newCard = renderExpandedCard(paper, false);
      card.replaceWith(newCard);
    } catch (e) {
      status.textContent = `Save failed: ${e.message || "try again"}`;
      syncModalButtons();
    }
  };

  clearBtn.onclick = () => {
    paper._manualBboxLocal = null;
    paper._manualBboxPage = null;
    paper._manualBboxPageIndex = null;
    syncModalButtons();
  };

  prevPageBtn.onclick = async () => {
    if (currentPage <= 0) return;
    await loadRenderedPage(currentPage - 1, false);
  };

  nextPageBtn.onclick = async () => {
    if (currentPage >= (pageCount - 1)) return;
    await loadRenderedPage(currentPage + 1, false);
  };

  resetBtn.onclick = () => {
    if (!paper._discoveryFigureOriginal) return;
    paper._manualBboxLocal = null;
    paper._manualBboxPage = null;
    paper._manualBboxPageIndex = null;
    paper._modalBaseBboxPage = null;
    paper._modalImageSource = null;
    paper._modalPageIndex = null;
    paper._modalPageCount = null;
    paper._discoveryFigure = paper._discoveryFigureOriginal;
    paper._figureFeedbackStatus = "Restored original figure view.";
    status.textContent = "Restored original figure view.";
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    const newCard = renderExpandedCard(paper, false);
    card.replaceWith(newCard);
  };

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function renderExpandedCard(paper, libraryViewMode) {
  const card = document.createElement("article");
  card.className = "paper-card";
  card.setAttribute("aria-label", paper.title);

  // Tags
  let tagsHtml = "";
  if (paper.isDiscovery) {
    const sourceLabel = discoverySourceLabel(paper.source);
    tagsHtml = `
      <span class="tag tag-vetted">AI Vetted</span>
      <span class="tag tag-source">${escapeHtml(sourceLabel)}</span>`;
  } else {
    tagsHtml = paper.groups.map((g) => `<span class="tag ${groupClass(g)}">${groupLabel(g)}</span>`).join("");
  }

  // Action button
  let actionHtml = "";
  if (paper.isLocal) {
    actionHtml = `<a class="solid-link" href="${escapeHtml(paper.link)}" target="_blank" rel="noopener noreferrer">Open PDF</a>`;
  } else if (paper.link) {
    actionHtml = `<a class="solid-link" href="${escapeHtml(paper.link)}" target="_blank" rel="noopener noreferrer">Link to Paper</a>`;
  }

  // Discovery extras
  let extraBtns = "";
  if (paper.isDiscovery) {
    extraBtns = `
      <div class="dl-btn-wrap">
        <button class="ghost-link add-library-btn" type="button">Add to Library</button>
        <button class="download-meta-btn" type="button">Download Metadata</button>
        <span class="dl-btn-tip" role="tooltip">Think this paper belongs in the library? Download its metadata and email it to the Administrator.</span>
      </div>`;
  }

  // Local paper edit/delete
  let editBtns = "";
  if (paper.isLocal) {
    const activePageId = document.querySelector(".page-section.page-active")?.id || "";
    const hideDeleteInSearchLibrary = activePageId === "page-search-library";
    const deleteBtnHtml = (libraryViewMode || hideDeleteInSearchLibrary)
      ? ""
      : `<button class="ghost-link delete-paper-btn" type="button" data-id="${paper.id}">Delete</button>`;
    editBtns = `
      <button class="ghost-link edit-paper-btn" type="button" data-id="${paper.id}">Edit</button>
      ${deleteBtnHtml}`;
  }

  const scoreValue = parseFloat(paper.total_score);
  const hasScore = Number.isFinite(scoreValue);
  const scoreConfidence = Number.isFinite(parseFloat(paper.score_confidence))
    ? Math.round(parseFloat(paper.score_confidence) * 100)
    : null;
  const scoreDetails = paper.isDiscovery
    ? (paper.score_error
        ? `<div class="card-section"><h4>Architecture Score</h4><p class="score-error">${escapeHtml(paper.score_error)}</p></div>`
        : hasScore
          ? `<div class="card-section"><h4>Architecture Score</h4><p>${scoreValue.toFixed(2)} / 5${scoreConfidence !== null ? " &bull; AI generated score" : ""}</p></div>`
          : "")
    : "";

  const scoreSequence = Array.isArray(paper.score_sequence) ? paper.score_sequence : [];
  const questionScoresHtml = paper.isDiscovery && !paper.score_error && scoreSequence.length
    ? `<div class="score-breakdown-row" aria-label="Per-question scores">${scoreSequence.map((item, idx) => {
        const qLabel = escapeHtml(item.q || `Q${idx + 1}`);
        const raw = parseFloat(item.score);
        const scoreText = Number.isFinite(raw) ? raw.toFixed(1).replace(/\.0$/, "") : "0";
        return `<span class="score-chip">${qLabel} - ${scoreText}/5</span>`;
      }).join("")}</div>`
    : "";

  card.innerHTML = `
    ${_buildImageBlock(paper, libraryViewMode)}
    <div class="card-body">
      <div class="card-tags">${tagsHtml}</div>
      <h3 class="card-title">${escapeHtml(paper.title)}</h3>
      <div class="card-meta">${escapeHtml(paper.authors || "")} &bull; ${paper.year}</div>
      <div class="card-section">
        <h4>Summary</h4>
        <p>${escapeHtml(paper.summary || "")}</p>
      </div>
      <div class="card-section">
        <h4>Why It Matters for Datacenters</h4>
        <p>${escapeHtml(paper.datacenter || "")}</p>
      </div>
      <div class="card-section">
        <h4>Key Result Signal</h4>
        <p>${escapeHtml(paper.metrics || "")}</p>
      </div>
      ${(() => {
        if (!paper.isLocal) return "";
        if (paper.live_citation_count === undefined) return "";
        if (paper.live_citation_count === null) return `<div class="card-section"><h4>Citations</h4><p class="score-error">citation count could not be received</p></div>`;
        return `<div class="card-section"><h4>Citations</h4><p>${paper.live_citation_count.toLocaleString()} citations</p></div>`;
      })()
      }
      ${scoreDetails}
      <div class="card-actions">
        ${actionHtml}
        ${extraBtns}
        ${editBtns}
      </div>
      ${questionScoresHtml}
    </div>
  `;

  // Bind buttons
  const dlBtn = card.querySelector(".download-meta-btn");
  if (dlBtn) dlBtn.addEventListener("click", () => downloadPaperMetadata(paper));

  const addLibraryBtn = card.querySelector(".add-library-btn");
  if (addLibraryBtn) {
    addLibraryBtn.addEventListener("click", () => {
      alert("Add to Library is a placeholder button. Current backend library ingest requires uploading a PDF file via Search Library.");
    });
  }

  const editBtn = card.querySelector(".edit-paper-btn");
  if (editBtn) editBtn.addEventListener("click", () => showEditForm(paper, card));

  const deleteBtn = card.querySelector(".delete-paper-btn");
  if (deleteBtn) deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${paper.title}"? This removes the PDF and metadata permanently.`)) return;
    try { await deletePaperById(paper.id); } catch (e) { alert("Delete failed: " + e.message); }
  });

  // Generate Infographic button (Library View — infographic only)
  const genInfoBtn = card.querySelector(".generate-infographic-btn");
  if (genInfoBtn) {
    genInfoBtn.addEventListener("click", async () => {
      genInfoBtn.disabled = true;
      genInfoBtn.innerHTML = '<span class="spinner"></span> Generating…';
      try {
        const res = await fetch(`/api/papers/${encodeURIComponent(paper.id)}/generate-infographic`, { method: "POST" });
        const result = await res.json();
        if (!res.ok || !result.generated_infographic) throw new Error((result.errors || []).join("; ") || "Failed");
        paper.generated_infographic = result.generated_infographic;
        const newCard = renderExpandedCard(paper, true);
        card.replaceWith(newCard);
      } catch (e) {
        genInfoBtn.disabled = false;
        genInfoBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Failed — Retry`;
        genInfoBtn.title = e.message;
      }
    });
  }

  // Generate Images button (library papers without images)
  const genBtn = card.querySelector(".generate-images-btn");
  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      genBtn.disabled = true;
      genBtn.innerHTML = '<span class="spinner"></span> Generating…';
      try {
        const result = await generateImagesForPaper(paper.id);
        // Update paper object in-place and re-render card
        if (result.best_figure) paper.best_figure = result.best_figure;
        if (result.generated_infographic) paper.generated_infographic = result.generated_infographic;
        const newCard = renderExpandedCard(paper, false);
        card.replaceWith(newCard);
      } catch (e) {
        genBtn.disabled = false;
        genBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Failed — Retry`;
        genBtn.title = e.message;
      }
    });
  }

  // Find Figure button (discovery papers)
  const findFigBtn = card.querySelector(".find-figure-btn");
  if (findFigBtn && paper.link) {
    findFigBtn.addEventListener("click", async () => {
      findFigBtn.disabled = true;
      findFigBtn.innerHTML = '<span class="spinner"></span> Extracting…';
      try {
        const figureResult = await findDiscoveryFigure(paper.link);
        paper._figureStatus = (figureResult.status || "found").toLowerCase();
        paper._figureReason = figureResult.reason || "";
        paper._figureStatusMessage = figureResult.message || "";

        if (figureResult.figure_base64) {
          paper._discoveryFigureOriginal = figureResult.figure_base64;
          paper._discoveryFigure = figureResult.figure_base64;
        } else {
          paper._discoveryFigureOriginal = null;
          paper._discoveryFigure = null;
        }
        paper._figureRequestId = figureResult.request_id;
        paper._figurePage = figureResult.page;
        paper._figureBbox = figureResult.bbox || null;
        paper._figureModel = figureResult.model || "gpt-4o";
        paper._manualBboxLocal = null;
        paper._manualBboxPage = null;
        paper._manualBboxPageIndex = null;
        paper._modalBaseBboxPage = null;
        paper._modalImageSource = null;
        if (paper._figureStatus === "none") {
          paper._figureFeedbackStatus = paper._figureStatusMessage || "No figure detected for this paper.";
        } else if (paper._figureStatus === "uncertain") {
          paper._figureFeedbackStatus = paper._figureStatusMessage || "Low-confidence figure candidate extracted.";
        } else {
          paper._figureFeedbackStatus = "";
        }
        const newCard = renderExpandedCard(paper, false);
        card.replaceWith(newCard);
      } catch (e) {
        paper._figureStatus = "error";
        paper._figureReason = "extract_failed";
        paper._figureStatusMessage = e.message || "Could not extract figure.";
        paper._figureFeedbackStatus = "Could not extract figure right now. Try again.";
        const newCard = renderExpandedCard(paper, false);
        card.replaceWith(newCard);
      }
    });
  }

  const modalOpenBtn = card.querySelector(".bbox-modal-open-btn");
  if (modalOpenBtn && paper._discoveryFigure) {
    modalOpenBtn.addEventListener("click", () => {
      _openBBoxModal(paper, card);
    });
  }

  return card;
}

// ── Inline edit form (replaces card content in-place) ──────────────────────

function showEditForm(paper, cardEl) {
  const fields = ["title", "authors", "year", "preview", "summary", "datacenter", "metrics"];
  cardEl.innerHTML = `
    <div class="card-body">
      <h3 class="card-title">Edit: ${escapeHtml(paper.title)}</h3>
      <form class="edit-paper-form">
        ${fields.map((f) => `
          <label class="edit-label">${f.charAt(0).toUpperCase() + f.slice(1)}
            ${f === "summary" || f === "datacenter" || f === "preview"
              ? `<textarea name="${f}" class="edit-input edit-textarea">${escapeHtml(paper[f] || "")}</textarea>`
              : `<input name="${f}" class="edit-input" value="${escapeHtml((paper[f] || "").toString())}" />`}
          </label>`).join("")}
        <div class="detail-link-row">
          <button type="submit" class="solid-link">Save</button>
          <button type="button" class="ghost-link cancel-edit-btn">Cancel</button>
        </div>
      </form>
    </div>
  `;

  cardEl.querySelector(".cancel-edit-btn").addEventListener("click", () => {
    const newCard = renderExpandedCard(paper);
    cardEl.replaceWith(newCard);
  });

  cardEl.querySelector(".edit-paper-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {};
    for (const [k, v] of formData.entries()) {
      updates[k] = k === "year" ? (Number.isInteger(parseInt(v, 10)) && !isNaN(parseInt(v, 10)) ? parseInt(v, 10) : (() => { alert("Year must be a valid number."); throw new Error("Invalid year"); })()) : v;
    }
    try { await updatePaperMetadata(paper.id, updates); } catch (err) { alert("Save failed: " + err.message); }
  });
}

// ── Page switching ─────────────────────────────────────────────────────────

function switchPage(pageId) {
  document.querySelectorAll(".page-section").forEach((s) => s.classList.remove("page-active"));
  document.querySelectorAll(".nav-btn").forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });

  const target = document.getElementById(pageId);
  if (target) target.classList.add("page-active");

  let btn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if (!btn && pageId === "page-discovery-criteria") {
    btn = document.querySelector('.nav-btn[data-page="page-discovery"]');
  }
  if (btn) { btn.classList.add("is-active"); btn.setAttribute("aria-selected", "true"); }

  location.hash = pageId;

  // Render page content on switch
  if (pageId === "page-search-library") renderSearchLibrary();
  if (pageId === "page-library-view") { _refreshCitationCounts(); renderLibraryView(); renderFullSections(); }
}

// ── Page 1: Discovery ──────────────────────────────────────────────────────

async function handleFindNewPapers() {
  if (!findNewPapersBtn) return;
  if (_discoveryRankInFlight) return;
  _discoverySearchInFlight = true;
  findNewPapersBtn.disabled = true;
  _setAllRankButtonsDisabled(true);
  discoveryStatusEl.textContent = "Searching sources...";
  discoveredWebPapers = [];
  _discoveryEmptyReason = "";
  _discoverySourceCounts = { arxiv: 0, openalex: 0, "core-pr": 0 };
  _discoverySourceErrors = { arxiv: null, openalex: null, "core-pr": null };
  renderDiscoveryFeed();
  _setDiscoveryProgressBar(0, 0, false, "Searching sources only. Click one team rank button after results appear.");

  try {
    const searchInput = document.getElementById("discoverySearchInput");
    const query = searchInput ? searchInput.value.trim() : "";
    const yearFromEl = document.getElementById("yearFrom");
    const yearToEl = document.getElementById("yearTo");
    const yearFrom = yearFromEl ? yearFromEl.value : "2020";
    const yearTo = yearToEl ? yearToEl.value : "2026";

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("year_from", yearFrom);
    params.set("year_to", yearTo);

    const res = await fetch(`/api/discover/search?${params.toString()}`);
    if (!res.ok) throw new Error("Discovery request failed");
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const results = data.results || [];
    _discoveryEmptyReason = data.empty_reason || "";
    _discoverySourceCounts = data.source_counts || { arxiv: 0, openalex: 0, "core-pr": 0 };
    _discoverySourceErrors = data.source_errors || { arxiv: null, openalex: null, "core-pr": null };
    const appliedYearFrom = Number.isInteger(data.applied_year_from)
      ? String(data.applied_year_from)
      : yearFrom;
    const appliedYearTo = Number.isInteger(data.applied_year_to)
      ? String(data.applied_year_to)
      : yearTo;
    _discoverySearchContext = {
      query: data.query || query,
      year_from: appliedYearFrom,
      year_to: appliedYearTo,
    };
    if (discoveryQueryEl && data.query) {
      discoveryQueryEl.textContent = `Found ${results.length} source papers for "${data.query}" | Years: ${appliedYearFrom}-${appliedYearTo}`;
    }

    discoveredWebPapers = results;

    renderDiscoveryFeed();
    if (discoveredWebPapers.length === 0 && _discoveryEmptyReason) {
      discoveryStatusEl.textContent = _discoveryEmptyReason;
    } else {
      discoveryStatusEl.textContent = `Search complete. ${discoveredWebPapers.length} papers loaded. Click a team rank button to score.`;
    }
    _setDiscoveryProgressBar(0, 0, false, "Search complete. Click a team rank button to start AI ranking.");
    _setRankButtonsEnabledByResults();
  } catch (error) {
    discoveredWebPapers = [];
    _discoveryEmptyReason = error.message || "Search failed.";
    renderDiscoveryFeed();
    discoveryStatusEl.textContent = `Search failed: ${error.message}`;
    _setDiscoveryProgressBar(0, 0, false, "Search failed.");
    _setAllRankButtonsDisabled(true);
  } finally {
    _discoverySearchInFlight = false;
    findNewPapersBtn.disabled = false;
    _setRankButtonsEnabledByResults();
  }
}

async function handleRankPapers(teamId) {
  if (_discoverySearchInFlight || _discoveryRankInFlight) return;
  if (!discoveredWebPapers.length) return;

  const teamLabel = _getTeamLabel(teamId);
  _discoveryRankInFlight = true;
  _setAllRankButtonsDisabled(true);
  if (findNewPapersBtn) findNewPapersBtn.disabled = true;
  discoveryStatusEl.textContent = `Ranking papers for ${teamLabel}...`;
  _setDiscoveryProgressBar(0, Math.min(discoveredWebPapers.length, 12), true, `Ranking papers for ${teamLabel}...`);
  _startDiscoveryProgressPolling();

  try {
    const payload = {
      query: _discoverySearchContext.query || "",
      year_from: _discoverySearchContext.year_from,
      year_to: _discoverySearchContext.year_to,
      team: teamId,
      ranking_run_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      candidates: discoveredWebPapers,
      source_errors: _discoverySourceErrors,
    };

    const res = await fetch("/api/discover/rank", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Ranking request failed");
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    discoveredWebPapers = Array.isArray(data.results) ? data.results : [];
    _discoveryEmptyReason = data.empty_reason || "";
    _discoverySourceCounts = data.source_counts || _discoverySourceCounts;
    _discoverySourceErrors = data.source_errors || _discoverySourceErrors;
    renderDiscoveryFeed();

    if (discoveryQueryEl && _discoverySearchContext.query) {
      discoveryQueryEl.textContent = `Ranked ${discoveredWebPapers.length} papers for "${_discoverySearchContext.query}" (${teamLabel}) | Years: ${_discoverySearchContext.year_from}-${_discoverySearchContext.year_to}`;
    }

    discoveryStatusEl.textContent = discoveredWebPapers.length
      ? `Ranking complete for ${teamLabel}.`
      : (_discoveryEmptyReason || "No papers available after ranking.");
  } catch (error) {
    discoveredWebPapers = [];
    renderDiscoveryFeed();
    discoveryStatusEl.textContent = `Ranking failed: ${error.message}`;
    _setDiscoveryProgressBar(0, 0, false, "Ranking failed.");
  } finally {
    _discoveryRankInFlight = false;
    _stopDiscoveryProgressPolling();
    await _pollDiscoveryProgress();
    if (findNewPapersBtn) findNewPapersBtn.disabled = false;
    _setRankButtonsEnabledByResults();
  }
}

function renderDiscoveryFeed() {
  if (!discoveryFeedEl) return;
  discoveryFeedEl.innerHTML = "";
  _renderDiscoveryCount();

   if (!discoveredWebPapers.length) {
    if (_discoverySearchInFlight) {
      return;
    }
    const sourceTotal = Number(_discoverySourceCounts?.["core-pr"] || 0)
      + Number(_discoverySourceCounts?.arxiv || 0)
      + Number(_discoverySourceCounts?.openalex || 0);
    const noResultsTitle = sourceTotal === 0 ? "No papers found" : "No new papers to show";
    const reason = _discoveryEmptyReason || "No papers found for the current query.";
    discoveryFeedEl.innerHTML = `
      <article class="paper-card discovery-empty-card" aria-label="No discovery results">
        <div class="card-body">
          <div class="card-tags"><span class="tag latest">Discovery</span></div>
          <h3 class="card-title">${escapeHtml(noResultsTitle)}</h3>
          <div class="card-section">
            <h4>Why</h4>
            <p>${escapeHtml(reason)}</p>
          </div>
        </div>
      </article>`;
    return;
  }

  for (const paper of discoveredWebPapers) {
    const card = renderExpandedCard(paper);
    discoveryFeedEl.appendChild(card);
  }
}

// ── Page 2: Search Library ─────────────────────────────────────────────────

let _searchDebounce = null;

function renderSearchLibrary() {
  const query = librarySearchInput ? librarySearchInput.value.trim() : "";
  let results = papers;
  if (query) {
    const lower = query.toLowerCase();
    results = papers.filter((p) =>
      (p.title || "").toLowerCase().includes(lower) ||
      (p.authors || "").toLowerCase().includes(lower) ||
      (p.summary || "").toLowerCase().includes(lower) ||
      (p.datacenter || "").toLowerCase().includes(lower) ||
      (p.metrics || "").toLowerCase().includes(lower)
    );
  }

  if (librarySearchCount) {
    librarySearchCount.textContent = query ? `${results.length} match${results.length === 1 ? "" : "es"}` : `${results.length} papers`;
  }

  if (!librarySearchFeedEl) return;
  librarySearchFeedEl.innerHTML = "";
  for (const paper of results) {
    librarySearchFeedEl.appendChild(renderExpandedCard(paper));
  }
}

// ── Page 3: Library View ───────────────────────────────────────────────────

function filterPapers() {
  if (activeFilter === "all") return papers;
  return papers.filter((p) => p.groups.includes(activeFilter));
}

function renderLibraryView() {
  const filtered = filterPapers();
  if (feedCountEl) feedCountEl.textContent = `${filtered.length} papers`;

  if (!libraryFeedEl) return;
  libraryFeedEl.innerHTML = "";
  for (const paper of filtered) {
    libraryFeedEl.appendChild(renderExpandedCard(paper, true));
  }
}

function renderFullSections() {
  if (!sectionEl) return;
  const filtered = filterPapers();
  sectionEl.innerHTML = filtered.map((paper) => {
    const infoSrc = paper.generated_infographic || paper.infographic;
    const figSrc = paper.best_figure;
    let imageBlock = "";
    if (infoSrc || figSrc) {
      imageBlock = `<div class="summary-image-scroller"><div class="summary-image-pair">
        ${infoSrc ? `<figure class="infographic-figure"><img class="paper-infographic" src="${encodeURI(infoSrc)}" alt="Infographic" /></figure>` : ""}
        ${figSrc ? `<figure class="infographic-figure"><img class="paper-infographic" src="${encodeURI(figSrc)}" alt="Key figure" /></figure>` : ""}
      </div></div>`;
    }
    const linkLabel = paper.isLocal ? "Open PDF" : "Link to Paper";
    return `
    <article class="paper-section" id="paper-${paper.id}">
      <h3>${escapeHtml(paper.title)}</h3>
      ${imageBlock}
      <p><strong>Authors:</strong> ${escapeHtml(paper.authors)}</p>
      <p><strong>Year:</strong> ${paper.year}</p>
      <p><strong>Category:</strong> ${paper.groups.map(groupLabel).join(", ")}</p>
      <p><strong>Summary:</strong> ${escapeHtml(paper.summary)}</p>
      <p><strong>Datacenter Significance:</strong> ${escapeHtml(paper.datacenter)}</p>
      <p><strong>Key Result Signal:</strong> ${escapeHtml(paper.metrics)}</p>
      <p><a href="${escapeHtml(paper.link)}" target="_blank" rel="noopener noreferrer">${linkLabel}</a></p>
    </article>`;
  }).join("");
}

// ── Summary search (Library View) ──────────────────────────────────────────

function bindSummarySearch() {
  const input = document.getElementById("summarySearch");
  const countEl = document.getElementById("summarySearchCount");
  if (!input) return;

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function applySearch() {
    const raw = input.value.trim();
    const sections = document.querySelectorAll("#fullSections .paper-section");
    let visible = 0;

    if (!raw) {
      sections.forEach((el) => el.classList.remove("summary-section--hidden"));
      sections.forEach((el) => {
        el.querySelectorAll(".summary-search-highlight").forEach((mark) => mark.replaceWith(mark.textContent));
      });
      if (countEl) countEl.textContent = "";
      return;
    }

    const re = new RegExp(escapeRe(raw), "gi");
    sections.forEach((el) => {
      el.querySelectorAll(".summary-search-highlight").forEach((mark) => mark.replaceWith(mark.textContent));
      const text = el.innerText || el.textContent;
      if (re.test(text)) {
        el.classList.remove("summary-section--hidden"); visible++;
        highlightTextNodes(el, new RegExp(escapeRe(raw), "gi"));
      } else {
        el.classList.add("summary-section--hidden");
      }
    });
    if (countEl) countEl.textContent = visible === 0 ? "No matches" : `${visible} match${visible === 1 ? "" : "es"}`;
  }

  function highlightTextNodes(root, re) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim() && re.test(node.nodeValue)) nodesToProcess.push(node);
      re.lastIndex = 0;
    }
    nodesToProcess.forEach((textNode) => {
      const frag = document.createDocumentFragment();
      let last = 0; re.lastIndex = 0; let m;
      while ((m = re.exec(textNode.nodeValue)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(textNode.nodeValue.slice(last, m.index)));
        const mark = document.createElement("mark");
        mark.className = "summary-search-highlight";
        mark.textContent = m[0]; frag.appendChild(mark);
        last = m.index + m[0].length;
      }
      if (last < textNode.nodeValue.length) frag.appendChild(document.createTextNode(textNode.nodeValue.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  input.addEventListener("input", applySearch);
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; applySearch(); input.blur(); } });
}

// ── Year range slider logic ────────────────────────────────────────────────

function bindYearSliders() {
  const fromSlider = document.getElementById("yearFrom");
  const toSlider   = document.getElementById("yearTo");
  const fromLabel  = document.getElementById("yearFromLabel");
  const toLabel    = document.getElementById("yearToLabel");
  if (!fromSlider || !toSlider) return;

  function update() {
    let from = parseInt(fromSlider.value);
    let to = parseInt(toSlider.value);
    if (from > to) {
      if (this === fromSlider) { toSlider.value = from; to = from; }
      else { fromSlider.value = to; from = to; }
    }
    if (fromLabel) fromLabel.textContent = from;
    if (toLabel) toLabel.textContent = to;
    if (!_discoveryRankInFlight) _setAllRankButtonsDisabled(true);
    if (discoveryStatusEl) discoveryStatusEl.textContent = "Year range changed. Click Search Sources to refresh results.";
  }

  fromSlider.addEventListener("input", update);
  toSlider.addEventListener("input", update);
}

function bindBBoxModal() {
  const modal = document.getElementById("bboxEditorModal");
  const closeBtn = document.getElementById("bboxModalCloseBtn");
  const cancelBtn = document.getElementById("bboxModalCancelBtn");
  if (!modal) return;

  const closeAndHide = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  };
  if (closeBtn) closeBtn.addEventListener("click", closeAndHide);
  if (cancelBtn) cancelBtn.addEventListener("click", closeAndHide);

  modal.addEventListener("click", (evt) => {
    if (evt.target === modal) closeAndHide();
  });

  document.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape" && modal.classList.contains("is-open")) {
      closeAndHide();
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

function init() {
  // Page navigation
  document.querySelectorAll(".nav-btn[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => switchPage(btn.dataset.page));
  });

  // Restore page from hash
  const hash = location.hash.replace("#", "");
  if (hash && document.getElementById(hash)) {
    switchPage(hash);
  }

  // Discovery: search button + enter key
  if (findNewPapersBtn) findNewPapersBtn.addEventListener("click", handleFindNewPapers);
  rankTeamBtns.forEach((btn) => {
    const teamId = btn.dataset.team;
    btn.addEventListener("click", () => handleRankPapers(teamId));
  });
  rankingCriteriaTeamBtns.forEach((btn) => {
    const teamId = btn.dataset.team;
    btn.addEventListener("click", () => openRankingCriteriaPage(teamId));
  });
  if (resetRankingCriteriaBtn) resetRankingCriteriaBtn.addEventListener("click", handleResetRankingCriteria);
  if (backToDiscoveryBtn) backToDiscoveryBtn.addEventListener("click", () => switchPage("page-discovery"));
  const discoverySearchInput = document.getElementById("discoverySearchInput");
  if (discoverySearchInput) {
    discoverySearchInput.addEventListener("input", () => {
      if (!_discoveryRankInFlight) _setAllRankButtonsDisabled(true);
      if (discoveryStatusEl) discoveryStatusEl.textContent = "Query changed. Click Search Sources to refresh results.";
    });
    discoverySearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
  }

  // Topic pills
  document.querySelectorAll(".topic-pill[data-query]").forEach((pill) => {
    pill.addEventListener("click", () => {
      const input = document.getElementById("discoverySearchInput");
      if (input) input.value = pill.dataset.query;
      document.querySelectorAll(".topic-pill[data-query]").forEach((p) => p.classList.remove("topic-pill--active"));
      pill.classList.add("topic-pill--active");
      if (discoveryStatusEl) {
        discoveryStatusEl.textContent = "Topic selected. Click Search Sources to fetch papers.";
      }
    });
  });

  // Year range sliders
  bindYearSliders();

  // Manual bbox modal
  bindBBoxModal();

  // Library search input (debounced)
  if (librarySearchInput) {
    librarySearchInput.addEventListener("input", () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(renderSearchLibrary, 300);
    });
    librarySearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { librarySearchInput.value = ""; renderSearchLibrary(); librarySearchInput.blur(); }
    });
  }

  // Filter buttons (Library View)
  for (const btn of filterButtons) {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter || "all";
      filterButtons.forEach((n) => n.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderLibraryView();
      renderFullSections();
    });
  }

  // Summary search (Library View)
  bindSummarySearch();

  // Upload form
  const uploadForm = document.getElementById("uploadPaperForm");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = uploadForm.querySelector('input[type="file"]');
      const file = fileInput.files[0];
      if (!file) { alert("Select a PDF file first."); return; }
      const metadata = {};
      for (const input of uploadForm.querySelectorAll("input[name], textarea[name]")) {
        if (input.type !== "file" && input.value.trim()) metadata[input.name] = input.value.trim();
      }
      const statusEl = document.getElementById("uploadStatus");
      try {
        if (statusEl) statusEl.textContent = "Uploading...";
        await uploadPaper(file, metadata);
        uploadForm.reset();
        if (statusEl) statusEl.textContent = "Uploaded successfully!";
      } catch (err) {
        if (statusEl) statusEl.textContent = "Upload failed: " + err.message;
      }
    });
  }

  // Fetch papers from API
  fetchPapersFromApi();
  _setDiscoveryProgressBar(0, 0, false, "Search first, then click one team rank button.");
  _setAllRankButtonsDisabled(true);

  // Fetch visit counter
  fetch("/api/visit-count").then(r => r.json()).then(data => {
    const el = document.getElementById("visitCount");
    if (el) el.textContent = data.count.toLocaleString();
  }).catch(() => {});

  // SSE for live updates
  const sse = new EventSource("/api/changes");
  sse.onmessage = () => fetchPapersFromApi();
  sse.onerror = () => { setTimeout(() => fetchPapersFromApi(), 10000); };
}

init();
