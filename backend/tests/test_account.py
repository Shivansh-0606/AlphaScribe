"""Phase 5 account actions: change password, log out everywhere, delete
account. Live HTTP tests against a running server (see test_auth.py for the
Secure-cookie-over-http rationale).

    python -m pytest backend/tests/test_account.py
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


def _register() -> dict:
    """Returns {"email", "password", "token", "id"} for a fresh user."""
    creds = {"email": f"accttest+{uuid.uuid4().hex[:12]}@example.com", "password": "correct-horse-battery"}
    r = requests.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200, r.text
    token = r.cookies.get(COOKIE_NAME)
    assert token
    return {**creds, "token": token, "id": r.json()["id"]}


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.cookies.get(COOKIE_NAME)
    assert token
    return token


def _me_status(token: str) -> int:
    return requests.get(f"{API}/auth/me", cookies={COOKIE_NAME: token}).status_code


def test_change_password_wrong_current_rejected():
    u = _register()
    r = requests.post(
        f"{API}/auth/password",
        json={"current_password": "not-it", "new_password": "new-password-123"},
        cookies={COOKIE_NAME: u["token"]},
    )
    assert r.status_code == 401, r.text


def test_change_password_updates_login_and_invalidates_other_sessions():
    u = _register()
    other_token = _login(u["email"], u["password"])  # a second device/session
    assert _me_status(other_token) == 200

    r = requests.post(
        f"{API}/auth/password",
        json={"current_password": u["password"], "new_password": "brand-new-password-456"},
        cookies={COOKIE_NAME: u["token"]},
    )
    assert r.status_code == 200, r.text

    # the session that made the change survives...
    assert _me_status(u["token"]) == 200
    # ...but every other session was signed out
    assert _me_status(other_token) == 401

    # old password no longer works; new one does
    assert requests.post(f"{API}/auth/login", json={"email": u["email"], "password": u["password"]}).status_code == 401
    assert requests.post(f"{API}/auth/login", json={"email": u["email"], "password": "brand-new-password-456"}).status_code == 200


def test_logout_everywhere_invalidates_all_sessions():
    u = _register()
    other_token = _login(u["email"], u["password"])
    assert _me_status(u["token"]) == 200
    assert _me_status(other_token) == 200

    r = requests.post(f"{API}/auth/logout-all", cookies={COOKIE_NAME: u["token"]})
    assert r.status_code == 200, r.text

    assert _me_status(u["token"]) == 401
    assert _me_status(other_token) == 401


def test_delete_account_wrong_email_confirmation_rejected():
    u = _register()
    r = requests.delete(
        f"{API}/auth/me", json={"email": "someone-else@example.com"}, cookies={COOKIE_NAME: u["token"]},
    )
    assert r.status_code == 400, r.text
    assert _me_status(u["token"]) == 200  # account untouched


def test_delete_account_removes_user_and_sessions():
    u = _register()
    r = requests.delete(
        f"{API}/auth/me", json={"email": u["email"]}, cookies={COOKIE_NAME: u["token"]},
    )
    assert r.status_code == 200, r.text

    assert _me_status(u["token"]) == 401
    # can no longer log in — the user record is gone
    assert requests.post(f"{API}/auth/login", json={"email": u["email"], "password": u["password"]}).status_code == 401


def test_delete_account_scopes_report_cascade():
    """delete-account must wipe only the caller's own reports — never another
    user's, and never a shared public sample (user_id: None). Reports are
    inserted directly (skipping the LLM pipeline) since this only exercises
    the deletion query's scoping, matching how test_reports_scoping.py's
    ownership tests are structured."""
    from pymongo import MongoClient

    client = MongoClient(os.environ["MONGO_URL"])
    reports = client[os.environ["DB_NAME"]].reports

    target = _register()
    other = _register()
    stamp = uuid.uuid4().hex[:8]
    own_id, other_id, sample_id = f"acct-del-own-{stamp}", f"acct-del-other-{stamp}", f"acct-del-sample-{stamp}"

    def _doc(rid, user_id, is_sample=False):
        return {"id": rid, "user_id": user_id, "is_sample": is_sample,
                "ticker": "TST", "query": "q", "created_at": "2026-01-01T00:00:00+00:00"}

    reports.insert_many([
        _doc(own_id, target["id"]),
        _doc(other_id, other["id"]),
        _doc(sample_id, None, is_sample=True),
    ])
    try:
        r = requests.delete(
            f"{API}/auth/me", json={"email": target["email"]}, cookies={COOKIE_NAME: target["token"]},
        )
        assert r.status_code == 200, r.text

        assert reports.find_one({"id": own_id}) is None
        assert reports.find_one({"id": other_id}) is not None
        assert reports.find_one({"id": sample_id}) is not None
    finally:
        reports.delete_many({"id": {"$in": [own_id, other_id, sample_id]}})


def test_anonymous_account_actions_rejected():
    assert requests.post(
        f"{API}/auth/password", json={"current_password": "x", "new_password": "y" * 8}
    ).status_code == 401
    assert requests.post(f"{API}/auth/logout-all").status_code == 401
    assert requests.delete(f"{API}/auth/me", json={"email": "a@b.com"}).status_code == 401
