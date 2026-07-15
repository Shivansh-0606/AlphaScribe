"""Iteration 3 tests: /api/companies, /api/ingest/audio, warmup, report.company_name."""
import io
import os
import struct
import time
import wave

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
    login(s, "iter3")
    return s


# --- Ensure samples seeded and companies mapping present ---
def test_ensure_samples(client):
    r = client.post(f"{API}/ingest/samples")
    assert r.status_code == 200


def test_companies_returns_mapping(client):
    r = client.get(f"{API}/companies")
    assert r.status_code == 200
    j = r.json()
    assert "companies" in j
    comps = j["companies"]
    # samples should have populated AAPL/MSFT/NVDA
    assert comps.get("AAPL") == "Apple Inc.", comps
    assert comps.get("MSFT") == "Microsoft Corporation", comps
    assert comps.get("NVDA") == "NVIDIA Corporation", comps


# --- ingest/text accepts company_name and persists to db.companies ---
def test_ingest_text_persists_company_name(client):
    body = {
        "ticker": "TSTC",
        "source": "Iter3 test filing",
        "text": "This is a test filing for TestCo. Revenue grew 10% year over year.",
        "company_name": "TestCo Inc.",
    }
    r = client.post(f"{API}/ingest/text", json=body)
    assert r.status_code == 200, r.text
    r2 = client.get(f"{API}/companies")
    assert r2.status_code == 200
    comps = r2.json()["companies"]
    assert comps.get("TSTC") == "TestCo Inc.", comps


# --- ingest/audio validation ---
def test_audio_rejects_bad_extension(client):
    files = {"file": ("hello.txt", b"not audio", "text/plain")}
    data = {"ticker": "AAPL"}
    r = client.post(f"{API}/ingest/audio", files=files, data=data)
    assert r.status_code == 400
    assert "Unsupported" in r.text


def test_audio_rejects_empty(client):
    files = {"file": ("silent.wav", b"", "audio/wav")}
    data = {"ticker": "AAPL"}
    r = client.post(f"{API}/ingest/audio", files=files, data=data)
    assert r.status_code == 400


def test_audio_rejects_oversized(client):
    # 26MB of zeros; use a valid extension so extension check passes
    big = b"\x00" * (26 * 1024 * 1024)
    files = {"file": ("big.wav", big, "audio/wav")}
    data = {"ticker": "AAPL"}
    r = client.post(f"{API}/ingest/audio", files=files, data=data)
    assert r.status_code == 400
    assert "25MB" in r.text or "exceeds" in r.text


def _make_silent_wav(duration_sec: float = 1.0, rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * int(rate * duration_sec))
    return buf.getvalue()


def test_audio_transcribe_endpoint_reachable(client):
    """Send a real WAV. Whisper may return empty transcript on silence -> 422;
    or transcription may succeed -> 200. Either indicates endpoint works."""
    wav = _make_silent_wav(1.0)
    files = {"file": ("silence.wav", wav, "audio/wav")}
    data = {"ticker": "TSTA", "company_name": "Silent Test Co", "language": "en"}
    r = client.post(f"{API}/ingest/audio", files=files, data=data, timeout=60)
    # Acceptable outcomes: 200 (transcribed), 422 (empty transcript), 502 (whisper error on empty audio)
    assert r.status_code in (200, 422, 502), f"unexpected status {r.status_code}: {r.text[:400]}"
    if r.status_code == 200:
        j = r.json()
        assert "num_chunks" in j
        assert "transcript_chars" in j
        assert "transcript_preview" in j


# --- Warmup: retrieval status should be ready (backend has been up a while) ---
def test_warmup_retrieval_ready(client):
    r = client.get(f"{API}/health")
    j = r.json()
    assert j["retrieval"]["embedder"] == "ready", j["retrieval"]
    assert j["retrieval"]["reranker"] == "ready", j["retrieval"]


# --- Generated report includes company_name field ---
def test_generate_report_has_company_name(client):
    r = client.post(f"{API}/reports/generate",
                    json={"ticker": "AAPL", "query": "Company name attach test"})
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]

    # poll for completion (models are warm, ~30-60s)
    deadline = time.time() + 180
    report = None
    while time.time() < deadline:
        rr = client.get(f"{API}/reports/{job_id}")
        if rr.status_code == 200 and rr.json().get("status") == "completed":
            report = rr.json()["report"]
            break
        time.sleep(3)
    assert report is not None, "report did not complete in time"
    assert report.get("company_name") == "Apple Inc.", report.get("company_name")
