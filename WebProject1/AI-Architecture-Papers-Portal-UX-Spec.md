# AI Architecture Papers Portal — UX/Product Specification

**Group:** Systems Architecture and Innovation  
**Stack:** Vanilla HTML + CSS + JavaScript (no frameworks)  
**Files:** `index.html`, `styles.css`, `app.js`, `papers-manifest.js`, `papers-manifest.json`, `watch-papers.py`  
**Last updated:** 2026-03-25

---

## 1. Product Vision

A high-signal, technically rigorous website that serves as a curated repository and summarisation portal for AI architecture papers targeting datacenter hardware professionals.

The portal answers four questions at a glance:

1. What papers matter most to our hardware group right now? → **Most Important** (auto-scored)
2. What papers are most read by practitioners? → **Most Read**
3. What is newest and worth immediate attention? → **Latest**
4. What new research is being published externally? → **Web Discovery** (live search)

---

## 2. Primary Audience

- Datacenter architects and systems engineers
- AI infrastructure and ML platform engineers
- HPC and systems performance engineers
- Technical leaders evaluating AI accelerator / interconnect roadmap decisions

---

## 3. Core UX Goals

| Goal | Measure |
|------|---------|
| Fast scanning | User identifies top papers in < 60 seconds |
| Trust and depth | Summaries are technically accurate, implementation-oriented |
| Frictionless discovery | Scrollable news-feed cards with auto-sourced images |
| Decision support | Every paper includes datacenter impact and key result signal |

---

## 4. Content Model

### 4.1 Paper Data Fields

Every paper object (local or discovered) contains:

| Field | Type | Source |
|-------|------|--------|
| `id` | string | Auto-generated slug from filename |
| `title` | string | Sidecar JSON → `toDisplayTitle(fileName)` fallback |
| `authors` | string | Sidecar JSON → `"Repository Paper"` fallback |
| `year` | number | Sidecar JSON → regex year from filename → 2024 fallback |
| `groups` | string[] | Sidecar JSON override → `inferGroups()` + `tagImportantPapers()` |
| `preview` | string | Sidecar JSON → generic placeholder |
| `summary` | string | Sidecar JSON → generic placeholder |
| `datacenter` | string | Sidecar JSON → `inferDatacenterImpact()` |
| `metrics` | string | Sidecar JSON → `inferKeyResult()` |
| `link` | string | Sidecar JSON → relative PDF path |
| `isLocal` | boolean | `true` for local library papers |
| `isDiscovery` | boolean | `true` for web-discovered papers |
| `_hasSidecarGroups` | boolean | `true` when admin set explicit `groups` in sidecar JSON |
| `_importanceScore` | number | Set by `_hwImportanceScore()` during rebuild |

### 4.2 Group Taxonomy

| Group | Assignment Method |
|-------|-------------------|
| `latest` | Always assigned to every local paper by `inferGroups()` |
| `read` | Assigned by `inferGroups()` if filename contains "survey", "technical report", or "benchmark" |
| `important` | Assigned to the **top 5** papers by hardware-relevance score via `tagImportantPapers()` — OR manually set via sidecar JSON `groups` array |

### 4.3 Importance Scoring Algorithm

The "Most Important" group is determined by a keyword + recency scoring function, not by manual curation.

**Formula:**

```
Score = Σ(Tier 1 keyword matches × 4) + Σ(Tier 2 keyword matches × 2) + max(0, 8 − (currentYear − paperYear))
```

**Corpus scanned:** `title + preview + summary + datacenter + metrics` (concatenated, lowercased).

**Tier 1 keywords (4 pts each — hardware-specific):**  
`GPU`, `TPU`, `CUDA`, `ROCm`, `accelerator`, `ASIC`, `systolic`, `GEMM`, `tensor core`, `matrix core`, `interconnect`, `NVLink`, `InfiniBand`, `HBM`, `bandwidth`, `MI300`, `CDNA`, `H100`, `A100`, `Hopper`, `Blackwell`, `dataflow`, `photonic`, `FLOPS`, `throughput`, `TDP`, `wafer`

**Tier 2 keywords (2 pts each — systems/infrastructure):**  
`inference`, `serving`, `quantization`, `FP8`, `FP4`, `INT8`, `sparsity`, `parallelism`, `distributed`, `KV cache`, `datacenter`, `TCO`, `latency`, `efficiency`, `speculative decoding`, `compression`, `fine-tuning`

**Age bonus (newer papers score higher):**  
- Current year (2026): +8
- 1 year old (2025): +7
- 2 years old (2024): +6
- ...decays by 1 per year, floor 0 (papers ≥ 8 years old get +0)

**Selection:**
- Papers with admin-set sidecar `groups` (`_hasSidecarGroups = true`) are **exempt** from auto-scoring — their groups are used as-is.
- All other papers are scored; the **top 5** get `"important"` added to their `groups` array.
- Non-top-5 papers have any stale `"important"` tag removed on each rebuild.
- Scoring runs on every call to `rebuildPapers()` (page load, manifest poll, local refresh).
- Top 5 titles and scores are logged to the browser console: `[Importance] Top 5: [...]`.

---

## 5. Paper Sources

### 5.1 Local Library (Primary)

Papers are PDFs placed in the `AI papers for WebProject1/` folder alongside optional `.json` sidecar files.

**Loading pipeline:**
1. `watch-papers.py` monitors the folder (5-second poll), generates `papers-manifest.js` and `papers-manifest.json`.
2. On page load, `papers-manifest.js` is loaded synchronously via `<script>` tag, setting `window.localPapersManifest` (filename array) and `window.localPapersMetadata` (metadata object).
3. `refreshLocalPapersFromManifest()` reads both globals immediately — works from `file://` and `http://`.
4. When served over HTTP (`location.hostname` is truthy), `pollManifestJson()` fetches `papers-manifest.json` every **8 seconds** with cache-busting. If the `updated` timestamp changes, the paper feed is fully rebuilt and re-rendered.

**Sidecar JSON format** (placed next to PDF as `filename.json`):
```json
{
  "title": "string",
  "authors": "string",
  "year": 2025,
  "preview": "short preview string",
  "summary": "longer summary string",
  "datacenter": "datacenter relevance string",
  "metrics": "key result signal string",
  "link": "URL or empty string",
  "groups": ["important", "latest"]
}
```
- All fields are optional; each one overrides the auto-inferred default.
- If `groups` is provided and non-empty, it becomes a hard override and the paper is exempt from importance auto-scoring.

### 5.2 Web Discovery (Secondary — Staging Area Only)

Discovery papers live in a separate panel and are **never promoted to the main feed**. They must be explicitly downloaded as sidecar JSON, placed next to a PDF, and picked up by the manifest pipeline to enter the local library.

**Data sources (fetched via CORS-friendly APIs):**
- **OpenAlex** (primary): `https://api.openalex.org/works?search={query}&sort=publication_date:desc&filter=publication_date:>{18 months ago}&per-page=15`
- **arXiv** (secondary): `https://export.arxiv.org/api/query?search_query=cat:cs.LG AND (transformer OR llm OR "mixture of experts" OR attention OR architecture)&sortBy=submittedDate&sortOrder=descending&max_results=8`

Both are fetched via `Promise.allSettled()` — partial failures are tolerated.

**Rotating query pool (16 queries, advances 1 per click):**
1. LLM transformer architecture mixture of experts attention mechanism
2. large language model inference serving GPU efficiency
3. mixture of experts sparse neural network scaling
4. flash attention KV cache transformer memory optimization
5. LLM quantization compression fine-tuning efficiency
6. distributed training data parallelism model architecture
7. AI inference throughput latency serving datacenter optimization
8. foundation model pretraining scaling laws emergent capabilities
9. LLM token generation latency speculative decoding autoregressive throughput
10. LLM inference cost efficiency token economics serving infrastructure optimization
11. agentic AI autonomous LLM agents planning tool use multi-agent systems
12. dataflow architecture AI accelerator systolic array neural network hardware
13. ARM processor AI inference edge neural network acceleration chip design
14. AMD GPU AI accelerator ROCm CDNA MI300 machine learning architecture
15. emerging disruptive AI architecture novel neural network paradigm breakthrough
16. Nvidia next generation GPU architecture AI HPC accelerator interconnect

**Deduplication:**
- Cross-dedup: discovery results matching a local library paper title are removed.
- Self-dedup: duplicate titles within discovery results are collapsed.
- Hard cap: **24** discovery results retained.

---

## 6. Information Architecture

### 6.1 Page Structure (top to bottom)

```
┌─────────────────────────────────────────────┐
│  <header class="hero">                      │
│    Eyebrow · Title · Description            │
│    Filter strip: All | Most Important |     │
│                  Most Read | Latest          │
└─────────────────────────────────────────────┘
┌─────────────────────┬───────────────────────┐
│ <aside feed-panel>  │ <section detail-panel> │
│  ┌─ Discovery ────┐ │  Keyword image trio    │
│  │  Web Discovery  │ │  Title · Authors · Yr  │
│  │  Find New Papers│ │  Groups                │
│  │  [cards...]     │ │  Summary               │
│  └────────────────┘ │  Why It Matters         │
│  ┌─ Paper Feed ───┐ │  Key Result Signal      │
│  │  Paper Feed —   │ │  Jump / Open link       │
│  │   {filter}      │ │                         │
│  │  [cards...]     │ │                         │
│  └────────────────┘ │                         │
│  ┌─ Search ───────┐ │                         │
│  │  Search Full    │ │                         │
│  │  Paper Summaries│ │                         │
│  └────────────────┘ │                         │
└─────────────────────┴───────────────────────┘
┌─────────────────────────────────────────────┐
│  <section full-sections-wrap>               │
│    Full Paper Summaries                     │
│    [article per paper...]                   │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  <footer>                                   │
└─────────────────────────────────────────────┘
```

### 6.2 CSS Layout Details

| Property | Value |
|----------|-------|
| Max width | `1200px`, centered |
| Grid columns | `minmax(320px, 390px) 1fr` |
| Grid gap | `18px` |
| Alignment | `align-items: stretch` (both panels match tallest column) |
| Overflow | `overflow-x: hidden` on `.layout` to prevent horizontal page scroll |
| Feed panel | `max-height: calc(100dvh - var(--header-offset, 116px))`, `position: sticky`, `top: 18px`, `scrollbar-gutter: stable` |
| Detail panel | `max-height: calc(100dvh - var(--header-offset, 116px))`, `position: sticky`, `top: 18px`, `overflow-y: auto`, `scrollbar-gutter: stable` |
| Discovery feed | `max-height: clamp(120px, 30dvh, 250px)` — guaranteed minimum of 120px even at extreme zoom |
| Paper feed | `max-height: clamp(160px, 35dvh, 380px)` — guaranteed minimum of 160px even at extreme zoom |
| Summary image | `min-width: min(760px, 100%)` — fits within container on narrow screens |

**Dynamic header offset (`--header-offset`):**

`updateHeaderOffset()` in `app.js` measures `document.querySelector('.hero').offsetHeight + 18` (px) on page load and on every `resize` event, then writes the result to `--header-offset` on `<html>`. This replaces the former hardcoded `116px` value and ensures the sticky panels fill exactly the remaining viewport height regardless of zoom level, DPI scaling, or header text wrapping. The `18px` accounts for the sticky `top` gap. Uses `100dvh` (dynamic viewport height) instead of `100vh` for accurate sizing when browser chrome appears/disappears on mobile.

### 6.3 Responsive Breakpoints

**Small laptops (`@media max-width: 1100px`)**

| Component | Desktop (> 1100px) | Small laptop (960–1100px) |
|-----------|-------------------|---------------------------|
| Grid columns | `minmax(320px, 390px) 1fr` | `minmax(280px, 340px) 1fr` |
| Grid gap | `18px` | `14px` |
| Feed card image | `128px` | `100px` |
| Card image min-height | `116px` | `80px` |

**Mobile (`@media max-width: 960px`)

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Grid columns | `minmax(320px, 390px) 1fr` | `1fr` (single column) |
| Feed panel | sticky, fixed max-height | `position: relative`, `height: auto` |
| Detail panel | sticky, fixed max-height | `position: relative`, `max-height: none`, `overflow-y: visible` |
| Card image width | `128px` | `104px` |
| Discovery feed max-height | `clamp(120px, 30dvh, 250px)` | `280px` |
| Summary image min-width | `min(760px, 100%)` | `min(560px, 100%)` |

**Narrow viewports (`@media max-width: 600px`)**

- All tooltips (`.important-btn-tip`, `.find-btn-tip`, `.dl-btn-tip`) are capped at `max-width: calc(100vw - 32px)` to prevent off-screen overflow.
- The "Most Important" tooltip repositions to left-aligned (no centering transform) with the caret arrow shifted to `left: 24px`.

**Cross-browser: scrollbar stability**

- `scrollbar-gutter: stable` on `.feed-panel`, `.detail-panel`, `.paper-feed`, and `.discovery-feed` prevents layout shift when scrollbars appear/disappear (especially visible in Edge).

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` removes all transitions site-wide.

---

## 7. UI Components

### 7.1 Filter Strip

Located in the `<header>` below the hero text. Four buttons in a `role="toolbar"` flex row:

| Button | `data-filter` | Default state |
|--------|--------------|---------------|
| All | `all` | `is-active` (default) |
| Most Important | `important` | Has hover tooltip (see below) |
| Most Read | `read` | — |
| Latest | `latest` | — |

**Behaviour:** Clicking a filter sets `activeFilter`, toggles `is-active` class, re-renders the feed and detail panel. The feed title updates to `"Paper Feed — {filter label}"`.

**Most Important tooltip** (on hover / focus-visible):
> Top 5 papers auto-ranked by hardware-relevance score.  
> Score = Σ(Tier 1 hardware keywords × 4) + Σ(Tier 2 systems keywords × 2) + max(0, 8 − (currentYear − paperYear)).  
> Newer papers score higher on the age term. Admin-pinned papers are exempt.

The tooltip is wrapped in `<div class="important-btn-wrap">` with a `<span class="important-btn-tip" role="tooltip">` sibling, displayed via CSS `:hover` / `:focus-visible` (no JS). It uses a downward-pointing caret arrow and fades in at 160ms.

### 7.2 Discovery Panel

Located at the top of the feed panel. Uses a `<details open>` element so users can **collapse** the panel to reclaim vertical space on constrained screens.

Contains:

- **Title row (`<summary>`):** "Web Discovery" + result count badge (`#discoveryCount`). Clicking the summary row toggles the panel open/closed. A `▾`/`▴` caret indicator (CSS `::after`) shows the current state.
- **"Find New Papers" button** (`#findNewPapersBtn`): triggers `handleFindNewPapers()`. Has a hover tooltip explaining it searches OpenAlex + arXiv and results stay in the staging area.
- **Status text** (`#discoveryStatus`): shows "Ready", "Searching...", "Updated — N results (M already in your library)", or error messages. Uses `aria-live="polite"`.
- **Discovery feed** (`#discoveryFeed`): scrollable card list.

**Discovery card structure:**
```
<div class="paper-card discovery-card">
  <img class="card-image" data-wiki-article="..." data-paper-id="..." />
  <div class="card-body">
    <div class="card-tags"><span class="tag latest">Discovery</span></div>
    <h3 class="card-title">...</h3>
    <p class="card-preview">...</p>
    <div class="card-meta">{authors} • {year}</div>
    <div class="card-footer">
      <a class="ghost-link card-footer-link" href="..." target="_blank">Open Source</a>
      <div class="dl-btn-wrap">
        <button class="download-meta-btn">Download Metadata</button>
        <span class="dl-btn-tip" role="tooltip">Think this paper belongs in the
        library? Download its metadata and email it to the Administrator —
        they'll add it to the Full Paper Summaries.</span>
      </div>
    </div>
  </div>
</div>
```

**Click behaviour:** Clicking a discovery card sets `selectedPaperId`, highlights the card with `is-selected` class (accent border + 2px box-shadow), and renders the paper in the detail panel. Footer buttons (`Open Source`, `Download Metadata`) use `stopPropagation()` to prevent card selection.

**Download Metadata:** Generates a sidecar-format `.json` file with `title`, `authors`, `year`, `preview`, `summary`, `datacenter`, `metrics`, `link`. Downloaded via `URL.createObjectURL()` + a temporary `<a>` click.

### 7.3 Paper Feed Panel

Located below the discovery panel. Contains:

- **Title row:** `<h2 id="feedTitle">Paper Feed</h2>` — dynamically updates to `"Paper Feed — All"`, `"Paper Feed — Most Important"`, etc., reflecting the active filter.
- **Count badge:** (`#feedCount`) shows `"N papers"`.
- **Paper feed** (`#paperFeed`, `role="listbox"`): scrollable card list.

**Paper card structure:**
```
<button class="paper-card [is-selected]" type="button" role="option"
        aria-selected="true|false" aria-label="Select {title}">
  <img class="card-image" data-wiki-article="..." data-paper-id="..." />
  <div class="card-body">
    <div class="card-tags">
      <span class="tag {groupClass}">{groupLabel}</span>
      ...
    </div>
    <h3 class="card-title">...</h3>
    <p class="card-preview">...</p>
    <div class="card-meta">{authors} • {year}</div>
  </div>
</button>
```

Cards are `<button>` elements (not `<div>`) for native keyboard accessibility.

### 7.4 Summary Search

Located below the paper feed. Filters the Full Paper Summaries section.

- **Input:** `<input id="summarySearch" type="search">` with a search icon SVG.
- **Count:** `<span id="summarySearchCount">` shows "N matches" or "No matches".
- **Behaviour:** On `input` event, sections not matching the query get `summary-section--hidden` class. Matching text nodes are wrapped in `<mark class="summary-search-highlight">` (background `#d6f5e3`). Uses `TreeWalker` with `SHOW_TEXT` filter for safe DOM-based highlighting (no innerHTML injection). Pressing `Escape` clears the search and blurs the input.

### 7.5 Detail Panel

Sticky right column showing the currently selected paper's full details.

**Sections rendered by `renderDetail()`:**

1. **Keyword image trio** — three `<figure class="keyword-figure">` elements in a flex row, each with `<img class="summary-kw-image">` + `<figcaption class="keyword-label">`. Images are 100% width × 180px height, `object-fit: cover`.
2. **Title** — `<h2>`
3. **Metadata** — `"{authors} • {year}"` and `"Groups: {group labels}"`
4. **Summary** — `<div class="detail-summary">`
5. **Why It Matters for Datacenters** — `<div class="detail-matters">`
6. **Key Result Signal** — `<div class="detail-metrics">`
7. **Action links** — For local papers: `<a class="solid-link" href="#paper-{id}">Jump to Full Section</a>` + `<a class="ghost-link" href="{link}">Open Local PDF</a>`. For discovery papers: `<span class="discovery-badge-detail">Web Discovery</span>` + `<a class="ghost-link" href="{link}">Open Discovery Source</a>`.

### 7.6 Full Paper Summaries

Below the two-column layout. Each paper renders as:
```
<article class="paper-section" id="paper-{id}">
  <h3>{title}</h3>
  [keyword image trio]
  <p><strong>Authors:</strong> ...</p>
  <p><strong>Year:</strong> ...</p>
  <p><strong>Category:</strong> ...</p>
  <p><strong>Summary:</strong> ...</p>
  <p><strong>Datacenter Significance:</strong> ...</p>
  <p><strong>Key Result Signal:</strong> ...</p>
  <p><a href="{link}">{linkLabel}</a></p>
</article>
```

---

## 8. Image System

### 8.1 Keyword Image Resolution Chain

Each paper gets **3 keyword images** derived from `extractPaperKeywords(paper)`, which scans `title + preview + summary` against 25 ordered regex→Wikipedia-article mappings (`_termWikiArticle`). First 3 unique matches win; unfilled slots default to "Large language model", "Artificial neural network", "Deep learning".

**Resolution order (per image, first match wins):**
1. **Local PNG:** `Key Word Images/{article}.png` (tries exact case, then lowercase). Probed via `new Image()` load test.
2. **Wikipedia thumbnail:** `https://en.wikipedia.org/api/rest_v1/page/summary/{article}` → `originalimage.source` or `thumbnail.source`. Cached in `_wikiImgCache` Map. Concurrent fetches are deduplicated via `_wikiPromiseMap`.
3. **SVG placeholder:** inline data URI SVG (`300×200`, `#eef2f8` background, monospace keyword text). Acts as permanent fallback if neither local nor Wikipedia image is found.

### 8.2 Keyword-to-Article Mapping (25 entries)

| Regex pattern | Wikipedia article |
|---------------|-------------------|
| `large language model\|llms?` | Large language model |
| `mixture.of.expert\|moe` | Mixture of experts |
| `transformer` | Transformer (deep learning) |
| `quantiz` | Quantization (signal processing) |
| `attention mechanism` | Attention (machine learning) |
| `deep.?seek` | DeepSeek |
| `llama` | Llama (language model) |
| `mistral` | Mistral AI |
| `agentic\|agent` | Intelligent agent |
| `photonic\|optical interconnect` | Photonics |
| `dataflow` | Dataflow architecture |
| `kv.cache\|key.value cache` | Cache (computing) |
| `benchmark` | Benchmark (computing) |
| `gpu\|graphics processing` | Graphics processing unit |
| `tpu\|tensor processing` | Tensor processing unit |
| `floating.point\|fp8\|fp4\|nvfp` | Floating-point arithmetic |
| `gemm\|matrix mult` | Matrix multiplication |
| `cuda` | CUDA |
| `fine.tun` | Fine-tuning (deep learning) |
| `survey` | Academic publishing |
| `sparse` | Sparse matrix |
| `memory` | Computer memory |
| `interconnect` | Network on a chip |
| `inference` | Machine learning |
| `neural network\|deep learning` | Artificial neural network |

### 8.3 PDF.js Thumbnails

For papers with a fetchable PDF URL, page 1 is rendered as a JPEG thumbnail via PDF.js 3.11.174.

- **Render width:** 480px (scaled proportionally)
- **JPEG quality:** 0.82
- **Cache:** `_thumbnailCache` Map (`paper.id` → data URL). In-flight renders tracked in `_renderingSet` to prevent duplicates.
- **URL derivation (`getPaperPdfUrl`):**
  - Local papers: use `paper.link` (relative PDF path)
  - arXiv abstract pages: replace `/abs/` with `/pdf/`
  - Discovery arXiv links: extract paper ID via regex, construct `/pdf/{id}`
  - Direct `.pdf` URLs: use as-is
  - HTML pages: return `null` (keep SVG/wiki fallback)

---

## 9. Design Language

### 9.1 Typography

- **Primary:** Space Grotesk (sans-serif) — headings, UI, metadata
- **Secondary:** Spectral (serif) — body text, summaries
- **Monospace fallback:** for keyword labels and SVG placeholders

### 9.2 Color Variables

```css
--bg: #f4f6f2         /* page background */
--panel: #fcfdfc       /* card/panel background */
--ink: #132028         /* primary text */
--muted: #4a5d66       /* secondary text */
--line: #c8d2cf        /* borders */
--important: #9e2f2f   /* Most Important badge — deep red */
--read: #205ea6        /* Most Read badge — cobalt */
--latest: #1f6b54      /* Latest badge — emerald */
--accent: #c66b2f      /* discovery highlights, selected state */
--radius: 18px         /* standard border radius */
--shadow: 0 12px 30px rgba(19, 32, 40, 0.12)
```

### 9.3 Tag Badges

| Group | CSS class | Background color |
|-------|-----------|-----------------|
| Most Important | `.tag.important` | `#9e2f2f` |
| Most Read | `.tag.read` | `#205ea6` |
| Latest | `.tag.latest` | `#1f6b54` |
| Discovery | `.tag.latest` (reused) | `#1f6b54` |

### 9.4 Interactive States

| Element | Hover | Selected |
|---------|-------|----------|
| Filter button | `translateY(-1px)` + box-shadow | Dark ink background, white text, `is-active` class |
| Paper card | — | `is-selected` class (border + shadow) |
| Discovery card | `cursor: pointer` | `is-selected` class (accent border + `0 0 0 2px var(--accent)` box-shadow) |
| Discovery badge (detail) | — | Inline `discovery-badge-detail` span: accent background, white text, 6px padding |

---

## 10. Accessibility

- **WCAG AA contrast** on all text/background combinations.
- Paper cards are `<button>` elements with `role="option"`, `aria-selected`, and `aria-label`.
- Filter strip uses `role="toolbar"` with `aria-label="Paper category filter"`.
- Discovery status uses `aria-live="polite"` for screen reader announcements.
- All images have `alt` text (keyword name or paper title).
- Focus states are visible on all interactive elements (`:focus-visible` selectors).
- Summary search count uses `aria-live="polite"`.
- `@media (prefers-reduced-motion: reduce)` disables all transitions and animations.

---

## 11. Tooling: watch-papers.py

A Python utility that automates manifest generation and provides a development server.

| Feature | Detail |
|---------|--------|
| Monitored folder | `AI papers for WebProject1/` |
| Poll interval | 5 seconds |
| Outputs | `papers-manifest.js` (JS globals), `papers-manifest.json` (JSON) |
| Sidecar loading | Reads `filename.json` next to `filename.pdf`; only safe fields (no `id`/`groups`/`isLocal` injection) |
| HTTP server | Port 5500 |
| Live reload | SSE endpoint at `/changes`; sends `"reload"` message when manifest changes; heartbeat every 25 seconds |
| CLI mode | `python watch-papers.py --once` generates manifests and exits without starting the server |

**Browser-side reload** (in `index.html`):
```javascript
var es = new EventSource("/changes");
es.onmessage = function (e) { if (e.data === "reload") location.reload(); };
es.onerror = function () { es.close(); };
```
Only activates when served via HTTP (`location.hostname` is truthy); silent no-op from `file://`.

---

## 12. Auto-Inference Functions

When sidecar metadata is missing, the system infers values from the PDF filename and generic context:

| Function | Input | Output |
|----------|-------|--------|
| `slugify(value)` | filename | lowercase slug for paper ID |
| `inferYear(fileName)` | filename | 4-digit year via regex, default 2024 |
| `toDisplayTitle(fileName)` | filename | human-readable title (strips `.pdf`, numbers, underscores) |
| `inferGroups(fileName, year)` | filename, year | `["latest"]` always; adds `"read"` if filename contains "survey", "technical report", or "benchmark". Does **not** assign `"important"` — that is solely handled by `tagImportantPapers()`. |
| `inferDatacenterImpact(text)` | title + summary | One of 4 datacenter relevance strings based on keyword detection (MoE/inference/dataflow/generic) |
| `inferKeyResult(text, year)` | summary, year | Extracts first numeric metric or generates a generic recency signal |

---

## 13. Key HTML Element IDs

| ID | Element | Purpose |
|----|---------|---------|
| `findNewPapersBtn` | `<button>` | Triggers web discovery search |
| `discoveryFeed` | `<div>` | Container for discovery cards |
| `discoveryCount` | `<span>` | Shows "N results" in discovery header |
| `discoveryStatus` | `<span>` | Live status text for discovery operations |
| `feedTitle` | `<h2>` | Dynamic title: "Paper Feed — {filter}" |
| `feedCount` | `<span>` | Shows "N papers" in feed header |
| `paperFeed` | `<div>` | Container for local library cards |
| `selectedDetail` | `<div>` | Detail panel content target |
| `fullSections` | `<div>` | Full Paper Summaries container |
| `summarySearch` | `<input>` | Search input for full summaries |
| `summarySearchCount` | `<span>` | Match count for summary search |

---

## 14. Constraints and Invariants

1. **Discovery papers never enter the main feed.** They exist only in the Web Discovery panel. To promote a discovery paper to the library, an admin must download its metadata JSON, add a PDF to the local folder, place the JSON sidecar alongside it, and run `watch-papers.py`.
2. **The importance scoring auto-runs on every rebuild.** There is no manual "rank" button; `tagImportantPapers()` is called inside `rebuildPapers()` every time papers are loaded or refreshed.
3. **Top-N is fixed at 5.** There is no UI control to change the number of "Most Important" papers.
4. **Sidecar `groups` are a hard override.** If an admin sets `"groups"` in a sidecar JSON, that paper's groups are locked to whatever the admin specified, and the paper is excluded from importance auto-scoring entirely.
5. **No backend authentication.** The site is a static page served from the filesystem or a simple HTTP server. All data is local files + public API calls.
6. **Discovery API calls are CORS-friendly.** Both OpenAlex and arXiv support unauthenticated CORS requests, enabling the site to work from `file://` and any origin.
7. **PDF.js is loaded from CDN.** Version 3.11.174 from cdnjs. Worker source is set once at load.
8. **Wikipedia image API is unauthenticated.** Fetches from `en.wikipedia.org/api/rest_v1/page/summary/`. Rate limits are managed by caching — each article is fetched at most once per session.

---

## 15. Acceptance Criteria

- [ ] Page loads and displays all local PDFs from the `AI papers for WebProject1/` folder.
- [ ] Papers with sidecar JSON show their custom title, authors, year, summary, and datacenter text.
- [ ] Filter buttons (All, Most Important, Most Read, Latest) correctly filter the paper feed; only matching papers are shown.
- [ ] The "Paper Feed" title updates to reflect the active filter (e.g., "Paper Feed — Most Important").
- [ ] Exactly 5 papers appear when "Most Important" filter is selected (auto-scored, excluding admin-pinned papers from the scoring pool).
- [ ] Hovering over "Most Important" button shows a tooltip describing the scoring formula.
- [ ] "Find New Papers" button fetches results from OpenAlex + arXiv and populates the Web Discovery panel.
- [ ] Discovery results are cross-deduped against the local library and self-deduped by title.
- [ ] Clicking a discovery card renders it in the detail panel with a "Web Discovery" badge instead of a "Jump to Full Section" link.
- [ ] "Download Metadata" button on discovery cards triggers a JSON file download in sidecar format.
- [ ] Keyword images resolve: local PNG → Wikipedia thumbnail → SVG placeholder.
- [ ] PDF thumbnails render for local PDFs and arXiv discovery papers.
- [ ] Summary search filters Full Paper Summaries sections and highlights matching text.
- [ ] Layout is responsive: two-column sticky on desktop, single-column stacked on mobile (breakpoint 960px).
- [ ] All interactive elements are keyboard accessible with visible focus states.
- [ ] `@media (prefers-reduced-motion: reduce)` disables all animations.
- [ ] Console logs `[Importance] Top 5:` with paper titles and scores on each rebuild.

---

## 16. Seed Paper Library

Papers are loaded dynamically from the `AI papers for WebProject1/` folder via `papers-manifest.js`. The static seed list from the original spec (Attention Is All You Need, BERT, GPT-2/3, Scaling Laws, Megatron-LM, ZeRO, GShard, Switch Transformers, PaLM, FlashAttention, LLaMA, vLLM, Mistral 7B, DBRX) has been superseded by the live filesystem-driven approach. Any PDF placed in the folder is automatically indexed; sidecar JSON provides editorial metadata.

---

## 17. Future Migration Path

- Card data from API/CMS (replacing filesystem + sidecar JSON)
- "Most Read" populated by real analytics pipeline (replacing filename heuristics)
- Importance scoring weights tunable via admin UI
- User-facing score display and sort-by-score option
- Authentication for admin-only metadata editing
