"""Password-reset OTP delivery via Resend (https://resend.com), using the
existing `httpx` dependency — zero new dep. Best-effort: failures are logged,
never raised, since /auth/forgot-password must return the same response
whether or not the send succeeds (don't leak account existence via errors).
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("alphascribe.notify")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "AlphaScribe <onboarding@resend.dev>")


async def send_otp_email(to_email: str, otp: str) -> None:
    if not RESEND_API_KEY:
        # ponytail: no email provider configured (e.g. local dev) — log the
        # OTP instead of failing, so the reset flow stays testable without a
        # live Resend account. WARNING (not INFO): this writes a live reset
        # code to the log stream, which is only acceptable in dev — a
        # forgotten RESEND_API_KEY in production would silently degrade to
        # this, so it needs to be loud enough to trip log-level alerting.
        logger.warning(
            "INSECURE: RESEND_API_KEY not set — password reset OTP for %s is %s (logged, not emailed)",
            to_email, otp,
        )
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={
                    "from": RESEND_FROM,
                    "to": [to_email],
                    "subject": "Your AlphaScribe password reset code",
                    "text": f"Your password reset code is {otp}. It expires in 10 minutes.",
                },
            )
            r.raise_for_status()
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
