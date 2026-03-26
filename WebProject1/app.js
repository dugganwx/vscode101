// Papers come from two sources only:
//   1. "AI papers for WebProject1/" folder (PDFs + JSON sidecars via papers-manifest.json)
//   2. "Find New Papers" button (OpenAlex scholarly article search)
let discoveredWebPapers = [];


const localPaperFolder = "AI papers for WebProject1";
// localPaperFiles is seeded from papers-manifest.json at runtime.
// Add PDFs to the "AI papers for WebProject1" folder and run watch-papers.py
// to regenerate the manifest — the page will pick up new files automatically.
let localPaperFiles = [];
let dynamicLocalPapers = [];

// Sidecar metadata from papers-manifest.json: maps PDF filename → metadata object.
// Populated by pollManifestJson(); used by buildLocalPapers() to override defaults.
let _manifestMetadata = {};

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

function buildLocalPapers(fileNames) {
  return fileNames.map((fileName) => {
    const sidecar = _manifestMetadata[fileName] || {};
    const year    = sidecar.year    || inferYear(fileName);
    const title   = sidecar.title   || toDisplayTitle(fileName);
    const hasSidecarGroups = Array.isArray(sidecar.groups) && sidecar.groups.length > 0;
    const groups  = hasSidecarGroups
                    ? sidecar.groups
                    : inferGroups(fileName, year);
    const relativePath = `${localPaperFolder}/${fileName}`;

    return {
      id: `local-${slugify(fileName)}`,
      title,
      authors:    sidecar.authors    || "Repository Paper",
      year,
      groups,
      _hasSidecarGroups: hasSidecarGroups,
      preview:    sidecar.preview    || "Local repository entry loaded from your WebProject1 paper folder.",
      summary:    sidecar.summary    || "This entry is pulled from the local paper repository. Add a custom hand-written summary here as you review the paper in detail.",
      datacenter: sidecar.datacenter || "Potentially relevant to accelerator efficiency, cluster architecture, inference economics, or system-level AI deployment tradeoffs.",
      metrics:    sidecar.metrics    || "Key result signal not yet extracted. Review and annotate this item for production use.",
      link:       sidecar.link       || encodeURI(relativePath),
      isLocal: true
    };
  });
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
  return paper.isLocal ? "Open Local PDF" : "Read Original Paper";
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

// Reads window.localPapersManifest (and window.localPapersMetadata) set by papers-manifest.js.
// Works from both file:// and http://, metadata is available synchronously at page load.
// Adds any new PDFs not yet in the feed and re-renders only when something changed.
function refreshLocalPapersFromManifest() {
  const files = Array.isArray(window.localPapersManifest) ? window.localPapersManifest : [];
  if (files.length === 0) return;

  // Populate _manifestMetadata from the JS manifest so metadata is available immediately
  // on both file:// and http://, without waiting for the async pollManifestJson() fetch.
  if (window.localPapersMetadata && typeof window.localPapersMetadata === "object") {
    _manifestMetadata = { ..._manifestMetadata, ...window.localPapersMetadata };
  }

  const existingIds = new Set(dynamicLocalPapers.map((p) => p.id));
  const newFiles = files.filter((f) => !existingIds.has(`local-${slugify(f)}`));

  if (newFiles.length === 0) return; // nothing new

  localPaperFiles = files;
  dynamicLocalPapers = buildLocalPapers(files);
  rebuildPapers();
  renderFeed();
  renderDetail();
  renderFullSections();
  console.log(`Local papers refreshed — ${dynamicLocalPapers.length} total (${newFiles.length} new)`);
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

// Reconstruct plain-text abstract from OpenAlex inverted-index format
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

// Map an OpenAlex work object to our internal paper model
function toDiscoveryPaperFromOpenAlex(entry, index) {
  const title = (entry.title || "Untitled discovery paper").trim();
  const year = entry.publication_date
    ? parseInt(entry.publication_date.slice(0, 4), 10)
    : new Date().getFullYear();
  const authors =
    Array.isArray(entry.authorships) && entry.authorships.length > 0
      ? entry.authorships
          .slice(0, 3)
          .map((a) => a.author?.display_name)
          .filter(Boolean)
          .join(", ")
      : "Web Discovery";
  const link =
    entry.open_access?.oa_url ||
    (entry.doi ? entry.doi : "https://openalex.org");
  const abstract = cleanAbstract(reconstructAbstract(entry.abstract_inverted_index));
  const summaryBase =
    abstract.length > 60
      ? abstract.slice(0, 320)
      : "This result was discovered from the live search and appears relevant to LLM architecture, MoE, or dataflow optimization.";

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
    link,
    isDiscovery: true
  };
}

// Map an arXiv Atom <entry> element to our internal paper model
function toDiscoveryPaperFromArxiv(entry, index) {
  const getEl = (tag) => entry.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
  const title = getEl("title").replace(/\s+/g, " ");
  const abstract = getEl("summary").replace(/\s+/g, " ");
  const published = getEl("published");
  const year = published ? parseInt(published.slice(0, 4), 10) : new Date().getFullYear();
  const link = getEl("id") || "https://arxiv.org";
  const authorEls = [...entry.getElementsByTagName("name")];
  const authors = authorEls.slice(0, 3).map((n) => n.textContent.trim()).join(", ") || "arXiv Discovery";

  const summaryBase = abstract.length > 60
    ? cleanAbstract(abstract).slice(0, 320)
    : "This result was discovered from arXiv and appears relevant to LLM architecture, MoE, or dataflow optimization.";

  return {
    id: `web-live-${slugify(`${title}-${year}-arxiv-${index}`)}`,
    title,
    authors,
    year,
    groups: ["latest", "read"],
    preview: summaryBase.slice(0, 148),
    summary: `${summaryBase}${summaryBase.endsWith(".") ? "" : "."}`,
    datacenter: inferDatacenterImpact(`${title} ${summaryBase}`),
    metrics: inferKeyResult(summaryBase, year),
    link,
    isDiscovery: true
  };
}

// Rotating topic queries — advances one slot per search click for variety
const _discoveryQueryPool = [
  "LLM transformer architecture mixture of experts attention mechanism",
  "large language model inference serving GPU efficiency",
  "mixture of experts sparse neural network scaling",
  "flash attention KV cache transformer memory optimization",
  "LLM quantization compression fine-tuning efficiency",
  "distributed training data parallelism model architecture",
  "AI inference throughput latency serving datacenter optimization",
  "foundation model pretraining scaling laws emergent capabilities",
  // Extended topic queries
  "LLM token generation latency speculative decoding autoregressive throughput",
  "LLM inference cost efficiency token economics serving infrastructure optimization",
  "agentic AI autonomous LLM agents planning tool use multi-agent systems",
  "dataflow architecture AI accelerator systolic array neural network hardware",
  "ARM processor AI inference edge neural network acceleration chip design",
  "AMD GPU AI accelerator ROCm CDNA MI300 machine learning architecture",
  "emerging disruptive AI architecture novel neural network paradigm breakthrough",
  "Nvidia next generation GPU architecture AI HPC accelerator interconnect",
];
let _discoveryQueryIndex = 0;

// Returns an ISO date string for N months in the past (e.g. "2024-09-23")
function _monthsAgoDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

// Uses OpenAlex (primary) + arXiv (secondary) — both support CORS from any origin including file://
async function fetchDiscoveredPapers() {
  const queryText = _discoveryQueryPool[_discoveryQueryIndex % _discoveryQueryPool.length];
  _discoveryQueryIndex++;

  const since = _monthsAgoDate(18);
  const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(
    queryText
  )}&sort=publication_date:desc&filter=publication_date:>${since}&per-page=15`;

  const arxivUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(
    "cat:cs.LG AND (transformer OR llm OR \"mixture of experts\" OR attention OR architecture)"
  )}&sortBy=submittedDate&sortOrder=descending&max_results=8`;

  const [openAlexResult, arxivResult] = await Promise.allSettled([
    fetch(openAlexUrl, { headers: { Accept: "application/json" } }),
    fetch(arxivUrl),
  ]);

  const results = [];

  if (openAlexResult.status === "fulfilled" && openAlexResult.value.ok) {
    const payload = await openAlexResult.value.json();
    const rows = Array.isArray(payload.results) ? payload.results : [];
    results.push(...rows.map((entry, i) => toDiscoveryPaperFromOpenAlex(entry, i)));
  }

  if (arxivResult.status === "fulfilled" && arxivResult.value.ok) {
    const xml = await arxivResult.value.text();
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const entries = [...doc.getElementsByTagName("entry")];
    results.push(...entries.map((entry, i) => toDiscoveryPaperFromArxiv(entry, results.length + i)));
  }

  if (results.length === 0) throw new Error("No results from OpenAlex or arXiv");
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

  return { papers: merged.slice(0, 24), skipped };
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

    const { papers: deduped, skipped } = dedupeDiscoveredPapers(fetched);
    discoveredWebPapers = deduped;
    // Discovery panel only — main feed is local library only, no re-render needed.
    renderDiscoveryFeed();
    const skipMsg = skipped > 0 ? ` (${skipped} already in your library)` : "";
    discoveryStatusEl.textContent = `Updated — ${fetched.length} results${skipMsg}.`;
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
  detailEl.innerHTML = `
    <div class="summary-image-scroller" aria-label="Key topic images for ${paper.title}">
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
    </div>
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
    </div>
  `;
  scheduleWikiSummaryImages(detailEl);
  schedulePdfRenders(detailEl);
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
      return `
      <article class="paper-section" id="paper-${paper.id}">
        <h3>${paper.title}</h3>
        <div class="summary-image-scroller" aria-label="Key topic images for ${paper.title}">
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
        </div>
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

function init() {
  updateHeaderOffset();
  window.addEventListener('resize', updateHeaderOffset);

  rebuildPapers();

  if (findNewPapersBtn) {
    findNewPapersBtn.addEventListener("click", handleFindNewPapers);
  }

  renderDiscoveryFeed();
  bindFilters();
  bindSummarySearch();
  renderFeed();
  renderDetail();
  renderFullSections();

  // Load local papers from papers-manifest.js (populated by watch-papers.py, works from file://)
  refreshLocalPapersFromManifest();

  // When served over HTTP, poll papers-manifest.json every 8 s for new PDFs
  // without needing a full page reload.
  if (location.hostname) {
    pollManifestJson(); // immediate call to get sidecar metadata on first load
    setInterval(pollManifestJson, 8000);
  }
}

// Fetches papers-manifest.json and rebuilds the local paper feed from the latest manifest + sidecar metadata.
let _lastManifestUpdated = "";
async function pollManifestJson() {
  try {
    const res = await fetch(`papers-manifest.json?_=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.files) || data.updated === _lastManifestUpdated) return;
    _lastManifestUpdated = data.updated;
    if (data.metadata && typeof data.metadata === "object") {
      _manifestMetadata = data.metadata;
    }
    localPaperFiles = data.files;
    dynamicLocalPapers = buildLocalPapers(data.files);
    rebuildPapers();
    renderFeed();
    renderDetail();
    renderFullSections();
  } catch (_) {
    // Network error or server not running — silently ignore
  }
}

init();
