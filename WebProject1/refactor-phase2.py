with open("app.js", "r", encoding="utf-8") as f:
    c = f.read()
orig = len(c)

# Check each replacement
def rep(old, new, label):
    global c
    if old in c:
        c = c.replace(old, new, 1)
        print("OK  " + label)
    else:
        print("MISS " + label)

# A: Remove discoveryQuery const
rep(
    'const discoveryQuery = "Latest AI White Papers LLMs DeepSkeek Arhitecture Mixture Of Experts Data Flow";\n',
    '',
    'discoveryQuery const'
)

# B: selectedPaperId safe init
rep(
    'let selectedPaperId = papers[0].id;\n',
    'let selectedPaperId = "";\n',
    'selectedPaperId init'
)

# C: rebuildPapers rewrite
old_r = (
    'function rebuildPapers() {\n'
    '  staticRepositoryPapers = [...curatedPapers, ...dynamicLocalPapers];\n'
    '  papers = [...discoveredWebPapers, ...staticRepositoryPapers];\n'
    '\n'
    '  if (!papers.some((item) => item.id === selectedPaperId) && papers.length > 0) {\n'
    '    selectedPaperId = papers[0].id;\n'
    '  }\n'
    '}'
)
new_r = (
    'function rebuildPapers() {\n'
    '  papers = [...dynamicLocalPapers, ...discoveredWebPapers];\n'
    '  if (!papers.some((item) => item.id === selectedPaperId) && papers.length > 0) {\n'
    '    selectedPaperId = papers[0].id;\n'
    '  }\n'
    '}'
)
rep(old_r, new_r, 'rebuildPapers')

# D: init() rewrite
old_i = (
    'function init() {\n'
    '  rebuildPapers();\n'
    '\n'
    '  if (discoveryQueryEl) {\n'
    '    discoveryQueryEl.textContent = `Results from: "${discoveryQuery}"`;\n'
    '  }\n'
    '\n'
    '  if (findNewPapersBtn) {\n'
    '    findNewPapersBtn.addEventListener("click", handleFindNewPapers);\n'
    '  }\n'
    '\n'
    '  renderDiscoveryFeed();\n'
    '  bindFilters();\n'
    '  bindSummarySearch();\n'
    '  renderFeed();\n'
    '  renderDetail();\n'
    '  renderFullSections();\n'
    '\n'
    '  // Load local papers from papers-manifest.js (populated by watch-papers.py)\n'
    '  refreshLocalPapersFromManifest();\n'
    '\n'
    '  // When served over HTTP, poll papers-manifest.json every 8 s for new PDFs\n'
    '  // without needing a full page reload (supplements the SSE reload signal).\n'
    '  if (location.hostname) {\n'
    '    setInterval(pollManifestJson, 8000);\n'
    '  }\n'
    '}'
)
new_i = (
    'function init() {\n'
    '  rebuildPapers();\n'
    '\n'
    '  if (findNewPapersBtn) {\n'
    '    findNewPapersBtn.addEventListener("click", handleFindNewPapers);\n'
    '  }\n'
    '\n'
    '  renderDiscoveryFeed();\n'
    '  bindFilters();\n'
    '  bindSummarySearch();\n'
    '  renderFeed();\n'
    '  renderDetail();\n'
    '  renderFullSections();\n'
    '\n'
    '  // Load local papers from papers-manifest.js (populated by watch-papers.py, works from file://)\n'
    '  refreshLocalPapersFromManifest();\n'
    '\n'
    '  // When served over HTTP, poll papers-manifest.json every 8 s for new PDFs\n'
    '  // without needing a full page reload.\n'
    '  if (location.hostname) {\n'
    '    pollManifestJson(); // immediate call to get sidecar metadata on first load\n'
    '    setInterval(pollManifestJson, 8000);\n'
    '  }\n'
    '}'
)
rep(old_i, new_i, 'init()')

# E: pollManifestJson rewrite
old_p = (
    '// Fetches papers-manifest.json and merges any newly discovered PDFs into the feed.\n'
    'let _lastManifestUpdated = "";\n'
    'async function pollManifestJson() {\n'
    '  try {\n'
    '    const res = await fetch(`papers-manifest.json?_=${Date.now()}`);\n'
    '    if (!res.ok) return;\n'
    '    const data = await res.json();\n'
    '    if (!Array.isArray(data.files) || data.updated === _lastManifestUpdated) return;\n'
    '    _lastManifestUpdated = data.updated;\n'
    '    // Store sidecar metadata so buildLocalPapers() can merge it.\n'
    '    if (data.metadata && typeof data.metadata === "object") {\n'
    '      _manifestMetadata = data.metadata;\n'
    '    }\n'
    '    // Sync window.localPapersManifest so refreshLocalPapersFromManifest works correctly\n'
    '    window.localPapersManifest = data.files;\n'
    '    refreshLocalPapersFromManifest();\n'
    '  } catch (_) {\n'
    '    // Network error or server not running \u2014 silently ignore\n'
    '  }\n'
    '}'
)
new_p = (
    '// Fetches papers-manifest.json and rebuilds the local paper feed from the latest manifest + sidecar metadata.\n'
    'let _lastManifestUpdated = "";\n'
    'async function pollManifestJson() {\n'
    '  try {\n'
    '    const res = await fetch(`papers-manifest.json?_=${Date.now()}`);\n'
    '    if (!res.ok) return;\n'
    '    const data = await res.json();\n'
    '    if (!Array.isArray(data.files) || data.updated === _lastManifestUpdated) return;\n'
    '    _lastManifestUpdated = data.updated;\n'
    '    if (data.metadata && typeof data.metadata === "object") {\n'
    '      _manifestMetadata = data.metadata;\n'
    '    }\n'
    '    localPaperFiles = data.files;\n'
    '    dynamicLocalPapers = buildLocalPapers(data.files);\n'
    '    rebuildPapers();\n'
    '    renderFeed();\n'
    '    renderDetail();\n'
    '    renderFullSections();\n'
    '  } catch (_) {\n'
    '    // Network error or server not running \u2014 silently ignore\n'
    '  }\n'
    '}'
)
rep(old_p, new_p, 'pollManifestJson')

with open("app.js", "w", encoding="utf-8") as f:
    f.write(c)
print("Done. " + str(orig) + " -> " + str(len(c)) + " chars")