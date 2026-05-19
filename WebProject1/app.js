// ── AI Architecture Papers Portal — SPA with 3 pages ──────────────────────
// Page 1: Discovery — AI-powered paper search with year range
// Page 2: Search Library — text search within local library + upload
// Page 3: Library View — all papers + filters + full summaries

let discoveredWebPapers = [];
let dynamicLocalPapers = [];
let papers = [];
let activeFilter = "all";

// ── DOM refs ───────────────────────────────────────────────────────────────

const discoveryFeedEl     = document.getElementById("discoveryFeed");
const discoveryCountEl    = document.getElementById("discoveryCount");
const discoveryQueryEl    = document.getElementById("discoveryQuery");
const discoveryStatusEl   = document.getElementById("discoveryStatus");
const findNewPapersBtn    = document.getElementById("findNewPapersBtn");
const librarySearchFeedEl = document.getElementById("librarySearchFeed");
const librarySearchInput  = document.getElementById("librarySearchInput");
const librarySearchCount  = document.getElementById("librarySearchCount");
const libraryFeedEl       = document.getElementById("libraryFeed");
const feedCountEl         = document.getElementById("feedCount");
const sectionEl           = document.getElementById("fullSections");
const filterButtons       = [...document.querySelectorAll(".filter-btn")];

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(value) {
  return value.toLowerCase().replace(/\.pdf$/i, "").replace(/^[0-9]+\./, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function groupLabel(group) {
  if (group === "important") return "Most Important";
  if (group === "read")      return "Most Read";
  if (group === "latest")    return "Latest";
  return group;
}

function groupClass(group) { return group; }

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

function rebuildPapers() {
  papers = [...dynamicLocalPapers];
  tagImportantPapers(papers);
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
      groups: Array.isArray(p.groups) ? p.groups : ["latest"],
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
  if (!res.ok || !data.figure_base64) {
    throw new Error(data.error || "Could not extract figure");
  }
  return data.figure_base64;
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

function _buildImageBlock(paper) {
  // Library papers: show infographic + best_figure side-by-side (or generate button)
  if (paper.isLocal) {
    const infoSrc = paper.generated_infographic || paper.infographic;
    const figSrc = paper.best_figure;
    if (infoSrc || figSrc) {
      // At least one image exists — show what we have
      return `<div class="card-image-wrap card-image-pair">
        <img class="card-image" src="${escapeHtml(infoSrc || _imgPlaceholder)}" alt="Infographic" />
        <img class="card-image" src="${escapeHtml(figSrc || _imgPlaceholder)}" alt="Key figure" />
      </div>`;
    }
    // No images at all — show generate button
    return `<div class="card-image-wrap card-image-placeholder">
      <button class="generate-images-btn" type="button" data-id="${escapeHtml(paper.id)}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Generate Images
      </button>
    </div>`;
  }

  // Discovery papers: show best figure if cached, otherwise show find button
  if (paper._discoveryFigure) {
    return `<div class="card-image-wrap">
      <img class="card-image" src="${escapeHtml(paper._discoveryFigure)}" alt="Key figure" />
    </div>`;
  }
  if (paper.link) {
    return `<div class="card-image-wrap card-image-placeholder">
      <button class="find-figure-btn" type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
        Find Figure
      </button>
    </div>`;
  }
  return `<div class="card-image-wrap card-image-placeholder">
    <span class="no-image-label">No image available</span>
  </div>`;
}

function renderExpandedCard(paper) {
  const card = document.createElement("article");
  card.className = "paper-card";
  card.setAttribute("aria-label", paper.title);

  // Tags
  let tagsHtml = "";
  if (paper.isDiscovery) {
    tagsHtml = paper.source === "ai-recommended"
      ? '<span class="tag tag-ai">AI Recommended</span>'
      : '<span class="tag tag-openalex">OpenAlex</span>';
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
        <button class="download-meta-btn" type="button">Download Metadata</button>
        <span class="dl-btn-tip" role="tooltip">Think this paper belongs in the library? Download its metadata and email it to the Administrator.</span>
      </div>`;
  }

  // Local paper edit/delete
  let editBtns = "";
  if (paper.isLocal) {
    editBtns = `
      <button class="ghost-link edit-paper-btn" type="button" data-id="${paper.id}">Edit</button>
      <button class="ghost-link delete-paper-btn" type="button" data-id="${paper.id}">Delete</button>`;
  }

  card.innerHTML = `
    ${_buildImageBlock(paper)}
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
      <div class="card-actions">
        ${actionHtml}
        ${extraBtns}
        ${editBtns}
      </div>
    </div>
  `;

  // Bind buttons
  const dlBtn = card.querySelector(".download-meta-btn");
  if (dlBtn) dlBtn.addEventListener("click", () => downloadPaperMetadata(paper));

  const editBtn = card.querySelector(".edit-paper-btn");
  if (editBtn) editBtn.addEventListener("click", () => showEditForm(paper, card));

  const deleteBtn = card.querySelector(".delete-paper-btn");
  if (deleteBtn) deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${paper.title}"? This removes the PDF and metadata permanently.`)) return;
    try { await deletePaperById(paper.id); } catch (e) { alert("Delete failed: " + e.message); }
  });

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
        const newCard = renderExpandedCard(paper);
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
        const b64 = await findDiscoveryFigure(paper.link);
        paper._discoveryFigure = b64;
        const newCard = renderExpandedCard(paper);
        card.replaceWith(newCard);
      } catch (e) {
        findFigBtn.disabled = false;
        findFigBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg> No figure found`;
        findFigBtn.title = e.message;
      }
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
      updates[k] = k === "year" ? parseInt(v, 10) || paper.year : v;
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

  const btn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if (btn) { btn.classList.add("is-active"); btn.setAttribute("aria-selected", "true"); }

  location.hash = pageId;

  // Render page content on switch
  if (pageId === "page-search-library") renderSearchLibrary();
  if (pageId === "page-library-view") { renderLibraryView(); renderFullSections(); }
}

// ── Page 1: Discovery ──────────────────────────────────────────────────────

async function handleFindNewPapers() {
  if (!findNewPapersBtn) return;
  findNewPapersBtn.disabled = true;
  discoveryStatusEl.textContent = "Searching with AI...";

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

    const res = await fetch(`/api/discover?${params.toString()}`);
    if (!res.ok) throw new Error("Discovery request failed");
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const results = data.results || [];
    if (discoveryQueryEl && data.query) {
      const aiLabel = data.ai_available ? "AI + OpenAlex" : "OpenAlex";
      discoveryQueryEl.textContent = `Query (${aiLabel}): "${data.query}" | Years: ${yearFrom}\u2013${yearTo}`;
    }

    // Dedupe
    const seenTitles = new Set();
    const merged = [...results, ...discoveredWebPapers].filter((item) => {
      const key = item.title.toLowerCase().trim();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });
    discoveredWebPapers = merged.slice(0, 30);

    renderDiscoveryFeed();
    discoveryStatusEl.textContent = `Updated \u2014 ${results.length} results.`;
  } catch (error) {
    discoveryStatusEl.textContent = `Search failed: ${error.message}`;
  } finally {
    findNewPapersBtn.disabled = false;
  }
}

function renderDiscoveryFeed() {
  if (!discoveryFeedEl) return;
  discoveryFeedEl.innerHTML = "";
  if (discoveryCountEl) discoveryCountEl.textContent = `${discoveredWebPapers.length} results`;

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
    libraryFeedEl.appendChild(renderExpandedCard(paper));
  }
}

function renderFullSections() {
  if (!sectionEl) return;
  sectionEl.innerHTML = papers.map((paper) => {
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
  }

  fromSlider.addEventListener("input", update);
  toSlider.addEventListener("input", update);
}

// ── Init ───────────────────────────────────────────────────────────────────

function init() {
  // Page navigation
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchPage(btn.dataset.page));
  });

  // Restore page from hash
  const hash = location.hash.replace("#", "");
  if (hash && document.getElementById(hash)) {
    switchPage(hash);
  }

  // Discovery: search button + enter key
  if (findNewPapersBtn) findNewPapersBtn.addEventListener("click", handleFindNewPapers);
  const discoverySearchInput = document.getElementById("discoverySearchInput");
  if (discoverySearchInput) {
    discoverySearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); handleFindNewPapers(); }
    });
  }

  // Topic pills
  document.querySelectorAll(".topic-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const input = document.getElementById("discoverySearchInput");
      if (input) input.value = pill.dataset.query;
      document.querySelectorAll(".topic-pill").forEach((p) => p.classList.remove("topic-pill--active"));
      pill.classList.add("topic-pill--active");
      handleFindNewPapers();
    });
  });

  // Year range sliders
  bindYearSliders();

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

  // SSE for live updates
  const sse = new EventSource("/api/changes");
  sse.onmessage = () => fetchPapersFromApi();
  sse.onerror = () => { setTimeout(() => fetchPapersFromApi(), 10000); };
}

init();
