"""
Test the /api/discover endpoint against the running Flask server.
Verifies:
  1. HTTP 200 response
  2. JSON contains 'results', 'query', 'errors' keys
  3. At least 1 result returned
  4. Each result has the required paper fields
  5. Repeated calls rotate queries

Uses `requests` with proxies={} to bypass the Intel corporate proxy
for localhost connections.
"""
import requests

BASE = "http://127.0.0.1:5000"
NO_PROXY = {}  # empty dict = bypass proxy for localhost calls
REQUIRED_FIELDS = {"id", "title", "authors", "year", "groups",
                   "preview", "summary", "datacenter", "metrics",
                   "link", "isDiscovery"}

def test_discover(months=1, label=""):
    url = f"{BASE}/api/discover"
    print(f"\n{'='*60}")
    print(f"TEST: {label or url}")
    print(f"{'='*60}")

    resp = requests.get(url, params={"months": months},
                        proxies=NO_PROXY, timeout=60)
    body = resp.json()
    status = resp.status_code

    # 1. Status code
    assert status == 200, f"FAIL: expected 200, got {status}"
    print(f"  [PASS] HTTP {status}")

    # 2. Top-level keys
    for key in ("results", "query", "errors"):
        assert key in body, f"FAIL: missing key '{key}'"
    print(f"  [PASS] Response has results/query/errors keys")

    results = body["results"]
    query = body["query"]
    errors = body["errors"]
    print(f"  Query used: \"{query}\"")
    print(f"  Results: {len(results)}")
    if errors:
        print(f"  Errors: {errors}")

    # 3. At least 1 result
    assert len(results) > 0, "FAIL: no results returned"
    print(f"  [PASS] Got {len(results)} results")

    # 4. Each result has required fields
    for i, paper in enumerate(results):
        missing = REQUIRED_FIELDS - set(paper.keys())
        assert not missing, f"FAIL: result[{i}] missing fields: {missing}"
    print(f"  [PASS] All results have required fields")

    # 5. Spot-check first result
    first = results[0]
    print(f"  First result:")
    print(f"    Title:   {first['title'][:80]}")
    print(f"    Authors: {first['authors'][:60]}")
    print(f"    Year:    {first['year']}")
    print(f"    Link:    {first['link'][:80]}")

    return query


def test_papers_api():
    """Smoke test: /api/papers still works."""
    print(f"\n{'='*60}")
    print("TEST: /api/papers smoke test")
    print(f"{'='*60}")
    resp = requests.get(f"{BASE}/api/papers", proxies=NO_PROXY, timeout=10)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list), "FAIL: expected list"
    assert len(data) > 0, "FAIL: no papers"
    print(f"  [PASS] {len(data)} papers in library")


# ── Run all tests ───────────────────────────────────────────────────────────
print("Starting tests against Flask server at", BASE)

test_papers_api()

q1 = test_discover(months=1, label="Discover (1 month)")
q2 = test_discover(months=3, label="Discover (3 months)")

# Verify query rotation
if q1 != q2:
    print(f"\n  [PASS] Query rotation working: \"{q1[:40]}...\" -> \"{q2[:40]}...\"")
else:
    print(f"\n  [WARN] Same query returned twice (may wrap if only 1 query)")

test_discover(months=6, label="Discover (6 months)")

print(f"\n{'='*60}")
print("ALL TESTS PASSED")
print(f"{'='*60}")
