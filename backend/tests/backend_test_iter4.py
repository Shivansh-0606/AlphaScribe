"""Iteration 4 tests: /api/companies/search + /api/companies/ensure + health."""
import os
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
    return login(requests.Session(), "iter4")


def test_search_apple(client):
    r = client.get(f"{API}/companies/search", params={"q": "apple"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert "results" in j
    results = j["results"]
    assert len(results) >= 1
    # each result has expected keys
    for row in results:
        assert "ticker" in row and "name" in row and "has_filings" in row
    # Apple Inc should show up (likely at top) and have has_filings True
    apple = next((r for r in results if r["ticker"] == "AAPL"), None)
    assert apple is not None, f"AAPL missing in results: {results}"
    assert apple["name"].lower().startswith("apple")
    assert apple["has_filings"] is True


def test_search_empty_query(client):
    r = client.get(f"{API}/companies/search", params={"q": ""})
    assert r.status_code == 200
    assert r.json().get("results") == []


def test_search_tsla(client):
    r = client.get(f"{API}/companies/search", params={"q": "tsla"})
    assert r.status_code == 200
    results = r.json()["results"]
    tsla = next((r for r in results if r["ticker"] == "TSLA"), None)
    assert tsla is not None, results
    assert "tesla" in tsla["name"].lower()
    assert isinstance(tsla["has_filings"], bool)


def test_ensure_already_ingested_aapl(client):
    r = client.post(f"{API}/companies/ensure", json={"ticker": "AAPL"})
    assert r.status_code == 200, r.text
    assert r.json().get("action") == "already_ingested"


def test_ensure_invalid_ticker(client):
    r = client.post(f"{API}/companies/ensure", json={"ticker": "ZZZZZZ"})
    assert r.status_code == 404
    assert "detail" in r.json()


def test_ensure_new_or_404(client):
    """Try a plausibly-valid but not-yet-ingested ticker.
    Both ingested_from_edgar(200) and 404 are acceptable."""
    r = client.post(f"{API}/companies/ensure", json={"ticker": "IBM"})
    assert r.status_code in (200, 404), r.text
    if r.status_code == 200:
        j = r.json()
        assert j.get("action") in ("ingested_from_edgar", "already_ingested")
        if j["action"] == "ingested_from_edgar":
            assert j.get("num_chunks", 0) > 0
    else:
        assert "detail" in r.json()


def test_health_retrieval_ready(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    j = r.json()
    assert j["retrieval"]["embedder"] == "ready", j["retrieval"]
    assert j["retrieval"]["reranker"] == "ready", j["retrieval"]
