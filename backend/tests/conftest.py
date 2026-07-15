"""Shared test-suite login helper.

Phase 4 put a login wall in front of every tool endpoint, so each live-HTTP
test module needs an authenticated `requests.Session()`. Session cookies are
Secure=True (see auth plan) and `requests` — unlike a browser — won't resend
a Secure cookie over plain http://, so we re-store the token as a non-secure
cookie in the session jar. Test-harness workaround for local dev over http,
not a product gap (mirrors the manual-cookie approach in test_auth.py).
"""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agents.auth import COOKIE_NAME  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def login(session, email_prefix="suite"):
    """Register a fresh user on `session` so subsequent calls carry a valid
    session cookie. Returns `session` for chaining."""
    creds = {
        "email": f"{email_prefix}+{uuid.uuid4().hex[:12]}@example.com",
        "password": "correct-horse-battery",
    }
    r = session.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200, r.text
    token = r.cookies.get(COOKIE_NAME)
    assert token
    session.cookies.set(COOKIE_NAME, token)
    return session
