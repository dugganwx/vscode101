// Papers come from two sources:
//   1. Flask API (/api/papers) — local PDFs + SQLite metadata
//   2. Flask discovery proxy (/api/discover) — OpenAlex, arXiv, Semantic Scholar
let discoveredWebPapers = [];

const localPaperFolder = "AI papers for WebProject1";
let dynamicLocalPapers = [];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/^[0-9]+\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferYear(fileName) {
  const match = fileName.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : 2024;
}

function toDisplayTitle(fileName) {
  const base = fileName
    .replace(/\.pdf$/i, "")
    .replace(/^[0-9]+\./, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return base.length > 0 ? base : fileName;
}

function inferGroups(fileName, year) {
  const lower = fileName.toLowerCase();
  const groups = ["latest"];

  if (lower.includes("survey") || lower.includes("technical report") || lower.includes("benchmark")) {
    groups.push("read");
  }

  return [...new Set(groups)];
}

// ── Hardware-relevance importance scorer ───────────────────────────────────
// Scores a paper's full metadata corpus against two tiers of hardware-group
// keywords plus an age bonus. Used by tagImportantPapers() to elect the top 5.
//
// Tier 1 — 4 pts each (accelerator / silicon / interconnect specifics)
// Tier 2 — 2 pts each (systems / infrastructure topics)
// Age bonus — added once based on publication year
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
  const corpus = [
    paper.title, paper.preview, paper.summary, paper.datacenter, paper.metrics
  ].join(" ").toLowerCase();

  let score = 0;
  for (const re of _hwTier1) { if (re.test(corpus)) score += 4; }
  for (const re of _hwTier2) { if (re.test(corpus)) score += 2; }

  // Age bonus: newer papers score higher — max 8 pts for current-year work,
  // decaying by 1 pt per year (floor 0). Formula: max(0, 8 − (currentYear − paperYear))
  const currentYear = new Date().getFullYear();
  score += Math.max(0, 8 - (currentYear - paper.year));

  paper._importanceScore = score;
  return score;
}

// Tags the top 5 scorers as "important". Admin-pinned papers (_hasSidecarGroups)
// are exempt from auto-scoring — their groups array is treated as a hard override.
// Called on every rebuildPapers() so the ranking stays current as papers are added.
function tagImportantPapers(paperList) {
  const TOP_N = 5;
  const eligible = paperList.filter((p) => !p._hasSidecarGroups);

  eligible
    .slice()
    .sort((a, b) => _hwImportanceScore(b) - _hwImportanceScore(a))
    .forEach((paper, idx) => {
      if (idx < TOP_N) {
        if (!paper.groups.includes("important")) paper.groups.push("important");
      } else {
        paper.groups = paper.groups.filter((g) => g !== "important");
      }
    });

  const topTitles = eligible
    .slice()
    .sort((a, b) => (b._importanceScore ?? 0) - (a._importanceScore ?? 0))
    .slice(0, TOP_N)
    .map((p) => `${p.title} (score: ${p._importanceScore})`);
  console.log("[Importance] Top 5:", topTitles);
}

// Fetches the paper library from the Flask API and rebuilds the UI.
let _lastPapersJSON = "";

async function fetchPapersFromApi() {
  try {
    const res = await fetch("/api/papers");
    if (!res.ok) return;
    const data = await res.json();

    // Skip re-render if data hasn't changed
    const json = JSON.stringify(data);
    if (json === _lastPapersJSON) return;
    _lastPapersJSON = json;

    dynamicLocalPapers = data.map((p) => ({
      ...p,
      isLocal: true,
      _hasSidecarGroups: !!p._hasSidecarGroups,
      groups: Array.isArray(p.groups) ? p.groups : ["latest"],
    }));
    rebuildPapers();
    renderFeed();
    renderDetail();
    renderFullSections();
  } catch (_) {
    // Server not ready — retry on next poll
  }
}

// Upload a new paper via the API.
async function uploadPaper(file, metadata) {
  const form = new FormData();
  form.append("pdf", file);
  for (const [k, v] of Object.entries(metadata)) {
    if (v) form.append(k, v);
  }
  const res = await fetch("/api/papers", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Upload failed");
  }
  await fetchPapersFromApi();
  return res.json();
}

// Update metadata for an existing paper.
async function updatePaperMetadata(paperId, fields) {
  const res = await fetch(`/api/papers/${encodeURIComponent(paperId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("Update failed");
  await fetchPapersFromApi();
}

// Delete a paper from the library.
async function deletePaperById(paperId) {
  const res = await fetch(`/api/papers/${encodeURIComponent(paperId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Delete failed");
  await fetchPapersFromApi();
}


let papers = [];

const feedEl = document.getElementById("paperFeed");
const discoveryFeedEl = document.getElementById("discoveryFeed");
const discoveryCountEl = document.getElementById("discoveryCount");
const discoveryQueryEl = document.getElementById("discoveryQuery");
const discoveryStatusEl = document.getElementById("discoveryStatus");
const findNewPapersBtn = document.getElementById("findNewPapersBtn");
const detailEl = document.getElementById("selectedDetail");
const sectionEl = document.getElementById("fullSections");
const feedCountEl = document.getElementById("feedCount");
const feedTitleEl = document.getElementById("feedTitle");
const filterButtons = [...document.querySelectorAll(".filter-btn")];

let activeFilter = "all";
let selectedPaperId = "";

function groupLabel(group) {
  if (group === "important") return "Most Important";
  if (group === "read") return "Most Read";
  if (group === "latest") return "Latest";
  return group;
}

function groupClass(group) {
  return group;
}

function linkLabel(paper) {
  if (paper.isDiscovery) return "Open Discovery Source";
  return paper.isLocal ? "Open PDF" : "Read Original Paper";
}

function rebuildPapers() {
  // Discovery papers are a staging area only — main feed shows local library papers exclusively.
  papers = [...dynamicLocalPapers];
  tagImportantPapers(papers);
  const inLocal = papers.some((item) => item.id === selectedPaperId);
  const inDiscovery = discoveredWebPapers.some((item) => item.id === selectedPaperId);
  if (!inLocal && !inDiscovery && papers.length > 0) {
    selectedPaperId = papers[0].id;
  }
}

function cleanAbstract(rawAbstract) {
  if (!rawAbstract) return "";
  return rawAbstract
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferDatacenterImpact(text) {
  const lower = text.toLowerCase();

  if (lower.includes("mixture") || lower.includes("moe") || lower.includes("expert")) {
    return "This likely affects sparse routing behavior, all-to-all traffic patterns, and cluster scheduling strategy for MoE workloads.";
  }

  if (lower.includes("inference") || lower.includes("serving") || lower.includes("latency")) {
    return "This is likely relevant to serving economics, memory footprint control, and latency-throughput tuning in production datacenters.";
  }

  if (lower.includes("dataflow") || lower.includes("interconnect") || lower.includes("memory")) {
    return "This likely impacts memory hierarchy design, interconnect utilization, and accelerator data movement efficiency.";
  }

  return "This likely provides useful guidance for balancing quality, throughput, and total infrastructure cost in enterprise AI clusters.";
}

function inferKeyResult(text, year) {
  const numberMatch = text.match(/\b\d+(?:\.\d+)?\s?(?:x|%|b|m|tokens|gpu|gpus|ms)\b/i);
  if (numberMatch) {
    return `Key result signal: reported metric includes ${numberMatch[0]}, indicating measurable system or model impact.`;
  }

  return `Key result signal: recent (${year}) technical contribution with architecture relevance worth deeper validation.`;
}

function toDiscoveryPaper(entry, index) {
  const abstract = cleanAbstract(entry.abstract || "");
  const title = (entry.title || "Untitled discovery paper").trim();
  const year = Number(entry.year) || new Date().getFullYear();
  const authors = Array.isArray(entry.authors) && entry.authors.length > 0
    ? entry.authors.slice(0, 3).map((a) => a.name).join(", ")
    : "Web Discovery";
  const url = entry.url || (entry.externalIds && entry.externalIds.ArXiv ? `https://arxiv.org/abs/${entry.externalIds.ArXiv}` : "https://www.semanticscholar.org/");
  const summaryBase = abstract.length > 0
    ? abstract.slice(0, 320)
    : "This result was discovered from the live search query and appears relevant to LLM architecture, MoE, or dataflow optimization.";

  return {
    id: `web-live-${slugify(`${title}-${year}-${index}`)}`,
    title,
    authors,
    year,
    groups: ["latest", "read"],
    preview: summaryBase.slice(0, 148),
    summary: `${summaryBase}${summaryBase.endsWith(".") ? "" : "."}`,
    datacenter: inferDatacenterImpact(`${title} ${summaryBase}`),
    metrics: inferKeyResult(summaryBase, year),
    link: url,
    isDiscovery: true
  };
}

// Reconstruct plain-text abstract from OpenAlex inverted-index format (kept for metadata download)
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(" ");
}

// Uses the Flask backend discovery proxy — avoids CORS issues
async function fetchDiscoveredPapers() {
  const rangeEl = document.querySelector('input[name="discoveryRange"]:checked');
  const months = rangeEl ? parseInt(rangeEl.value, 10) : 1;

  const res = await fetch(`/api/discover?months=${months}`);
  if (!res.ok) throw new Error("Discovery request failed");

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  const results = data.results || [];
  if (results.length === 0) throw new Error("No results from discovery sources");

  // Display the query that was used (for transparency)
  if (discoveryQueryEl && data.query) {
    discoveryQueryEl.textContent = `Query: "${data.query}"`;
  }

  return results;
}

// Returns { papers: Paper[], skipped: number }
// Removes results already in the local library (cross-dedup) and dedupes within discovery.
function dedupeDiscoveredPapers(nextPapers) {
  const localTitles = new Set(dynamicLocalPapers.map((p) => p.title.toLowerCase().trim()));
  const notInLibrary = nextPapers.filter((p) => !localTitles.has(p.title.toLowerCase().trim()));
  const skipped = nextPapers.length - notInLibrary.length;

  const seenTitles = new Set();
  const merged = [...notInLibrary, ...discoveredWebPapers].filter((item) => {
    const key = item.title.toLowerCase().trim();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  return { papers: merged.slice(0, 30), skipped };
}

async function handleFindNewPapers() {
  if (!findNewPapersBtn) return;

  findNewPapersBtn.disabled = true;
  discoveryStatusEl.textContent = "Searching...";

  try {
    const fetched = await fetchDiscoveredPapers();

    if (fetched.length === 0) {
      discoveryStatusEl.textContent = "No results returned. Try again.";
      return;
    }

    // Dedupe within existing discovery results
    const seenTitles = new Set();
    const merged = [...fetched, ...discoveredWebPapers].filter((item) => {
      const key = item.title.toLowerCase().trim();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });

    discoveredWebPapers = merged.slice(0, 30);
    renderDiscoveryFeed();
    discoveryStatusEl.textContent = `Updated — ${fetched.length} results.`;
  } catch (error) {
    discoveryStatusEl.textContent = `Search failed: ${error.message}`;
  } finally {
    findNewPapersBtn.disabled = false;
  }
}

// ── PDF.js thumbnail rendering ─────────────────────────────────────────────
// Initialise the worker once PDF.js is available (loaded via <script> in head).
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const _thumbnailCache = new Map(); // paper.id → jpeg data URL
const _renderingSet   = new Set(); // paper.ids currently being fetched/rendered

// Derive a fetchable PDF URL from a paper's existing link field.
// Returns null when the link is an HTML page (blog posts, etc.).
function getPaperPdfUrl(paper) {
  // Local papers: link is the relative PDF path set by buildLocalPapers()
  if (paper.isLocal) return paper.link;

  const link = paper.link || "";

  // arXiv abstract page → direct PDF download
  if (link.includes("arxiv.org/abs/")) {
    return link.replace("arxiv.org/abs/", "arxiv.org/pdf/");
  }

  // Discovery papers whose link points at an arXiv page
  if (paper.isDiscovery && link.includes("arxiv.org")) {
    const m = link.match(/(\d{4}\.\d{4,5})/);
    if (m) return `https://arxiv.org/pdf/${m[1]}`;
  }

  // Already a direct PDF link (e.g. GPT-2 OpenAI PDF)
  if (/\.pdf(\?.*)?$/i.test(link)) return link;

  return null; // blog posts / HTML pages — keep SVG fallback
}

// Asynchronously render the first page of a paper's PDF into every
// img[data-paper-id] element currently in the DOM for that paper.
async function renderPdfThumbnail(paper) {
  if (!window.pdfjsLib) return;
  if (_renderingSet.has(paper.id)) return; // already in-flight

  // Serve instantly from cache if already rendered
  if (_thumbnailCache.has(paper.id)) {
    document
      .querySelectorAll(`img[data-paper-id="${CSS.escape(paper.id)}"]`)
      .forEach((el) => { el.src = _thumbnailCache.get(paper.id); });
    return;
  }

  const pdfUrl = getPaperPdfUrl(paper);
  if (!pdfUrl) return;

  _renderingSet.add(paper.id);
  try {
    const pdf  = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
    const page = await pdf.getPage(1);

    // Render at 480 px wide — enough quality for card + detail use
    const baseViewport = page.getViewport({ scale: 1 });
    const scale        = 480 / baseViewport.width;
    const viewport     = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    _thumbnailCache.set(paper.id, dataUrl);

    // Update every matching img still in the DOM
    document
      .querySelectorAll(`img[data-paper-id="${CSS.escape(paper.id)}"]`)
      .forEach((el) => { el.src = dataUrl; });
  } catch (_err) {
    // Network / CORS / parse error — keep SVG placeholder silently
  } finally {
    _renderingSet.delete(paper.id);
  }
}

// Queue async PDF renders for every paper image found in `container`.
function schedulePdfRenders(container) {
  if (!window.pdfjsLib) return;
  container.querySelectorAll("img[data-paper-id]").forEach((imgEl) => {
    const paper = papers.find((p) => p.id === imgEl.dataset.paperId)
                || discoveredWebPapers.find((p) => p.id === imgEl.dataset.paperId);
    if (paper) renderPdfThumbnail(paper);
  });
}

function filterPapers() {
  if (activeFilter === "all") return papers;
  return papers.filter((paper) => paper.groups.includes(activeFilter));
}

// Downloads a sidecar-format .json file for a discovery paper.
// The admin can place this file next to the matching PDF to promote it to the main library.
function downloadPaperMetadata(paper) {
  const sidecar = {
    title:      paper.title,
    authors:    paper.authors,
    year:       paper.year,
    preview:    paper.preview,
    summary:    paper.summary,
    datacenter: paper.datacenter,
    metrics:    paper.metrics,
    link:       paper.link,
  };
  const blob = new Blob([JSON.stringify(sidecar, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(paper.title)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderDiscoveryFeed() {
  if (!discoveryFeedEl) return;

  discoveryFeedEl.innerHTML = "";
  if (discoveryCountEl) {
    discoveryCountEl.textContent = `${discoveredWebPapers.length} results`;
  }

  for (const paper of discoveredWebPapers) {
    const card = document.createElement("div");
    card.className = "paper-card discovery-card";
    card.setAttribute("aria-label", paper.title);

    const [dkw1] = extractPaperKeywords(paper);
    card.innerHTML = `
      <img class="card-image" src="${kwPlaceholder(dkw1)}" alt="${dkw1}" data-wiki-article="${dkw1}" data-paper-id="${paper.id}" />
      <div class="card-body">
        <div class="card-tags">
          <span class="tag latest">Discovery</span>
        </div>
        <h3 class="card-title">${paper.title}</h3>
        <p class="card-preview">${paper.preview}</p>
        <div class="card-meta">${paper.authors} • ${paper.year}</div>
        <div class="card-footer">
          <a class="ghost-link card-footer-link" href="${paper.link}" target="_blank" rel="noopener noreferrer">Open Source</a>
          <div class="dl-btn-wrap">
            <button class="download-meta-btn" type="button">Download Metadata</button>
            <span class="dl-btn-tip" role="tooltip">Think this paper belongs in the library? Download its metadata and email it to the Administrator — they’ll add it to the Full Paper Summaries.</span>
          </div>
        </div>
      </div>
    `;

    card.querySelector(".download-meta-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      downloadPaperMetadata(paper);
    });

    card.querySelector(".card-footer-link").addEventListener("click", (e) => {
      e.stopPropagation();
    });

    card.addEventListener("click", () => {
      selectedPaperId = paper.id;
      // Highlight selected discovery card
      discoveryFeedEl.querySelectorAll(".discovery-card").forEach((c) => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      renderDetail();
    });

    discoveryFeedEl.appendChild(card);
  }
  scheduleWikiSummaryImages(discoveryFeedEl);
  schedulePdfRenders(discoveryFeedEl);
}

function renderFeed() {
  const filtered = filterPapers();
  const visible = filtered;

  if (!visible.some((paper) => paper.id === selectedPaperId) && visible.length > 0) {
    selectedPaperId = visible[0].id;
  }

  feedEl.innerHTML = "";

  for (const paper of visible) {
    const card = document.createElement("button");
    card.className = `paper-card ${paper.id === selectedPaperId ? "is-selected" : ""}`;
    card.type = "button";
    card.role = "option";
    card.setAttribute("aria-selected", String(paper.id === selectedPaperId));
    card.setAttribute("aria-label", `Select ${paper.title}`);

    const [fkw1] = extractPaperKeywords(paper);
    card.innerHTML = `
      <img class="card-image" src="${kwPlaceholder(fkw1)}" alt="${fkw1}" data-wiki-article="${fkw1}" data-paper-id="${paper.id}" />
      <div class="card-body">
        <div class="card-tags">
          ${paper.groups
            .map((group) => `<span class="tag ${groupClass(group)}">${groupLabel(group)}</span>`)
            .join("")}
        </div>
        <h3 class="card-title">${paper.title}</h3>
        <p class="card-preview">${paper.preview}</p>
        <div class="card-meta">${paper.authors} • ${paper.year}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      selectedPaperId = paper.id;
      renderFeed();
      renderDetail();
    });

    feedEl.appendChild(card);
  }

  feedCountEl.textContent = `${visible.length} papers`;
  if (feedTitleEl) {
    const filterLabel = activeFilter === "all" ? "All" : groupLabel(activeFilter);
    feedTitleEl.textContent = `Paper Feed — ${filterLabel}`;
  }
  scheduleWikiSummaryImages(feedEl);
  schedulePdfRenders(feedEl);
}

function renderDetail() {
  const paper = papers.find((item) => item.id === selectedPaperId)
              || discoveredWebPapers.find((item) => item.id === selectedPaperId);
  if (!paper) return;

  const [dkw1, dkw2, dkw3] = extractPaperKeywords(paper);
  const jumpLink = paper.isDiscovery
    ? `<span class="discovery-badge-detail">Web Discovery</span>`
    : `<a class="solid-link" href="#paper-${paper.id}">Jump to Full Section</a>`;

  const detailImageBlock = paper.infographic
    ? `<div class="summary-image-scroller" aria-label="Infographic for ${paper.title}">
        <figure class="infographic-figure">
          <img class="paper-infographic" src="${encodeURI(paper.infographic)}" alt="Infographic for ${paper.title}" />
        </figure>
      </div>`
    : `<div class="summary-image-scroller" aria-label="Key topic images for ${paper.title}">
        <div class="keyword-image-pair">
          <figure class="keyword-figure">
            <img class="summary-kw-image" src="${kwPlaceholder(dkw1)}" alt="${dkw1}" data-wiki-article="${dkw1}" data-paper-id="${paper.id}" />
            <figcaption class="keyword-label">${dkw1}</figcaption>
          </figure>
          <figure class="keyword-figure">
            <img class="summary-kw-image" src="${kwPlaceholder(dkw2)}" alt="${dkw2}" data-wiki-article="${dkw2}" />
            <figcaption class="keyword-label">${dkw2}</figcaption>
          </figure>
          <figure class="keyword-figure">
            <img class="summary-kw-image" src="${kwPlaceholder(dkw3)}" alt="${dkw3}" data-wiki-article="${dkw3}" />
            <figcaption class="keyword-label">${dkw3}</figcaption>
          </figure>
        </div>
      </div>`;

  detailEl.innerHTML = `
    ${detailImageBlock}
    <h2>${paper.title}</h2>
    <p class="detail-meta">${paper.authors} • ${paper.year}</p>
    <p class="detail-meta">Groups: ${paper.groups.map(groupLabel).join(", ")}</p>

    <div class="detail-summary">
      <h3>Summary</h3>
      <p>${paper.summary}</p>
    </div>

    <div class="detail-matters">
      <h3>Why It Matters for Datacenters</h3>
      <p>${paper.datacenter}</p>
    </div>

    <div class="detail-metrics">
      <h3>Key Result Signal</h3>
      <p>${paper.metrics}</p>
    </div>

    <div class="detail-link-row">
      ${jumpLink}
      <a class="ghost-link" href="${paper.link}" target="_blank" rel="noopener noreferrer">${linkLabel(paper)}</a>
      ${paper.isLocal ? `<button class="ghost-link edit-paper-btn" type="button" data-id="${paper.id}">Edit Metadata</button>
      <button class="ghost-link delete-paper-btn" type="button" data-id="${paper.id}">Delete Paper</button>` : ""}
    </div>
  `;

  // Bind edit button
  const editBtn = detailEl.querySelector(".edit-paper-btn");
  if (editBtn) {
    editBtn.addEventListener("click", () => showEditForm(paper));
  }
  // Bind delete button
  const deleteBtn = detailEl.querySelector(".delete-paper-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Delete "${paper.title}"? This removes the PDF and metadata permanently.`)) return;
      try {
        await deletePaperById(paper.id);
      } catch (e) {
        alert("Delete failed: " + e.message);
      }
    });
  }

  scheduleWikiSummaryImages(detailEl);
  schedulePdfRenders(detailEl);
}

// ── Inline edit form ───────────────────────────────────────────────────────
function showEditForm(paper) {
  const fields = ["title", "authors", "year", "preview", "summary", "datacenter", "metrics"];
  detailEl.innerHTML = `
    <h2>Edit: ${paper.title}</h2>
    <form id="editPaperForm" class="edit-paper-form">
      ${fields.map((f) => `
        <label class="edit-label">${f.charAt(0).toUpperCase() + f.slice(1)}
          ${f === "summary" || f === "datacenter" || f === "preview"
            ? `<textarea name="${f}" class="edit-input edit-textarea">${paper[f] || ""}</textarea>`
            : `<input name="${f}" class="edit-input" value="${(paper[f] || "").toString().replace(/"/g, "&quot;")}" />`}
        </label>`).join("")}
      <div class="detail-link-row">
        <button type="submit" class="solid-link">Save</button>
        <button type="button" class="ghost-link" id="cancelEdit">Cancel</button>
      </div>
    </form>
  `;

  document.getElementById("cancelEdit").addEventListener("click", renderDetail);
  document.getElementById("editPaperForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {};
    for (const [k, v] of formData.entries()) {
      updates[k] = k === "year" ? parseInt(v, 10) || paper.year : v;
    }
    try {
      await updatePaperMetadata(paper.id, updates);
    } catch (err) {
      alert("Save failed: " + err.message);
    }
  });
}

// Ordered term→article pairs for auto-detection in local / discovered papers.
// More specific patterns first — first three matches win.
const _termWikiArticle = [
  [/large language model|llms?\b/i,         "Large language model"],
  [/mixture.of.expert|moe\b/i,              "Mixture of experts"],
  [/transformer\b/i,                        "Transformer (deep learning)"],
  [/quantiz/i,                              "Quantization (signal processing)"],
  [/attention mechanism/i,                  "Attention (machine learning)"],
  [/deep.?seek/i,                           "DeepSeek"],
  [/\bllama\b/i,                            "Llama (language model)"],
  [/mistral/i,                              "Mistral AI"],
  [/agentic|\bagent\b/i,                    "Intelligent agent"],
  [/photonic|optical interconnect/i,        "Photonics"],
  [/dataflow/i,                             "Dataflow architecture"],
  [/kv.cache|key.value cache/i,             "Cache (computing)"],
  [/benchmark/i,                            "Benchmark (computing)"],
  [/\bgpu\b|graphics processing/i,          "Graphics processing unit"],
  [/\btpu\b|tensor processing/i,            "Tensor processing unit"],
  [/floating.point|fp8|fp4|nvfp/i,          "Floating-point arithmetic"],
  [/\bgemm\b|matrix mult/i,                 "Matrix multiplication"],
  [/\bcuda\b/i,                             "CUDA"],
  [/fine.tun/i,                             "Fine-tuning (deep learning)"],
  [/survey\b/i,                             "Academic publishing"],
  [/sparse/i,                               "Sparse matrix"],
  [/\bmemory\b/i,                           "Computer memory"],
  [/interconnect/i,                         "Network on a chip"],
  [/\binference\b/i,                        "Machine learning"],
  [/neural network|deep learning/i,         "Artificial neural network"],
];

// Returns [wikiArticle1, wikiArticle2, wikiArticle3] for any paper.
function extractPaperKeywords(paper) {
  const corpus = `${paper.title} ${paper.preview || ""} ${paper.summary || ""}`;
  const found = [];
  for (const [re, article] of _termWikiArticle) {
    if (re.test(corpus) && !found.includes(article)) {
      found.push(article);
      if (found.length === 3) break;
    }
  }
  if (found.length < 1) found.push("Large language model");
  if (found.length < 2) found.push("Artificial neural network");
  if (found.length < 3) found.push("Deep learning");
  return found;
}

// Shared cache: article title → thumbnail URL | null.
// _wikiPromiseMap deduplicates concurrent fetches for the same article.
const _wikiImgCache   = new Map();
const _wikiPromiseMap = new Map();

// Local keyword images folder — filenames match Wikipedia article titles exactly.
const _localImgBase = "Key Word Images/";

function fetchWikiThumb(article) {
  if (_wikiImgCache.has(article))   return Promise.resolve(_wikiImgCache.get(article));
  if (_wikiPromiseMap.has(article)) return _wikiPromiseMap.get(article);

  const p = fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
    { headers: { Accept: "application/json" } }
  )
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const url = d?.originalimage?.source || d?.thumbnail?.source || null;
      _wikiImgCache.set(article, url);
      return url;
    })
    .catch(() => { _wikiImgCache.set(article, null); return null; });

  _wikiPromiseMap.set(article, p);
  return p;
}

// Resolves a local image path for an article if the file exists in "Key Word Images/".
// Tries case variants in order (exact, lowercase) so e.g. "deepseek.png" matches "DeepSeek".
// Returns a Promise<string|null> — the first loadable path, or null.
function probeLocalImage(article) {
  const candidates = [...new Set([article, article.toLowerCase()])]
    .map((v) => _localImgBase + v + ".png");

  return candidates.reduce(
    (chain, path) =>
      chain.then((found) => {
        if (found) return found;
        return new Promise((resolve) => {
          const img = new Image();
          img.onload  = () => resolve(path);
          img.onerror = () => resolve(null);
          img.src = path;
        });
      }),
    Promise.resolve(null)
  );
}

// Fetches Wikipedia thumbnails and updates all img[data-wiki-article] in container.
// Checks Key Word Images/<article>.png first, then falls back to Wikipedia, then SVG placeholder.
function scheduleWikiSummaryImages(container) {
  container.querySelectorAll("img[data-wiki-article]").forEach((img) => {
    const article = img.dataset.wikiArticle;
    if (!article) return;
    // Local image takes priority — avoids a Wikipedia round-trip when we have our own image.
    probeLocalImage(article).then((localPath) => {
      if (localPath && img.isConnected) { img.src = localPath; return; }
      // No local image — try Wikipedia.
      fetchWikiThumb(article).then((url) => {
        if (url && img.isConnected) img.src = url;
        // If neither found, the kwPlaceholder SVG set at render time stays.
      });
    });
  });
}



// Inline SVG placeholder shown while (or instead of) a Wikipedia image.
// Designed to look reasonable as a permanent fallback, not just a transient spinner.
function kwPlaceholder(kw) {
  const safe = kw.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 36);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef2f8" rx="4"/><rect x="20" y="20" width="260" height="160" fill="none" stroke="#c8d8d2" stroke-width="1" rx="3"/><text x="150" y="96" text-anchor="middle" font-family="monospace" font-size="11" fill="#4a5d66" dominant-baseline="middle">${safe}</text></svg>`
  )}`;
}

function renderFullSections() {
  sectionEl.innerHTML = papers
    .map((paper) => {
      const [kw1, kw2, kw3] = extractPaperKeywords(paper);
      const sectionImageBlock = paper.infographic
        ? `<div class="summary-image-scroller" aria-label="Infographic for ${paper.title}">
            <figure class="infographic-figure">
              <img class="paper-infographic" src="${encodeURI(paper.infographic)}" alt="Infographic for ${paper.title}" />
            </figure>
          </div>`
        : `<div class="summary-image-scroller" aria-label="Key topic images for ${paper.title}">
            <div class="keyword-image-pair">
              <figure class="keyword-figure">
                <img class="summary-kw-image" src="${kwPlaceholder(kw1)}" alt="${kw1}" data-wiki-article="${kw1}" />
                <figcaption class="keyword-label">${kw1}</figcaption>
              </figure>
              <figure class="keyword-figure">
                <img class="summary-kw-image" src="${kwPlaceholder(kw2)}" alt="${kw2}" data-wiki-article="${kw2}" />
                <figcaption class="keyword-label">${kw2}</figcaption>
              </figure>
              <figure class="keyword-figure">
                <img class="summary-kw-image" src="${kwPlaceholder(kw3)}" alt="${kw3}" data-wiki-article="${kw3}" />
                <figcaption class="keyword-label">${kw3}</figcaption>
              </figure>
            </div>
          </div>`;
      return `
      <article class="paper-section" id="paper-${paper.id}">
        <h3>${paper.title}</h3>
        ${sectionImageBlock}
        <p><strong>Authors:</strong> ${paper.authors}</p>
        <p><strong>Year:</strong> ${paper.year}</p>
        <p><strong>Category:</strong> ${paper.groups.map(groupLabel).join(", ")}</p>
        <p><strong>Summary:</strong> ${paper.summary}</p>
        <p><strong>Datacenter Significance:</strong> ${paper.datacenter}</p>
        <p><strong>Key Result Signal:</strong> ${paper.metrics}</p>
        <p><a href="${paper.link}" target="_blank" rel="noopener noreferrer">${linkLabel(paper)}</a></p>
      </article>
      `;
    })
    .join("");
  scheduleWikiSummaryImages(sectionEl);
}

function bindSummarySearch() {
  const input = document.getElementById("summarySearch");
  const countEl = document.getElementById("summarySearchCount");
  if (!input) return;

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function applySearch() {
    const raw = input.value.trim();
    const sections = document.querySelectorAll("#fullSections .paper-section");
    let visible = 0;

    if (!raw) {
      sections.forEach((el) => el.classList.remove("summary-section--hidden"));
      // Remove any existing highlights
      sections.forEach((el) => {
        el.querySelectorAll(".summary-search-highlight").forEach((mark) => {
          mark.replaceWith(mark.textContent);
        });
      });
      countEl.textContent = "";
      return;
    }

    const re = new RegExp(escapeRe(raw), "gi");

    sections.forEach((el) => {
      // Remove old highlights first
      el.querySelectorAll(".summary-search-highlight").forEach((mark) => {
        mark.replaceWith(mark.textContent);
      });

      const text = el.innerText || el.textContent;
      if (re.test(text)) {
        el.classList.remove("summary-section--hidden");
        visible++;
        // Highlight matches inside text nodes only (safe, no innerHTML injection)
        highlightTextNodes(el, new RegExp(escapeRe(raw), "gi"));
      } else {
        el.classList.add("summary-section--hidden");
      }
    });

    countEl.textContent = visible === 0 ? "No matches" : `${visible} match${visible === 1 ? "" : "es"}`;
  }

  function highlightTextNodes(root, re) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim() && re.test(node.nodeValue)) {
        nodesToProcess.push(node);
      }
      re.lastIndex = 0;
    }
    nodesToProcess.forEach((textNode) => {
      const frag = document.createDocumentFragment();
      let last = 0;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(textNode.nodeValue)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(textNode.nodeValue.slice(last, m.index)));
        const mark = document.createElement("mark");
        mark.className = "summary-search-highlight";
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
      }
      if (last < textNode.nodeValue.length) frag.appendChild(document.createTextNode(textNode.nodeValue.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  input.addEventListener("input", applySearch);

  // Clear search when pressing Escape
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      applySearch();
      input.blur();
    }
  });
}

function bindFilters() {
  for (const btn of filterButtons) {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter || "all";
      filterButtons.forEach((node) => node.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderFeed();
      renderDetail();
    });
  }
}

/* ── Dynamic header offset ───────────────────────────────────────────
   Measures the hero header and sets --header-offset so the sticky
   panels always fill exactly the remaining viewport height,
   regardless of zoom level or header text wrapping.
   ─────────────────────────────────────────────────────────────────── */
function updateHeaderOffset() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  document.documentElement.style.setProperty(
    '--header-offset',
    hero.offsetHeight + 18 + 'px'   // 18px = sticky top gap
  );
}

function updateVisitCounter() {
  const el = document.getElementById("visitCounter");
  if (!el) return;
  const count = parseInt(localStorage.getItem("visitCount") || "0", 10) + 1;
  localStorage.setItem("visitCount", String(count));
  el.textContent = `Page visits: ${count}`;
}

function init() {
  updateVisitCounter();
  updateHeaderOffset();
  window.addEventListener('resize', updateHeaderOffset);

  if (findNewPapersBtn) {
    findNewPapersBtn.addEventListener("click", handleFindNewPapers);
  }

  // Bind upload form
  const uploadForm = document.getElementById("uploadPaperForm");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = uploadForm.querySelector('input[type="file"]');
      const file = fileInput.files[0];
      if (!file) { alert("Select a PDF file first."); return; }
      const metadata = {};
      for (const input of uploadForm.querySelectorAll("input[name], textarea[name]")) {
        if (input.type !== "file" && input.value.trim()) {
          metadata[input.name] = input.value.trim();
        }
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

  renderDiscoveryFeed();
  bindFilters();
  bindSummarySearch();

  // Fetch papers from Flask API
  fetchPapersFromApi();

  // Listen for server-sent events instead of polling
  const sse = new EventSource("/api/changes");
  sse.onmessage = () => fetchPapersFromApi();
  sse.onerror = () => {
    // SSE disconnected — fall back to a single retry after 10s
    setTimeout(() => fetchPapersFromApi(), 10000);
  };
}

init();
