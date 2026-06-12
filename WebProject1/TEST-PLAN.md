# AI Architecture Papers Portal — Independent Test Plan

**Application:** AI Architecture Papers Portal  
**Version:** 1.0  
**Date:** 2026-06-12  
**Server URL:** http://localhost:5000  
**Stack:** Flask (Python) backend, Vanilla HTML/CSS/JS frontend, SQLite database  
**Prepared for:** Independent Site Testers

---

## Table of Contents

1. [Test Environment & Prerequisites](#1-test-environment--prerequisites)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Main Page Load & Layout](#3-main-page-load--layout)
4. [Paper Feed & Filtering](#4-paper-feed--filtering)
5. [Paper Detail Panel](#5-paper-detail-panel)
6. [Full Paper Summaries Section](#6-full-paper-summaries-section)
7. [Summary Search](#7-summary-search)
8. [Web Discovery Panel](#8-web-discovery-panel)
9. [Discovery Search & Ranking](#9-discovery-search--ranking)
10. [Image System](#10-image-system)
11. [Paper CRUD API](#11-paper-crud-api)
12. [AI-Powered Features](#12-ai-powered-features)
13. [Clipboard & Reporting](#13-clipboard--reporting)
14. [Server-Sent Events (SSE) — Live Updates](#14-server-sent-events-sse--live-updates)
15. [Responsive Design & Cross-Browser](#15-responsive-design--cross-browser)
16. [Accessibility](#16-accessibility)
17. [Performance & Stability](#17-performance--stability)
18. [Security](#18-security)
19. [Error Handling & Edge Cases](#19-error-handling--edge-cases)

---

## 1. Test Environment & Prerequisites

### Setup

| Item | Detail |
|------|--------|
| Server | Flask dev server on `http://localhost:5000` |
| Python | 3.14 (global install) |
| Database | SQLite (`papers.db`) — auto-created on first run |
| Paper folder | `AI papers for WebProject1/` (must contain at least 5 PDFs with JSON sidecars) |
| Browsers to test | Chrome (latest), Edge (latest), Firefox (latest), Safari (latest on macOS if available) |
| Network | Corporate proxy configured; Azure OpenAI endpoint reachable (for AI tests) |

### Starting the Server

```
cd WebProject1
start.bat
```
Server should start on port 5000 and print the watched folder path.

### Test Data Checklist

Before testing, confirm:

- [ ] At least 5 PDFs exist in `AI papers for WebProject1/`
- [ ] At least 3 PDFs have `.json` sidecar files with full metadata
- [ ] At least 2 PDFs have no sidecar (for auto-inference tests)
- [ ] At least 1 PDF has a `.jpg`/`.jpeg` infographic image alongside it
- [ ] At least 1 sidecar has an explicit `"groups"` array (admin-pinned)
- [ ] `papers.db` has been deleted or is fresh (for first-user bootstrap test)

---

## 2. Authentication & Authorization

### TC-AUTH-001: First User Bootstrap (Auto-Registration)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure `papers.db` has no users (delete DB or verify `user_count = 0`) | — |
| 2 | Navigate to `http://localhost:5000/` | Redirected to `/login` |
| 3 | Enter a username and password, click "Sign In" | Account is auto-created; redirected to main page |
| 4 | Log out and log back in with the same credentials | Login succeeds |

### TC-AUTH-002: Login Page — Valid Credentials

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login` | Login form is displayed with Username, Password fields, and "Sign In" button |
| 2 | Enter valid username and password | Redirected to `/` (main page) |
| 3 | Check page title | "Login — AI Architecture Papers Portal" on login page |

### TC-AUTH-003: Login Page — Invalid Credentials

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter incorrect username or password on `/login` | Redirected to `/login?error=Invalid+username+or+password` |
| 2 | Verify error message is displayed | Red error alert reads "Invalid username or password" |

### TC-AUTH-004: Registration Page

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/register` | Registration form with Username, Password, Confirm Password fields |
| 2 | Submit with valid data (password ≥ 4 chars, passwords match) | Account created; auto-logged in; redirected to `/` |
| 3 | Submit with mismatched passwords | Error: "Passwords do not match" |
| 4 | Submit with password < 4 chars | Error: "Password must be at least 4 characters" |
| 5 | Submit with empty username | Error: "Username and password are required" |
| 6 | Submit with already-taken username | Error: "Username already taken" |

### TC-AUTH-005: Registration Page Links

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On `/register`, click "Sign in" link | Navigates to `/login` |
| 2 | On `/login`, click "Create one" link | Navigates to `/register` |

### TC-AUTH-006: Logout

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | While logged in, navigate to `/logout` | Session ends; redirected to `/login` |
| 2 | Try to access `/` directly | Redirected to `/login` |

### TC-AUTH-007: Unauthenticated API Access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Without logging in, call `GET /api/papers` | Returns `401` JSON: `{"error": "Authentication required"}` |
| 2 | Without logging in, call `GET /api/visit-count` | Returns `401` |
| 3 | Without logging in, navigate to `/` | Redirected to `/login?next=/` |

### TC-AUTH-008: Authenticated Redirect After Login

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | While unauthenticated, navigate to `/` | Redirected to `/login?next=/` |
| 2 | Log in with valid credentials | Redirected back to `/` (the original target) |

### TC-AUTH-009: Already Authenticated — Login/Register Pages

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | While logged in, navigate to `/login` | Redirected to `/` (main page) |
| 2 | While logged in, navigate to `/register` | Redirected to `/` (main page) |

---

## 3. Main Page Load & Layout

### TC-LOAD-001: Initial Page Load

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in and load `/` | Page displays hero header, filter strip, two-column layout, and footer |
| 2 | Check hero section | Contains eyebrow text "SYSTEMS ARCHITECTURE AND INNOVATION", title, description |
| 3 | Verify filter buttons | Four buttons visible: All, Most Important, Most Read, Latest |
| 4 | "All" button is active by default | Has `is-active` class with dark background |

### TC-LOAD-002: Visit Counter

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load the main page | Visit count in DB increments by 1 |
| 2 | Call `GET /api/visit-count` | Returns JSON `{"count": N}` where N ≥ 1 |
| 3 | Reload the page | Visit count increments again |

### TC-LOAD-003: Static File Serving

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load `/styles.css` | CSS file returned with correct content type |
| 2 | Load `/app.js` | JavaScript file returned |
| 3 | Load a PDF: `/AI papers for WebProject1/{filename}.pdf` | PDF file downloads/displays |
| 4 | Load a keyword image: `/Key Word Images/{name}.png` | Image displays |

### TC-LOAD-004: Two-Column Desktop Layout

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View on screen > 1100px wide | Two-column grid: feed panel (left, ~320-390px), detail panel (right, fills remaining) |
| 2 | Both panels are sticky | Panels remain visible while scrolling the full summaries section |
| 3 | Feed panel contains: Discovery section, Paper Feed, Summary Search | All three sub-panels visible and scrollable |

---

## 4. Paper Feed & Filtering

### TC-FEED-001: Paper Feed Population

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load main page | Paper feed shows cards for all PDFs in the local library |
| 2 | Verify card structure | Each card shows: thumbnail image, group tag(s), title, preview text, authors, year |
| 3 | Check feed count badge | Shows "N papers" matching the actual count |
| 4 | Feed title shows "Paper Feed" or "Paper Feed — All" | Correct |

### TC-FEED-002: Filter — All

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "All" filter button | All papers appear in the feed |
| 2 | Feed title updates | Shows "Paper Feed — All" |
| 3 | Button has `is-active` state | Dark background, white text |

### TC-FEED-003: Filter — Most Important

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Most Important" filter button | Exactly 5 papers appear (auto-scored, excluding admin-pinned) |
| 2 | Feed title updates | Shows "Paper Feed — Most Important" |
| 3 | Feed count badge | Shows "5 papers" |
| 4 | Open browser console | Log entry `[Importance] Top 5:` visible with paper titles and scores |

### TC-FEED-004: Filter — Most Read

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Most Read" filter button | Only papers with `"read"` group appear |
| 2 | These include papers whose filename contains "survey", "technical report", or "benchmark" | Correct matches shown |
| 3 | Feed count updates | Matches visible card count |

### TC-FEED-005: Filter — Latest

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Latest" filter button | All papers appear (every paper gets `"latest"` group) |
| 2 | Feed title updates | Shows "Paper Feed — Latest" |

### TC-FEED-006: Filter Button Toggle Behavior

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Most Important" then click "Most Read" | Only "Most Read" is active; previous deactivated |
| 2 | Active filter button has visual differentiation | `is-active` class with distinct styling |
| 3 | Clicking same filter twice | Filter remains active (does not deselect) |

### TC-FEED-007: Most Important Tooltip

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Hover over "Most Important" button | Tooltip appears explaining the scoring formula |
| 2 | Tooltip content | Mentions Tier 1/Tier 2 keywords, age term, top 5, admin-pinned exemption |
| 3 | Move mouse away | Tooltip disappears (160ms fade) |

### TC-FEED-008: Paper Card Selection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click any paper card in the feed | Card gets `is-selected` class (border + shadow highlight) |
| 2 | Previously selected card | Loses `is-selected` class |
| 3 | Detail panel updates | Shows the clicked paper's details |

### TC-FEED-009: Sidecar vs Auto-Inferred Data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a paper WITH a sidecar JSON | Title, authors, year, summary match the sidecar data |
| 2 | Select a paper WITHOUT a sidecar JSON | Title is auto-generated from filename; year is regex-extracted or defaults to 2024 |

### TC-FEED-010: Admin-Pinned Papers (Sidecar Groups Override)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify a paper with explicit `"groups"` in its sidecar JSON | Paper uses the sidecar-defined groups, not auto-scored |
| 2 | This paper's `pinned` flag is `1` in the DB | Confirmed via `GET /api/papers/{id}` |
| 3 | Paper is excluded from importance auto-scoring | Does not appear in "Most Important" unless `"important"` is in its sidecar groups |

---

## 5. Paper Detail Panel

### TC-DETAIL-001: Detail Panel Rendering

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click a local paper card | Detail panel shows: keyword images, title, authors/year, groups, summary, datacenter significance, key result signal |
| 2 | Action links for local paper | "Jump to Full Section" link + "Open Local PDF" link |

### TC-DETAIL-002: Keyword Image Trio

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View detail panel for any paper | Three keyword images displayed in a flex row |
| 2 | Each has a figcaption label | Keywords derived from paper title/preview/summary |
| 3 | Images are 100% width × 180px height with `object-fit: cover` | Correctly sized |

### TC-DETAIL-003: Jump to Full Section

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Jump to Full Section" link | Page scrolls to the corresponding `#paper-{id}` anchor in the Full Summaries section |

### TC-DETAIL-004: Open Local PDF

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Open Local PDF" link | PDF opens in a new tab or downloads |

### TC-DETAIL-005: Discovery Paper in Detail Panel

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click a discovery card | Detail panel shows "Web Discovery" badge instead of "Jump to Full Section" |
| 2 | Link shows "Open Discovery Source" | Opens the external source URL in a new tab |

---

## 6. Full Paper Summaries Section

### TC-SUMMARY-001: Full Summary Rendering

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll below the two-column layout | Full Paper Summaries section visible |
| 2 | Each paper has an `<article>` with anchor ID `paper-{id}` | Correct |
| 3 | Each summary includes: title, keyword images, authors, year, category, summary text, datacenter significance, key result signal, PDF link | All fields rendered |

### TC-SUMMARY-002: Summary Section Count

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Count summary sections | Matches total number of local library papers |

---

## 7. Summary Search

### TC-SEARCH-001: Basic Search

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type a keyword in the summary search input | Matching summary sections remain visible; non-matching sections get hidden |
| 2 | Match count updates | Shows "N matches" in `#summarySearchCount` |
| 3 | Matching text is highlighted | `<mark class="summary-search-highlight">` wraps matches (green background `#d6f5e3`) |

### TC-SEARCH-002: No Matches

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type a query that matches no papers | All sections hidden; count shows "No matches" |

### TC-SEARCH-003: Clear Search

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type a query, then clear the input (backspace or clear button) | All sections reappear; highlights removed |
| 2 | Press Escape key while search input is focused | Input is cleared and blurred |

### TC-SEARCH-004: Safe DOM Highlighting

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for `<script>alert(1)</script>` | No script execution; treated as literal text |
| 2 | Search for HTML entities | No DOM injection; TreeWalker-based highlighting is safe |

---

## 8. Web Discovery Panel

### TC-DISC-001: Discovery Panel Structure

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify discovery panel location | Top of feed panel, inside a `<details open>` element |
| 2 | Title row shows "Web Discovery" | With result count badge |
| 3 | "Find New Papers" button is visible | Clickable |
| 4 | Status text shows "Ready" initially | `aria-live="polite"` attribute present |

### TC-DISC-002: Collapse/Expand Discovery Panel

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the `<summary>` row | Discovery panel collapses; caret changes to `▴` |
| 2 | Click again | Panel expands; caret changes to `▾` |

### TC-DISC-003: Find New Papers

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Find New Papers" button | Status changes to "Searching..." |
| 2 | Wait for results | Discovery feed populates with cards; status shows "Updated — N results (M already in your library)" |
| 3 | Results appear from OpenAlex and/or arXiv | At least some results shown (network permitting) |

### TC-DISC-004: Find New Papers Tooltip

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Hover over "Find New Papers" button | Tooltip explains it searches OpenAlex + arXiv and results stay in the staging area |

### TC-DISC-005: Discovery Card Structure

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View a discovery card | Shows: image, "Discovery" tag, title, preview, authors/year |
| 2 | Footer has "Open Source" link | Opens external URL in new tab |
| 3 | Footer has "Download Metadata" button | Present with tooltip on hover |

### TC-DISC-006: Discovery Card Selection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click a discovery card body | Card gets `is-selected` class (accent border + box-shadow) |
| 2 | Detail panel updates to show discovery paper | Includes "Web Discovery" badge |
| 3 | Click "Open Source" link in card footer | Link opens; card selection does NOT change (stopPropagation) |

### TC-DISC-007: Download Metadata

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Download Metadata" on a discovery card | A `.json` file downloads |
| 2 | Inspect the downloaded JSON | Contains: `title`, `authors`, `year`, `preview`, `summary`, `datacenter`, `metrics`, `link` |
| 3 | JSON is in sidecar format | Compatible with placing next to a PDF for library import |

### TC-DISC-008: Cross-Deduplication

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run discovery when a local paper matches a discovered title | Matching discovery results are removed from the feed |

### TC-DISC-009: Self-Deduplication

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe discovery results | No duplicate titles within the discovery feed |

### TC-DISC-010: Discovery Hard Cap

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run discovery multiple times | No more than 24 discovery results retained |

### TC-DISC-011: Rotating Query Pool

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Find New Papers" multiple times | Each click uses the next query from the 16-query pool |
| 2 | After 16 clicks | Query pool wraps around to the first query |

---

## 9. Discovery Search & Ranking

### TC-DSEARCH-001: Discovery Search API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `GET /api/discover/search?q=transformer&year_from=2024&year_to=2026` | Returns JSON with `results`, `query`, `source_counts`, etc. |
| 2 | Verify `source_counts` | Contains keys: `core-pr`, `openalex`, `arxiv` with integer values |
| 3 | Empty query | Returns empty results with `empty_reason` message |

### TC-DSEARCH-002: Discovery Rank API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `POST /api/discover/rank` with `team`, `query`, `candidates` | Returns ranked papers with architecture scores |
| 2 | Missing `team` parameter | Returns `400` with error message listing valid teams |
| 3 | Valid teams | `oie`, `e2o`, `ai_on_ia`, `hickory_delta` |

### TC-DSEARCH-003: Ranking Criteria API — GET

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `GET /api/discover/ranking-criteria?team=oie` | Returns criteria with `key`, `question`, `slider`, `weight`, `weight_percent` |
| 2 | Five criteria keys | `compute_arch_fit`, `memory_hierarchy_impact`, `cluster_scalability`, `implementation_readiness`, `efficiency_tco` |
| 3 | Missing/invalid team | Returns `400` error |

### TC-DSEARCH-004: Ranking Criteria API — POST (Update)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST new slider values and questions for a team | Updated criteria returned |
| 2 | Slider values clamped | Values stay within `0.0` to `10.0` |
| 3 | `reset_defaults: true` | Criteria reset to defaults for that team |

### TC-DSEARCH-005: Discovery Progress API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `GET /api/discover/progress` | Returns JSON with `stage`, `active`, `processed`, `total`, `found`, `source_counts`, `message` |
| 2 | Before any search | Stage is "idle", message is "Ready" |

---

## 10. Image System

### TC-IMG-001: Keyword Image Resolution Chain

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a paper whose keywords match a local PNG in `Key Word Images/` | Local PNG displayed |
| 2 | Select a paper whose keywords have no local PNG | Wikipedia thumbnail fetched and displayed |
| 3 | If Wikipedia fetch fails | SVG placeholder shown (300×200, `#eef2f8` background, keyword text) |

### TC-IMG-002: PDF.js Thumbnails

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View a local paper card | PDF page 1 thumbnail renders as the card image |
| 2 | Thumbnail dimensions | Render width ~480px, JPEG quality 0.82 |
| 3 | Subsequent views of same paper | Cached thumbnail used (no re-render) |

### TC-IMG-003: Infographic Image

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a paper that has a `.jpg` alongside its PDF | Infographic image displayed in the detail panel |

### TC-IMG-004: Generated Images Folder

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check `AI papers for WebProject1/generated/` | Directory exists (auto-created at startup) |
| 2 | After generating images via API | Files saved here as `{paper_id}_figure.jpg` or `{paper_id}_infographic.jpg` |

---

## 11. Paper CRUD API

### TC-API-001: List All Papers

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `GET /api/papers` | Returns JSON array of all local papers |
| 2 | Each paper object | Contains: `id`, `filename`, `title`, `authors`, `year`, `groups`, `preview`, `summary`, `datacenter`, `metrics`, `link`, `isLocal: true` |

### TC-API-002: Search Papers

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `GET /api/papers?q=transformer` | Returns papers whose metadata matches the query |
| 2 | Empty query | Returns all papers |

### TC-API-003: Get Single Paper

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `GET /api/papers/{valid_id}` | Returns single paper JSON |
| 2 | `GET /api/papers/nonexistent-id` | Returns `404` |

### TC-API-004: Create Paper (Upload PDF)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `POST /api/papers` with multipart form: `pdf` file + optional `title`, `authors`, `year`, `preview`, `summary`, `datacenter`, `metrics` | Returns `201` with created paper JSON |
| 2 | Verify PDF saved | File exists in `AI papers for WebProject1/` with `secure_filename()` applied |
| 3 | SSE event fired | Connected browsers receive "reload" event |
| 4 | Upload non-PDF file | Returns `400`: "File must be a PDF" |
| 5 | Upload without file | Returns `400`: "No PDF file provided" |
| 6 | Upload duplicate filename | Returns `409`: "A paper with this filename already exists" |

### TC-API-005: Update Paper Metadata

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `PUT /api/papers/{id}` with JSON body `{"title": "New Title"}` | Returns updated paper JSON |
| 2 | Nonexistent paper ID | Returns `404` |
| 3 | Empty/invalid fields | Returns `400`: "No valid fields provided" |

### TC-API-006: Delete Paper

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `DELETE /api/papers/{id}` | Returns `204` No Content |
| 2 | PDF file removed from disk | Confirmed |
| 3 | JSON sidecar removed from disk (if it existed) | Confirmed |
| 4 | SSE event fired | Connected browsers receive "reload" event |
| 5 | Delete nonexistent paper | Returns `404` |

### TC-API-007: Upload Size Limit

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload a file > 100 MB | Returns `413` Request Entity Too Large |

### TC-API-008: Citation Counts API

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `GET /api/papers/citation-counts` | Returns JSON object with `{paper_id: count_or_null}` for all papers |
| 2 | Counts fetched from OpenAlex | Logged in server console |

---

## 12. AI-Powered Features

> **Note:** These tests require Azure OpenAI to be configured in `azure_openai_config.txt`. If AI is unavailable, verify graceful degradation.

### TC-AI-001: Generate Infographic

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `POST /api/papers/{id}/generate-infographic` | Returns JSON with `generated_infographic` path or errors |
| 2 | Image saved to `generated/` folder | File exists as JPEG |
| 3 | Paper record updated | `generated_infographic` field set in DB |
| 4 | Nonexistent paper ID | Returns `404` |

### TC-AI-002: Generate Images (Best Figure + Infographic)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `POST /api/papers/{id}/generate-images` | Returns JSON with `best_figure` and `generated_infographic` paths |
| 2 | Best figure extracted from PDF via GPT-4o vision | JPEG file saved in `generated/` |
| 3 | Both fields updated in DB | Confirmed via GET |

### TC-AI-003: Discovery Figure Extraction

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `POST /api/discover/figure` with `{"pdf_url": "https://arxiv.org/pdf/2401.12345"}` | Returns `status`, `figure_base64`, `page`, `bbox` |
| 2 | Status `"found"` | Base64 image data present |
| 3 | Status `"none"` | Reason indicates text-only or no pages |
| 4 | No `pdf_url` | Returns `400` |

### TC-AI-004: Manual Bounding Box

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `POST /api/discover/figure/manual-bbox` with `pdf_url`, `manual_bbox` (normalized 0..1) | Returns `ok: true`, `bbox_validated: true` |
| 2 | Bbox validation | `x1 < x2`, `y1 < y2`, min 5% width/height |
| 3 | Invalid bbox | Returns `400` with error |
| 4 | Feedback saved to `figure_feedback` table | Confirmed |

### TC-AI-005: PDF Page Render

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `POST /api/discover/pdf-page` with `{"pdf_url": "...", "page": 0}` | Returns `image_base64`, `page`, `page_count`, `base_bbox`, `width`, `height` |
| 2 | DPI capped between 96 and 300 | Confirmed |
| 3 | Missing `pdf_url` | Returns `400` |

### TC-AI-006: AI Unavailable Graceful Degradation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Remove or invalidate `azure_openai_config.txt` | — |
| 2 | Call any AI endpoint | Returns appropriate error (e.g., `503` for report, `502`/error status for figure) |
| 3 | Non-AI features continue working | Paper feed, filtering, search, etc. all functional |

---

## 13. Clipboard & Reporting

### TC-CLIP-001: Download ZIP

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `POST /api/clipboard/download-zip` with `{"papers": [{pdf_url, title, id}, ...]}` | Returns ZIP file (`application/zip`) |
| 2 | ZIP contains PDFs named after slugified titles | Confirmed |
| 3 | Papers with missing `pdf_url` | ZIP entry is a `_error.txt` file instead |
| 4 | Empty papers array | Returns `400` |

### TC-CLIP-002: Generate Report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `POST /api/clipboard/report` with `{"papers": [...], "mode": "summary"}` | Returns JSON with `report` text (one-page summary) |
| 2 | Empty papers list | Returns `400` |
| 3 | AI not configured | Returns `503` with descriptive error |

---

## 14. Server-Sent Events (SSE) — Live Updates

### TC-SSE-001: SSE Connection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open browser on main page | `EventSource` connects to `/api/changes` |
| 2 | Check Network tab | SSE stream open with `text/event-stream` content type |
| 3 | Wait 25+ seconds without changes | Receive heartbeat `: ping` comment |

### TC-SSE-002: Live Paper Reload

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open the site in two browser tabs | Both connected via SSE |
| 2 | Drop a new PDF into `AI papers for WebProject1/` | Within 5 seconds, both tabs receive "reload" event |
| 3 | Paper feed updates in both tabs | New paper appears without manual refresh |

### TC-SSE-003: SSE on Paper CRUD

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create a paper via API (`POST /api/papers`) | SSE "reload" fires; open browsers update |
| 2 | Update a paper via API (`PUT /api/papers/{id}`) | SSE "reload" fires |
| 3 | Delete a paper via API (`DELETE /api/papers/{id}`) | SSE "reload" fires; paper disappears from feed |

### TC-SSE-004: SSE Requires Authentication

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Without logging in, try to connect to `/api/changes` | Returns `401` (not a valid SSE stream) |

---

## 15. Responsive Design & Cross-Browser

### TC-RESP-001: Desktop (> 1100px)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Browser width > 1100px | Two-column grid: feed panel (~320-390px) + detail panel |
| 2 | Grid gap is 18px | Verified in DevTools |
| 3 | Feed card images are 128px wide | Verified |
| 4 | Max container width is 1200px, centered | Verified |

### TC-RESP-002: Small Laptop (960px–1100px)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resize to ~1000px width | Grid columns shrink to `minmax(280px, 340px) 1fr` |
| 2 | Grid gap reduces to 14px | Verified |
| 3 | Card images shrink to 100px | Verified |

### TC-RESP-003: Mobile (< 960px)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resize to < 960px | Single-column layout (`1fr`) |
| 2 | Feed panel | `position: relative`, `height: auto` (not sticky) |
| 3 | Detail panel | `position: relative`, `max-height: none`, `overflow-y: visible` |
| 4 | Card images shrink to 104px | Verified |
| 5 | Discovery feed max-height | 280px |

### TC-RESP-004: Narrow (< 600px)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resize to < 600px | Tooltips capped at `max-width: calc(100vw - 32px)` |
| 2 | "Most Important" tooltip | Left-aligned (no centering transform), caret at `left: 24px` |
| 3 | No horizontal scrolling | Confirmed |

### TC-RESP-005: Cross-Browser Scrollbar Stability

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Test in Edge | `scrollbar-gutter: stable` prevents layout shift when scrollbar appears/disappears |
| 2 | Test in Chrome | Same behavior |
| 3 | Test in Firefox | Same behavior |

### TC-RESP-006: Dynamic Header Offset

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load page at various zoom levels (100%, 125%, 150%) | `--header-offset` CSS variable recalculated correctly |
| 2 | Resize browser window | `--header-offset` updates on `resize` event |
| 3 | Sticky panels fill remaining viewport height | No overflow or gap |

---

## 16. Accessibility

### TC-A11Y-001: Keyboard Navigation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tab through filter buttons | All four buttons receive focus |
| 2 | Press Enter/Space on filter button | Filter activates |
| 3 | Tab through paper feed cards | Cards (buttons) receive focus |
| 4 | Press Enter/Space on focused card | Card is selected; detail panel updates |

### TC-A11Y-002: ARIA Attributes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Filter strip | `role="toolbar"` with `aria-label="Paper category filter"` |
| 2 | Paper cards | `role="option"`, `aria-selected="true/false"`, `aria-label="Select {title}"` |
| 3 | Paper feed container | `role="listbox"` |
| 4 | Discovery status | `aria-live="polite"` |
| 5 | Summary search count | `aria-live="polite"` |

### TC-A11Y-003: Focus Visibility

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tab to any interactive element | Visible focus ring via `:focus-visible` |
| 2 | Test in Chrome, Edge, Firefox | Focus ring consistent |

### TC-A11Y-004: Alt Text

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inspect keyword images | `alt` attribute present with keyword name |
| 2 | Inspect card images | `alt` attribute present with paper title |

### TC-A11Y-005: Reduced Motion

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable "Reduce motion" in OS accessibility settings | All CSS transitions and animations disabled |
| 2 | Verify in DevTools | `@media (prefers-reduced-motion: reduce)` rules active |

### TC-A11Y-006: Color Contrast

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Test primary text (#132028) on page background (#f4f6f2) | WCAG AA compliant (contrast ratio ≥ 4.5:1) |
| 2 | Test tag badge text (white) on badge backgrounds (#9e2f2f, #205ea6, #1f6b54) | WCAG AA compliant |
| 3 | Test muted text (#4a5d66) on panel background (#fcfdfc) | WCAG AA compliant |

---

## 17. Performance & Stability

### TC-PERF-001: Initial Load Time

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Clear cache, load main page | Page renders with paper feed within 3 seconds (on localhost) |
| 2 | Check Network tab | No requests exceeding 5 seconds |

### TC-PERF-002: Concurrent SSE Connections

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open the site in 5 browser tabs | All 5 maintain SSE connections |
| 2 | Drop a new PDF into the paper folder | All 5 tabs receive the reload event |
| 3 | Server remains responsive | API calls still return quickly |

### TC-PERF-003: Large Library (50+ Papers)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 50+ PDFs to the paper folder | Feed loads all papers without significant lag |
| 2 | Filtering still responsive | Sub-second UI updates |
| 3 | Summary search still responsive | Highlighting works without visible delay |

### TC-PERF-004: Threaded Server

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | While SSE stream is active, make API calls | API calls succeed (not blocked by SSE) |
| 2 | Multiple simultaneous API requests | All return correctly (threaded mode) |

### TC-PERF-005: Folder Watcher Stability

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Leave server running for 30+ minutes | Watcher thread continues polling every 5 seconds |
| 2 | Add/remove PDFs during this time | Changes detected and reported |
| 3 | No memory leaks or thread crashes | Server console shows no errors |

---

## 18. Security

### TC-SEC-001: CSRF Protection — Login Form

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify login form uses `method="POST"` | Confirmed |
| 2 | Verify registration form uses `method="POST"` | Confirmed |

### TC-SEC-002: Password Storage

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create a user account | — |
| 2 | Inspect `papers.db` → `users` table | `password_hash` column contains a Werkzeug hash, NOT plaintext |

### TC-SEC-003: XSS Prevention — Summary Search

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for `<img src=x onerror=alert(1)>` | Treated as literal text; no script execution |
| 2 | DOM-based highlighting via TreeWalker | No innerHTML injection |

### TC-SEC-004: XSS Prevention — Error Messages

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/login?error=<script>alert(1)</script>` | Error message rendered as text, not executed |
| 2 | Error display uses `textContent`, not `innerHTML` | Confirmed in source |

### TC-SEC-005: Filename Sanitization

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload a PDF with path traversal name: `../../etc/passwd.pdf` | `secure_filename()` sanitizes to safe name |
| 2 | File saved only within `AI papers for WebProject1/` | No path traversal |

### TC-SEC-006: Authentication on All API Endpoints

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Without login, call each API endpoint (papers, discover, clipboard, SSE) | All return `401` or redirect to login |
| 2 | Verify no endpoint is publicly accessible | Confirmed |

### TC-SEC-007: Upload Size Enforcement

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt to upload file > 100 MB | Rejected by Flask's `MAX_CONTENT_LENGTH` (100 MB) |

---

## 19. Error Handling & Edge Cases

### TC-ERR-001: Empty Paper Folder

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Remove all PDFs from `AI papers for WebProject1/` | Paper feed shows empty state |
| 2 | Filtering works but shows 0 results | No errors in console |
| 3 | Full Summaries section is empty | No crash |

### TC-ERR-002: Corrupt Sidecar JSON

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Place a PDF with an invalid JSON sidecar (syntax error) | Server logs a warning: `[warn] sidecar read error` |
| 2 | Paper still appears in feed | Uses auto-inferred metadata |
| 3 | Other papers unaffected | All load correctly |

### TC-ERR-003: Missing Paper Folder

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Rename or delete the `AI papers for WebProject1/` folder | Watcher handles `FileNotFoundError` gracefully |
| 2 | Server keeps running | No crash |
| 3 | Restore folder | Watcher picks up PDFs on next poll |

### TC-ERR-004: Stale Server Process

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start server, note PID | — |
| 2 | Start server again | Old process killed via PID file; new server starts on port 5000 |
| 3 | Verify `flask.pid` updated | Contains new PID |

### TC-ERR-005: Network Failure — Discovery

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disconnect from internet (or block proxy) | — |
| 2 | Click "Find New Papers" | Status shows error message (not a crash) |
| 3 | Local library features continue working | Feed, filtering, search all functional |

### TC-ERR-006: Concurrent Paper Upload with Same Name

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload `paper.pdf` | Succeeds |
| 2 | Upload `paper.pdf` again | Returns `409`: "A paper with this filename already exists" |

### TC-ERR-007: API with Invalid JSON Body

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `PUT /api/papers/{id}` with malformed JSON | Handled gracefully (uses `get_json(silent=True)`) |
| 2 | Returns `400` with appropriate error | No server crash |

### TC-ERR-008: Discovery with ArXiv URL Conversion

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit an arXiv abstract URL (`arxiv.org/abs/2401.12345`) to discover figure | URL automatically converted to PDF URL (`arxiv.org/pdf/2401.12345`) |
| 2 | Figure extraction proceeds normally | No error from URL format |

---

## Appendix A: API Endpoint Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/login` | No | Login page and handler |
| GET/POST | `/register` | No | Registration page and handler |
| GET | `/logout` | Yes | End session |
| GET | `/` | Yes | Main page |
| GET | `/styles.css` | No | Stylesheet |
| GET | `/app.js` | No | Frontend JavaScript |
| GET | `/AI papers for WebProject1/<path>` | No | Serve PDFs and sidecars |
| GET | `/Key Word Images/<path>` | No | Serve keyword images |
| GET | `/api/papers` | Yes | List/search papers |
| GET | `/api/papers/<id>` | Yes | Get single paper |
| POST | `/api/papers` | Yes | Upload new paper |
| PUT | `/api/papers/<id>` | Yes | Update paper metadata |
| DELETE | `/api/papers/<id>` | Yes | Delete paper + files |
| POST | `/api/papers/<id>/generate-infographic` | Yes | Generate AI infographic |
| POST | `/api/papers/<id>/generate-images` | Yes | Generate best-figure + infographic |
| GET | `/api/papers/citation-counts` | Yes | Fetch live citation counts |
| GET | `/api/visit-count` | Yes | Get visit counter |
| POST | `/api/discover/figure` | Yes | Extract figure from discovery PDF |
| POST | `/api/discover/figure/manual-bbox` | Yes | Save manual bounding box |
| POST | `/api/discover/pdf-page` | Yes | Render a PDF page/region |
| GET | `/api/discover/search` | Yes | Search external paper sources |
| POST | `/api/discover/rank` | Yes | AI-rank discovery candidates |
| GET | `/api/discover/ranking-criteria` | Yes | Get ranking criteria for a team |
| POST | `/api/discover/ranking-criteria` | Yes | Update ranking criteria |
| GET | `/api/discover/progress` | Yes | Poll discovery progress |
| POST | `/api/clipboard/download-zip` | Yes | Bundle PDFs into ZIP |
| POST | `/api/clipboard/report` | Yes | Generate LLM report |
| GET | `/api/changes` | Yes | SSE live update stream |

## Appendix B: Test Result Template

| Test Case ID | Tester | Date | Browser | Result (Pass/Fail) | Notes |
|-------------|--------|------|---------|-------------------|-------|
| TC-AUTH-001 | | | | | |
| TC-AUTH-002 | | | | | |
| ... | | | | | |

---

*End of Test Plan*
