"""Quick test: can we reach OpenAlex through the Intel proxy?"""
import os
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1")
os.environ.setdefault("no_proxy", "localhost,127.0.0.1")

import requests, json

proxies = {"http": "http://proxy-dmz.intel.com:912",
           "https": "http://proxy-dmz.intel.com:912"}

r = requests.get(
    "https://api.openalex.org/works",
    params={
        "search": "LLM transformer architecture",
        "sort": "publication_date:desc",
        "filter": "publication_date:>2026-02-01",
        "per-page": "3",
    },
    proxies=proxies,
    headers={"Accept": "application/json"},
    timeout=15,
)
print("Status:", r.status_code)
data = r.json()
results = data.get("results", [])
print("Count:", len(results))
for x in results:
    title = x.get("title", "?")
    pub = x.get("publication_date", "?")
    print(f"  - [{pub}] {title[:90]}")
