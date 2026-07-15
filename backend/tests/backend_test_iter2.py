"""Iteration 2 tests: retrieval status, rescore, jobs persistence, compare, scorecard."""
import json
import os
import time
from urllib.parse import urlparse

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

from conftest import login

# load backend .env to reach mongo
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    login(s, "iter2")
    return s


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


# --- Health with retrieval status ---
def test_health_has_retrieval(client):
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    j = r.json()
    assert "retrieval" in j
    assert set(j["retrieval"].keys()) >= {"embedder", "reranker"}
    assert j["retrieval"]["embedder"] in ("ready", "not_loaded", "failed")


# --- Ensure samples ingested ---
def test_ensure_samples(client):
    r = client.post(f"{API}/ingest/samples")
    assert r.status_code == 200


# --- Generate a new report (needed for pipeline retrieval event + jobs collection) ---
@pytest.fixture(scope="module")
def new_job(client):
    r = client.post(f"{API}/reports/generate",
                    json={"ticker": "AAPL", "query": "Summarize revenue and margins"})
    assert r.status_code == 200, r.text
    return r.json()["job_id"]


def test_jobs_collection_has_entry(client, mongo, new_job):
    # give it a moment for the insert
    time.sleep(1)
    doc = mongo.jobs.find_one({"id": new_job})
    assert doc is not None
    assert doc["status"] in ("queued", "running", "completed")
    assert "events" in doc


def test_pipeline_completes_with_hybrid_retriever(client, new_job):
    """Consume SSE and check for retriever event with bm25+dense+cross-encoder."""
    retriever_msgs = []
    got_final = False
    with client.get(f"{API}/reports/{new_job}/stream", stream=True, timeout=240) as r:
        assert r.status_code == 200
        start = time.time()
        for raw in r.iter_lines(decode_unicode=True):
            if time.time() - start > 240:
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
                if ev.get("node") == "retriever":
                    msg = ev.get("message", "")
                    retriever_msgs.append(msg)
                if ev.get("node") == "final":
                    got_final = True
    assert got_final, "no final event"
    assert retriever_msgs, "no retriever events"
    joined = " | ".join(retriever_msgs)
    assert "bm25+dense+cross-encoder" in joined, f"retriever stages missing: {joined}"


def test_health_retrieval_ready_after_pipeline(client):
    r = client.get(f"{API}/health")
    j = r.json()
    assert j["retrieval"]["embedder"] == "ready"
    assert j["retrieval"]["reranker"] == "ready"


def test_jobs_completed(mongo, new_job):
    doc = mongo.jobs.find_one({"id": new_job})
    assert doc is not None
    assert doc["status"] == "completed"
    assert isinstance(doc.get("events"), list) and len(doc["events"]) > 0


def test_get_report_has_scorecard(client, new_job):
    r = client.get(f"{API}/reports/{new_job}")
    assert r.status_code == 200
    rep = r.json()["report"]
    sc = rep.get("scorecard")
    assert sc is not None
    for k in ("faithfulness", "context_precision", "answer_relevance", "overall",
              "cited_sources", "n_claims", "n_supported"):
        assert k in sc, f"missing scorecard key: {k}"


# --- Rescore ---
def test_rescore_reports(client):
    r = client.post(f"{API}/reports/rescore")
    assert r.status_code == 200
    j = r.json()
    assert "updated" in j
    assert isinstance(j["updated"], int) and j["updated"] >= 1


# --- Compare ---
@pytest.fixture(scope="module")
def two_report_ids(client):
    r = client.get(f"{API}/reports")
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()["reports"]]
    assert len(ids) >= 2, "need at least 2 reports"
    return ids[:2]


def test_compare_ok(client, two_report_ids):
    r = client.post(f"{API}/reports/compare", json={"report_ids": two_report_ids})
    assert r.status_code == 200, r.text
    reports = r.json()["reports"]
    assert len(reports) == 2
    # order preserved
    assert [x["id"] for x in reports] == two_report_ids
    # scorecard included
    assert "scorecard" in reports[0]


def test_compare_one_valid_returns_422_or_404(client, two_report_ids):
    # Only 1 id -> min_length=2 -> Pydantic 422
    r = client.post(f"{API}/reports/compare", json={"report_ids": [two_report_ids[0]]})
    assert r.status_code == 422


def test_compare_one_valid_one_invalid_returns_404(client, two_report_ids):
    # 2 ids passes validation, but only 1 exists -> 404
    r = client.post(f"{API}/reports/compare",
                    json={"report_ids": [two_report_ids[0], "does-not-exist-xxxx"]})
    assert r.status_code == 404


def test_compare_five_ids_returns_422(client, two_report_ids):
    ids = two_report_ids + ["a", "b", "c"]  # 5 total
    r = client.post(f"{API}/reports/compare", json={"report_ids": ids})
    assert r.status_code == 422
