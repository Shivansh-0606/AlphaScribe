"""AlphaScribe backend end-to-end pytest suite."""
import json
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Health & seed ----------
def test_health(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["llm_key_configured"] is True


def test_ingest_samples(client):
    r = client.post(f"{API}/ingest/samples")
    assert r.status_code == 200
    j = r.json()
    assert "ingested" in j
    assert j["total_samples"] >= 4


def test_tickers(client):
    r = client.get(f"{API}/tickers")
    assert r.status_code == 200
    tks = r.json()["tickers"]
    for t in ("AAPL", "MSFT", "NVDA"):
        assert t in tks, f"missing {t} in {tks}"


def test_filings(client):
    r = client.get(f"{API}/filings")
    assert r.status_code == 200
    filings = r.json()["filings"]
    assert len(filings) >= 3
    for f in filings:
        assert "ticker" in f and "source" in f and "num_chunks" in f


# ---------- Ingest text ----------
def test_ingest_text_empty_400(client):
    r = client.post(f"{API}/ingest/text", json={"ticker": "TEST", "source": "TEST_src", "text": "  "})
    assert r.status_code == 400


def test_ingest_text_ok(client):
    payload = {"ticker": "TEST_TICK", "source": "TEST_source_1",
               "text": "Revenue was $10M in Q3 2024. Operating income grew 15%. Gross margin was 45%."}
    r = client.post(f"{API}/ingest/text", json=payload)
    assert r.status_code == 200
    j = r.json()
    assert j.get("ticker") == "TEST_TICK"
    assert j.get("num_chunks", 0) >= 1


# ---------- Reports ----------
def test_generate_no_data_400(client):
    r = client.post(f"{API}/reports/generate", json={"ticker": "ZZZZ_NONE", "query": "hi"})
    assert r.status_code == 400


@pytest.fixture(scope="module")
def job_id(client):
    r = client.post(f"{API}/reports/generate",
                    json={"ticker": "AAPL", "query": "Summarize the latest quarter"})
    assert r.status_code == 200, r.text
    jid = r.json()["job_id"]
    assert jid
    return jid


def test_sse_stream(client, job_id):
    """Consume SSE stream and verify pipeline node events."""
    seen_nodes = set()
    got_final = False
    with client.get(f"{API}/reports/{job_id}/stream", stream=True, timeout=180) as r:
        assert r.status_code == 200
        start = time.time()
        for raw in r.iter_lines(decode_unicode=True):
            if time.time() - start > 180:
                break
            if not raw:
                continue
            if raw.startswith("event: end"):
                break
            if raw.startswith("data:"):
                payload = raw[5:].strip()
                if not payload or payload == "{}":
                    continue
                try:
                    ev = json.loads(payload)
                except Exception:
                    continue
                node = ev.get("node")
                if node:
                    seen_nodes.add(node)
                if node == "final":
                    got_final = True
                if ev.get("node") == "pipeline" and ev.get("status") in ("ok", "error"):
                    # let stream close naturally
                    pass
    # required nodes
    for n in ("pipeline", "retriever", "extractor", "tone", "synthesizer", "fact_checker"):
        assert n in seen_nodes, f"missing node event: {n}. Seen: {seen_nodes}"
    assert got_final, f"no final event; seen={seen_nodes}"


def test_get_report(client, job_id):
    r = client.get(f"{API}/reports/{job_id}")
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "completed"
    rep = j["report"]
    assert rep["draft_report"] and len(rep["draft_report"]) > 50
    assert isinstance(rep["extracted_data"], dict)
    sa = rep["sentiment_analysis"]
    assert isinstance(sa, dict)
    for k in ("sentiment", "confidence", "key_risks", "key_positives"):
        assert k in sa, f"missing sentiment key: {k}"
    assert isinstance(rep["source_documents"], list) and len(rep["source_documents"]) > 0
    assert "score" in rep["source_documents"][0]
    assert isinstance(rep["fact_check_status"], bool)
    assert isinstance(rep["verified_claims"], list)
    assert isinstance(rep["retry_count"], int)


def test_list_reports_contains_job(client, job_id):
    r = client.get(f"{API}/reports")
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()["reports"]]
    assert job_id in ids
