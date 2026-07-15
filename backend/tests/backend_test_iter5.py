"""Iteration 5 tests: GET /api/companies/trending, DELETE /api/reports/{id}, guidance in reports."""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

from conftest import login

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    return login(requests.Session(), "iter5")


# --- Trending endpoint ---
def test_trending_default(client):
    r = client.get(f"{API}/companies/trending")
    assert r.status_code == 200, r.text
    j = r.json()
    assert "trending" in j
    trending = j["trending"]
    assert isinstance(trending, list)
    assert len(trending) >= 1
    for row in trending:
        assert "ticker" in row and "name" in row and "count" in row
        assert isinstance(row["count"], int)
    # sorted desc by count
    counts = [r["count"] for r in trending]
    assert counts == sorted(counts, reverse=True), f"not sorted desc: {counts}"


def test_trending_padded_to_limit(client):
    r = client.get(f"{API}/companies/trending", params={"limit": 8})
    assert r.status_code == 200
    trending = r.json()["trending"]
    # Should pad up to 8 with popular US tickers
    assert len(trending) == 8, f"expected 8, got {len(trending)}: {trending}"


def test_trending_limit_param(client):
    r = client.get(f"{API}/companies/trending", params={"limit": 3})
    assert r.status_code == 200
    trending = r.json()["trending"]
    assert len(trending) <= 3


# --- DELETE report endpoint ---
def test_delete_nonexistent_returns_404(client):
    r = client.delete(f"{API}/reports/nonexistent-id-xyz-12345")
    assert r.status_code == 404
    assert "detail" in r.json()


def test_delete_report_and_verify_removal(client):
    # Phase 4: GET /reports now scopes to the caller's own reports + curated
    # public samples — deleting from that list could hit a shared sample, so
    # generate + wait for a throwaway report of our own to delete instead.
    r = client.post(f"{API}/reports/generate",
                     json={"ticker": "AAPL", "query": "Delete-test filler question", "no_cache": True})
    assert r.status_code == 200, r.text
    rid = r.json()["job_id"]
    deadline = time.time() + 300
    while time.time() < deadline:
        rr = client.get(f"{API}/reports/{rid}")
        if rr.status_code == 200 and rr.json().get("status") == "completed":
            break
        time.sleep(3)
    else:
        raise TimeoutError(f"report {rid} did not complete in time")

    # DELETE
    d = client.delete(f"{API}/reports/{rid}")
    assert d.status_code == 200, d.text
    assert d.json() == {"deleted": rid}

    # Verify GET now 404
    g = client.get(f"{API}/reports/{rid}")
    assert g.status_code == 404, f"expected 404 after delete, got {g.status_code}: {g.text}"


# --- Guidance in report data (backend side of bugfix) ---
def test_nvda_report_contains_financials_guidance(client):
    lst = client.get(f"{API}/reports", params={"ticker": "NVDA", "limit": 20}).json()["reports"]
    if not lst:
        pytest.skip("No NVDA reports in DB")
    # find one completed with financials.guidance
    found = None
    for row in lst:
        full = client.get(f"{API}/reports/{row['id']}").json()
        fin = (full.get("financials") or {})
        if fin.get("guidance"):
            found = full
            break
    if not found:
        pytest.skip("No NVDA report with guidance field")
    assert isinstance(found["financials"]["guidance"], str)
    assert len(found["financials"]["guidance"]) > 0
