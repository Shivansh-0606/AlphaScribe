"""Phase 6 hardening: OTP password reset + login/OTP rate limiting.
Live HTTP tests against a running server (see test_auth.py for the
Secure-cookie-over-http rationale).

The OTP is stored hashed (agents/auth.create_password_reset never returns it
to an HTTP caller), so these tests recover it the same way an attacker with
DB read access would have to: brute-forcing the 6-digit space against the
stored HMAC (agents.auth._hash_otp — an HMAC pepper, not a bare hash, is the
whole point after the security review below, so this brute force only works
if OTP_PEPPER is unset or identical in the test process and the server
process; both default to the same hardcoded dev value when unset, matching
this suite's existing MONGO_URL/DB_NAME-must-match convention). Brute-forcing
1e6 values is still instant and, unlike a test-only backdoor, exercises the
real hash function — incidentally demonstrating why the OTP endpoint needs
its own rate limit rather than relying on hash secrecy alone.

    python -m pytest backend/tests/test_password_reset.py
"""
import os
import sys
import uuid

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agents.auth import COOKIE_NAME, _hash_otp

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def resets_collection():
    client = MongoClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]].password_resets


def _register() -> dict:
    creds = {"email": f"pwreset+{uuid.uuid4().hex[:12]}@example.com", "password": "correct-horse-battery"}
    r = requests.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200, r.text
    return creds


def _recover_otp(resets_collection, email: str) -> str:
    record = resets_collection.find_one({"email": email, "used": False}, sort=[("created_at", -1)])
    assert record, "no pending reset record for this email"
    target = record["otp_hash"]
    for i in range(1_000_000):
        candidate = f"{i:06d}"
        if _hash_otp(candidate) == target:
            return candidate
    raise AssertionError("could not recover OTP from hash")


def test_forgot_password_unknown_email_same_response():
    r = requests.post(f"{API}/auth/forgot-password", json={"email": "no-such-user@example.com"})
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}


def test_forgot_password_known_email_same_response(resets_collection):
    creds = _register()
    r = requests.post(f"{API}/auth/forgot-password", json={"email": creds["email"]})
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}
    assert resets_collection.find_one({"email": creds["email"]}) is not None


def test_reset_flow_end_to_end(resets_collection):
    creds = _register()
    r = requests.post(f"{API}/auth/login", json=creds)
    old_token = r.cookies.get(COOKIE_NAME)
    assert old_token

    requests.post(f"{API}/auth/forgot-password", json={"email": creds["email"]})
    otp = _recover_otp(resets_collection, creds["email"])

    r = requests.post(f"{API}/auth/reset-password", json={
        "email": creds["email"], "otp": otp, "new_password": "brand-new-password-789",
    })
    assert r.status_code == 200, r.text

    # old password no longer works; new one does
    assert requests.post(f"{API}/auth/login", json=creds).status_code == 401
    assert requests.post(f"{API}/auth/login", json={**creds, "password": "brand-new-password-789"}).status_code == 200
    # resetting invalidates every existing session
    assert requests.get(f"{API}/auth/me", cookies={COOKIE_NAME: old_token}).status_code == 401


def test_reset_password_wrong_otp_rejected(resets_collection):
    creds = _register()
    requests.post(f"{API}/auth/forgot-password", json={"email": creds["email"]})
    r = requests.post(f"{API}/auth/reset-password", json={
        "email": creds["email"], "otp": "000000", "new_password": "irrelevant-password-1",
    })
    assert r.status_code in (400, 429), r.text


def test_reset_password_otp_is_single_use(resets_collection):
    creds = _register()
    requests.post(f"{API}/auth/forgot-password", json={"email": creds["email"]})
    otp = _recover_otp(resets_collection, creds["email"])

    r1 = requests.post(f"{API}/auth/reset-password", json={
        "email": creds["email"], "otp": otp, "new_password": "first-new-password-1",
    })
    assert r1.status_code == 200, r1.text

    r2 = requests.post(f"{API}/auth/reset-password", json={
        "email": creds["email"], "otp": otp, "new_password": "second-new-password-2",
    })
    assert r2.status_code in (400, 429), r2.text


def test_reset_password_rate_limited_after_repeated_failures():
    """5 wrong OTPs against one account lock out the 6th — keyed by email
    (fresh per test), so this is deterministic regardless of test order."""
    creds = _register()
    requests.post(f"{API}/auth/forgot-password", json={"email": creds["email"]})
    for _ in range(5):
        r = requests.post(f"{API}/auth/reset-password", json={
            "email": creds["email"], "otp": "000000", "new_password": "irrelevant-password-2",
        })
        assert r.status_code == 400, r.text
    r = requests.post(f"{API}/auth/reset-password", json={
        "email": creds["email"], "otp": "000000", "new_password": "irrelevant-password-2",
    })
    assert r.status_code == 429, r.text


def test_login_rate_limited_after_repeated_failures():
    """5 wrong passwords against one account lock out the 6th, including a
    subsequent CORRECT password — keyed by email (fresh per test)."""
    creds = _register()
    for _ in range(5):
        r = requests.post(f"{API}/auth/login", json={**creds, "password": "wrong-password"})
        assert r.status_code == 401, r.text
    assert requests.post(f"{API}/auth/login", json={**creds, "password": "wrong-password"}).status_code == 429
    assert requests.post(f"{API}/auth/login", json=creds).status_code == 429
