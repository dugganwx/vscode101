"""
_create_missing_sidecars.py
Finds PDFs in "AI papers for WebProject1" that have no JSON sidecar,
extracts text from each, and calls Azure OpenAI to generate the metadata JSON.
"""

import os
import json
import fitz  # PyMuPDF

FOLDER = os.path.join(os.path.dirname(__file__), "AI papers for WebProject1")
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "azure_openai_config.txt")
NO_PROXY = "localhost,127.0.0.1,*.intel.com,.openai.azure.com,10.*"
os.environ.setdefault("NO_PROXY", NO_PROXY)
os.environ.setdefault("no_proxy", NO_PROXY)

SYSTEM_PROMPT = """\
You are a research metadata extractor for an AI architecture papers portal.
Given the title (filename) and extracted text from the first pages of a research paper,
produce a JSON object with exactly these keys:

{
  "title":       "<clean title string>",
  "authors":     "<Author names, or 'Multiple Authors' if unclear>",
  "year":        <4-digit integer year>,
  "preview":     "<1-sentence plain-English description of what the paper does>",
  "summary":     "<2-3 sentence technical summary covering: what it proposes, key method, and main result>",
  "datacenter":  "<1-2 sentences on relevance to AI datacenter infrastructure (training, inference, networking, memory, or TCO)>",
  "metrics":     "<1 sentence starting 'Key result signal:' describing the most important quantitative or qualitative result>",
  "link":        "<arXiv URL or DOI URL if you are confident, otherwise empty string>",
  "citation_count": 0
}

Rules:
- Use only information present in the text. Do not invent results or URLs.
- If you cannot determine the year, use 2024.
- If the link is not evident from the text, use "".
- Return ONLY the JSON object, no markdown, no prose.
"""


def load_azure_config():
    cfg = {}
    with open(CONFIG_FILE) as f:
        for line in f:
            line = line.strip()
            if "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    return cfg


def extract_pdf_text(pdf_path, max_chars=4000):
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
        if len(text) >= max_chars:
            break
    doc.close()
    return text[:max_chars]


def generate_metadata(filename_stem, pdf_text, client, deployment):
    user_content = f"Filename: {filename_stem}\n\nExtracted text (first pages):\n{pdf_text}"
    completion = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_content},
        ],
        max_tokens=600,
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    raw = (completion.choices[0].message.content or "").strip()
    return json.loads(raw)


def main():
    cfg = load_azure_config()
    endpoint   = cfg["endpoint"]
    api_key    = cfg["api_key"]
    deployment = cfg.get("deployment", "gpt-4o")
    api_version = cfg.get("api_version", "2025-01-01-preview")

    from openai import AzureOpenAI
    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version=api_version,
    )

    # Find PDFs without JSON sidecars
    all_files = os.listdir(FOLDER)
    pdfs  = {os.path.splitext(f)[0] for f in all_files if f.lower().endswith(".pdf")}
    jsons = {os.path.splitext(f)[0] for f in all_files if f.lower().endswith(".json")}
    missing = sorted(pdfs - jsons)

    if not missing:
        print("All PDFs already have JSON sidecars.")
        return

    print(f"Found {len(missing)} PDF(s) without JSON sidecars:")
    for m in missing:
        print(f"  - {m}.pdf")
    print()

    for stem in missing:
        pdf_path  = os.path.join(FOLDER, stem + ".pdf")
        json_path = os.path.join(FOLDER, stem + ".json")

        print(f"Processing: {stem}.pdf")
        try:
            text = extract_pdf_text(pdf_path)
            print(f"  Extracted {len(text)} chars of text")
        except Exception as e:
            print(f"  ERROR reading PDF: {e}")
            continue

        try:
            metadata = generate_metadata(stem, text, client, deployment)
        except Exception as e:
            print(f"  ERROR calling Azure OpenAI: {e}")
            continue

        # Ensure citation_count is always present
        metadata.setdefault("citation_count", 0)

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        print(f"  Written: {stem}.json")
        print(f"  Title: {metadata.get('title')}")
        print(f"  Authors: {metadata.get('authors')} | Year: {metadata.get('year')}")
        print()

    print("Done.")


if __name__ == "__main__":
    main()
