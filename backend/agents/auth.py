"""Phase 1 auth backend: password hashing, session tokens, user lookup.

Zero new dependencies — stdlib hashlib.scrypt for password hashing (no
bcrypt/passlib) and secrets.token_urlsafe for opaque session tokens (no JWT).
Sessions are looked up by the SHA-256 hash of the token, so a DB leak can't be
replayed as a live cookie. Mirrors the rest of agents/: plain functions that
take `db` explicitly (see agents/ingest.py, agents/graph.py).
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from pymongo.errors import DuplicateKeyError

COOKIE_NAME = "as_session"

def is_admin(user: dict) -> bool:
    """Admin = email listed in ADMIN_EMAILS (comma-separated, set in .env).
    No role field/migration needed — matches this app's stdlib-only, no-DB-
    schema-change auth style. Used to gate the Custom LLM provider (and its
    local/private base_url escape hatch) to a trusted operator only."""
    admin_emails = {
        e.strip().lower()
        for e in os.environ.get("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }
    return (user or {}).get("email", "").lower() in admin_emails


SESSION_TTL_DEFAULT = timedelta(hours=24)   # "remember me" unchecked (server backstop)
SESSION_TTL_REMEMBER = timedelta(days=30)   # "remember me" checked
OTP_TTL = timedelta(minutes=10)

# scrypt cost params recommended by the stdlib docs for interactive logins.
_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2 ** 14, 8, 1

# Phase 6 hardening: brute-force guard shared by login and password-reset OTP
# verification (a 6-digit code is trivially guessable without this).
# ponytail: process-local dict — fine for the single-instance backend this
# app runs on; move to Mongo/Redis if it ever scales to multiple instances.
_RATE_LIMIT_WINDOW = timedelta(minutes=15)
_RATE_LIMIT_MAX = 5
_hits: dict[str, list[datetime]] = {}


def _recent_hits(key: str, now: datetime) -> list[datetime]:
    """Pruned hits for key, without storing an empty list back — every login/
    OTP request is keyed off caller-controlled email strings, so leaving a
    dict entry behind for every distinct value ever queried (even a single
    successful check) is an unbounded-memory DoS from disposable addresses."""
    return [t for t in _hits.get(key, []) if now - t < _RATE_LIMIT_WINDOW]


def is_rate_limited(key: str) -> bool:
    now = datetime.now(timezone.utc)
    hits = _recent_hits(key, now)
    if hits:
        _hits[key] = hits
    else:
        _hits.pop(key, None)
    return len(hits) >= _RATE_LIMIT_MAX


def record_hit(key: str) -> None:
    now = datetime.now(timezone.utc)
    hits = _recent_hits(key, now)
    hits.append(now)
    _hits[key] = hits


def clear_hits(key: str) -> None:
    _hits.pop(key, None)


def hash_password(password: str) -> tuple[str, str]:
    """Return (salt_hex, hash_hex)."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32,
    )
    return salt.hex(), digest.hex()


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    digest = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt_hex),
        n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=32,
    )
    return hmac.compare_digest(digest.hex(), hash_hex)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _hash_otp(otp: str) -> str:
    """HMAC, not plain SHA-256: a 6-digit OTP's 1e6-value space is trivially
    brute-forceable offline from a bare hash (unlike the 256-bit tokens
    _hash_token is for), so this needs a server-side secret an attacker with
    read-only DB access wouldn't also have."""
    pepper = os.environ.get("OTP_PEPPER", "dev-insecure-otp-pepper").encode()
    return hmac.new(pepper, otp.encode(), hashlib.sha256).hexdigest()


async def ensure_indexes(db) -> None:
    await db.users.create_index("email", unique=True)
    await db.sessions.create_index("token_hash", unique=True)
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.password_resets.create_index("email")
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)


async def create_user(db, email: str, password: str) -> dict:
    """Create a user with credits reserved for a future monetization phase.
    Raises ValueError('email_taken') on duplicate email."""
    email = email.strip().lower()
    salt_hex, hash_hex = hash_password(password)
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_salt": salt_hex,
        "password_hash": hash_hex,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "verified": False,
        "credits": 0,
    }
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError as e:
        raise ValueError("email_taken") from e
    return user


async def authenticate(db, email: str, password: str) -> Optional[dict]:
    user = await db.users.find_one({"email": email.strip().lower()})
    if not user or not verify_password(password, user["password_salt"], user["password_hash"]):
        return None
    return user


async def create_session(db, user_id: str, remember: bool) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    ttl = SESSION_TTL_REMEMBER if remember else SESSION_TTL_DEFAULT
    expires_at = datetime.now(timezone.utc) + ttl
    await db.sessions.insert_one({
        "token_hash": _hash_token(token),
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at,
    })
    return token, expires_at


async def delete_session(db, token: str) -> None:
    await db.sessions.delete_one({"token_hash": _hash_token(token)})


async def delete_other_sessions(db, user_id: str, keep_token: str) -> None:
    """Used on password change: sign out every other device, keep this one."""
    await db.sessions.delete_many(
        {"user_id": user_id, "token_hash": {"$ne": _hash_token(keep_token)}}
    )


async def delete_all_sessions(db, user_id: str) -> None:
    await db.sessions.delete_many({"user_id": user_id})


async def update_password(db, user_id: str, new_password: str) -> None:
    salt_hex, hash_hex = hash_password(new_password)
    await db.users.update_one(
        {"id": user_id}, {"$set": {"password_salt": salt_hex, "password_hash": hash_hex}}
    )


async def create_password_reset(db, email: str) -> str:
    """Generate a 6-digit OTP, store its hash (never the raw code), and return
    the raw OTP for the caller to email. Only call once the caller has
    confirmed the user exists — this function itself doesn't check."""
    otp = f"{secrets.randbelow(1_000_000):06d}"
    await db.password_resets.insert_one({
        "email": email.strip().lower(),
        "otp_hash": _hash_otp(otp),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": datetime.now(timezone.utc) + OTP_TTL,
        "used": False,
    })
    return otp


async def verify_password_reset(db, email: str, otp: str) -> bool:
    """Check the most recent unused, unexpired OTP for email. Marks it used
    on success so it can't be replayed."""
    email = email.strip().lower()
    record = await db.password_resets.find_one(
        {"email": email, "used": False}, sort=[("created_at", -1)]
    )
    if not record:
        return False
    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:  # motor returns naive UTC datetimes by default
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc) or not hmac.compare_digest(_hash_otp(otp), record["otp_hash"]):
        return False
    await db.password_resets.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
    return True


async def get_current_user(db, token: Optional[str]) -> Optional[dict]:
    """Resolve a raw cookie token to its user, or None if missing/expired/invalid."""
    if not token:
        return None
    session = await db.sessions.find_one({"token_hash": _hash_token(token)})
    if not session:
        return None
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:  # motor returns naive UTC datetimes by default
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"id": session["user_id"]})


def public_user(user: dict) -> dict:
    """Strip credentials before a user goes out over the API."""
    return {
        "id": user["id"],
        "email": user["email"],
        "created_at": user["created_at"],
        "verified": user.get("verified", False),
        "credits": user.get("credits", 0),
        "is_admin": is_admin(user),
    }
