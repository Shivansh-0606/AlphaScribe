"""Phase 1 auth backend: live HTTP tests against a running server.

Cookies are set with Secure=True (required — see auth plan). Python's
`requests` library, unlike a browser, won't resend a Secure cookie over plain
http://, so these tests carry the session token explicitly instead of relying
on Session auto-cookie-jar behavior. A real deployment is HTTPS and browsers
special-case localhost, so this is a test-harness workaround, not a product gap.

    python -m pytest backend/tests/test_auth.py
"""
import os
import sys
import uuid

import pytest
import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agents.auth import COOKIE_NAME

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_email() -> str:
    return f"authtest+{uuid.uuid4().hex[:12]}@example.com"


@pytest.fixture(scope="module")
def creds():
    return {"email": _fresh_email(), "password": "correct-horse-battery"}


def test_register_then_me(creds):
    r = requests.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == creds["email"]
    assert "password" not in body and "password_hash" not in body
    token = r.cookies.get(COOKIE_NAME)
    assert token

    r = requests.get(f"{API}/auth/me", cookies={COOKIE_NAME: token})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == creds["email"]


def test_duplicate_register_conflicts(creds):
    r = requests.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 409, r.text


def test_wrong_password_rejected(creds):
    r = requests.post(f"{API}/auth/login", json={**creds, "password": "wrong-password"})
    assert r.status_code == 401, r.text


def test_login_then_logout_invalidates_session(creds):
    r = requests.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, r.text
    token = r.cookies.get(COOKIE_NAME)
    assert token
    assert requests.get(f"{API}/auth/me", cookies={COOKIE_NAME: token}).status_code == 200

    r = requests.post(f"{API}/auth/logout", cookies={COOKIE_NAME: token})
    assert r.status_code == 200, r.text
    assert requests.get(f"{API}/auth/me", cookies={COOKIE_NAME: token}).status_code == 401


def test_me_without_session_is_401():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_existing_endpoints_still_open():
    """Phase 1 is additive-only — no existing route should be gated yet."""
    r = requests.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True
