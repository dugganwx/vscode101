import sys
sys.stdout.reconfigure(encoding="utf-8")
with open("app.js", "r", encoding="utf-8") as f:
    content = f.read()
orig_len = len(content)

# 1. Remove curatedPapers array (file starts with it; discoveredWebPapers follows immediately)
cut = content.index("\nlet discoveredWebPapers = [")
content = content[cut + 1:]  # drop curatedPapers block; keep "let discoveredWebPapers..."

# 2. Replace hardcoded discoveredWebPapers entries with empty array
dw_s = content.index("let discoveredWebPapers = [")
dw_e = content.index("];\n\nconst localPaperFolder", dw_s) + 2  # +2 skips past "];", lands on "\n\nconst"
replacement = (
    "// Papers come from two sources only:\n"
    '//   1. "AI papers for WebProject1/" folder (PDFs + JSON sidecars via papers-manifest.json)\n'
    '//   2. "Find New Papers" button (OpenAlex scholarly article search)\n'
    "let discoveredWebPapers = [];\n"
)
content = content[:dw_s] + replacement + content[dw_e:]

# 3. Remove _hwKeywords + _hwScore + _applyHwGroups IIFE
hw_s = content.index("\n// \u2500\u2500 Hardware-engineer relevance scoring")
iife_fn = content.index("(function _applyHwGroups", hw_s)
iife_end = content.index("})();\n", iife_fn) + len("})();\n")
content = content[:hw_s] + content[iife_end:]

# 4. Remove staticRepositoryPapers variable
srp = (
    "\n// staticRepositoryPapers is rebuilt whenever the manifest is refreshed\n"
    "let staticRepositoryPapers = [...curatedPapers];\n"
)
content = content.replace(srp, "\n", 1)

# 5. Replace papers initialisation with empty array
content = content.replace(
    "let papers = [...discoveredWebPapers, ...staticRepositoryPapers];\n",
    "let papers = [];\n",
    1
)

# 6. Remove paperAltMap constant
pam_s = content.index("\nconst paperAltMap = {")
pam_e = content.index("};\n", pam_s) + 3
content = content[:pam_s] + content[pam_e:]

# 7. Remove SVG diagram block (_diagramCache var + _buildDiagramCache() + getPaperDiagramDataUri())
diag_s = content.index("\n// \u2500\u2500 Per-paper SVG diagram generator")
diag_e = content.index("\n\nconst feedEl = document", diag_s) + 1  # +1 keeps "\nconst feedEl"
content = content[:diag_s] + content[diag_e:]

# 8. Remove _hashInt + paperImageDataUri + paperImageSrc + paperImageAlt
hash_s = content.index("\n// \u2500\u2500 Deterministic per-paper unique diagram")
hash_e = content.index("\n// \u2500\u2500 PDF.js thumbnail rendering", hash_s)
content = content[:hash_s] + content[hash_e:]

# 9. Remove paperKeywords constant (keep _termWikiArticle and extractPaperKeywords)
pk_s = content.index("\n// \u2500\u2500 Wikipedia keyword images")
pk_e = content.index("\n// Ordered term\u2192article pairs", pk_s)
content = content[:pk_s] + content[pk_e:]

# 10. Remove paperKeywords lookup line from extractPaperKeywords
content = content.replace(
    "  if (paperKeywords[paper.id]) return paperKeywords[paper.id];\n",
    "",
    1
)

with open("app.js", "w", encoding="utf-8") as f:
    f.write(content)
print(f"Done. {orig_len:,} -> {len(content):,} chars (removed {orig_len - len(content):,})")