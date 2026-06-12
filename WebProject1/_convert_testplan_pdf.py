"""Convert TEST-PLAN.md to a styled PDF for independent testers."""
import os, markdown
from xhtml2pdf import pisa

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MD_PATH = os.path.join(SCRIPT_DIR, "TEST-PLAN.md")
PDF_PATH = os.path.join(SCRIPT_DIR, "TEST-PLAN.pdf")

CSS = """
@page { size: A4; margin: 2cm 1.8cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #1a1a1a; line-height: 1.45; }
h1 { font-size: 22px; color: #132028; border-bottom: 2px solid #1f6b54; padding-bottom: 6px; margin-top: 28px; }
h2 { font-size: 16px; color: #205ea6; margin-top: 22px; border-bottom: 1px solid #c8d2cf; padding-bottom: 4px; }
h3 { font-size: 13px; color: #9e2f2f; margin-top: 14px; }
h4 { font-size: 11px; margin-top: 10px; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 14px 0; font-size: 9px; }
th { background: #eef2f8; color: #132028; padding: 5px 6px; border: 1px solid #c8d2cf; text-align: left; font-weight: bold; }
td { padding: 4px 6px; border: 1px solid #c8d2cf; vertical-align: top; }
tr:nth-child(even) td { background: #f9fafb; }
code { font-family: "Courier New", monospace; font-size: 9px; background: #eef2f8; padding: 1px 3px; }
pre { background: #eef2f8; padding: 8px; font-size: 8.5px; border: 1px solid #c8d2cf; overflow: hidden; }
blockquote { border-left: 3px solid #c66b2f; margin: 8px 0; padding: 4px 10px; color: #4a5d66; font-style: italic; }
hr { border: none; border-top: 1px solid #c8d2cf; margin: 16px 0; }
ul, ol { margin: 4px 0; padding-left: 20px; }
li { margin-bottom: 2px; }
strong { color: #132028; }
a { color: #205ea6; text-decoration: none; }
.toc { background: #f4f6f2; border: 1px solid #c8d2cf; padding: 10px 14px; margin: 10px 0 18px 0; }
.footer { font-size: 8px; color: #4a5d66; text-align: center; margin-top: 20px; }
"""

with open(MD_PATH, encoding="utf-8") as f:
    md_text = f.read()

html_body = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "toc", "nl2br"],
    output_format="html5",
)

html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>{CSS}</style>
</head><body>
{html_body}
<div class="footer">AI Architecture Papers Portal — Test Plan — Generated 2026-06-12</div>
</body></html>"""

with open(PDF_PATH, "wb") as out:
    status = pisa.CreatePDF(html, dest=out)

if status.err:
    print(f"ERROR: PDF conversion failed with {status.err} errors")
else:
    size_kb = os.path.getsize(PDF_PATH) / 1024
    print(f"OK: {PDF_PATH} ({size_kb:.0f} KB)")
