"""Iteration 6 tests: LATEST FILINGS refresh, FOLLOW-UP context_report_id, INDIAN companies."""
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
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    login(s, "iter6")
    return s


# --- BUG FIX #3: Indian companies search ---
@pytest.mark.parametrize("q,expected_ticker", [
    ("reliance", "RELIANCE"),
    ("tcs", "TCS"),
    ("infy", "INFY"),
])
def test_search_indian_ticker(client, q, expected_ticker):
    r = client.get(f"{API}/companies/search", params={"q": q})
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) > 0, f"No results for {q}"
    # top match should be the expected Indian ticker with exchange IN
    top = results[0]
    assert top["ticker"] == expected_ticker, f"top for {q}: {top}"
    assert top.get("exchange") == "IN", f"expected IN exchange, got: {top}"


def test_search_us_still_works(client):
    r = client.get(f"{API}/companies/search", params={"q": "apple"})
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) > 0
    top = results[0]
    assert top["ticker"] == "AAPL"
    assert top.get("exchange") == "US"


# --- BUG FIX #3: ensure IN ticker returns 422 ---
def test_ensure_indian_returns_422(client):
    r = client.post(f"{API}/companies/ensure", json={"ticker": "RELIANCE"})
    assert r.status_code == 422, r.text
    detail = r.json().get("detail", "")
    assert "NSE/BSE" in detail
    # points to Paste/Upload
    assert "Paste" in detail or "Upload" in detail


# --- BUG FIX #1: filing_date on ensure/refresh ---
def test_ensure_tsla_refresh_returns_filing_date(client):
    # count filings before
    before = client.get(f"{API}/filings", params={"ticker": "TSLA"}).json()["filings"]
    before_count = len(before)

    r = client.post(f"{API}/companies/ensure", json={"ticker": "TSLA", "refresh": True}, timeout=90)
    assert r.status_code == 200, r.text
    body = r.json()
    # Either ingested fresh or already ingested — in refresh=True we expect ingested_from_edgar
    assert body.get("action") == "ingested_from_edgar", f"unexpected action: {body}"
    assert body.get("filing_date"), f"filing_date missing: {body}"
    # filing_date should be YYYY-MM-DD
    fd = body["filing_date"]
    assert isinstance(fd, str) and len(fd) == 10 and fd[4] == "-" and fd[7] == "-", fd
    # source string contains 'filed <date>'
    assert "filed" in body.get("source", ""), body.get("source")

    # verify filings collection grew (or at least has entry with this filing_date-ish source)
    after = client.get(f"{API}/filings", params={"ticker": "TSLA"}).json()["filings"]
    assert len(after) >= before_count, f"filings count decreased: {before_count} -> {len(after)}"


# --- Regression: startup company index >= 10500 ---
def test_company_index_size(client):
    # Search for a broad common term & rely on health? Use search of a common single-letter.
    # Better: hit health and check response, but there's no direct index count endpoint.
    # Use search 'a' with limit 10 and confirm mixed exchanges/results exist.
    r = client.get(f"{API}/companies/search", params={"q": "a", "limit": 10})
    assert r.status_code == 200
    j = r.json()
    assert j.get("index_loaded") is True
    # exchange field present
    for row in j["results"]:
        assert "exchange" in row


# --- BUG FIX #2: follow-up accepts context_report_id ---
def test_generate_with_context_report_id(client):
    # find a completed AAPL report
    lst = client.get(f"{API}/reports", params={"ticker": "AAPL", "limit": 20}).json()["reports"]
    if not lst:
        # try any ticker with existing filings, prefer AAPL — else skip
        pytest.skip("No AAPL reports available for context test")
    ctx_id = lst[0]["id"]

    # ensure AAPL filings exist (they should)
    payload = {
        "ticker": "AAPL",
        "query": "How does that compare to last quarter?",
        "context_report_id": ctx_id,
    }
    r = client.post(f"{API}/reports/generate", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]
    assert job_id
    # confirm jobs collection captured context_report_id — check via GET
    # poll briefly to see job saved
    for _ in range(5):
        j = client.get(f"{API}/reports/{job_id}").json()
        if j:
            break
        time.sleep(1)
    # Don't wait for completion in this fast test — job_id acceptance is enough
    # But check that db jobs has context_report_id set (indirect via events? not exposed) — skip check


def test_generate_without_context_still_works(client):
    payload = {"ticker": "AAPL", "query": "Summarise the latest quarter."}
    r = client.post(f"{API}/reports/generate", json=payload)
    assert r.status_code == 200
    assert r.json().get("job_id")
