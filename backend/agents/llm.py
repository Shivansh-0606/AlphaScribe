"""Thin async wrapper around Google Gemini.

Provides `chat_json(...)` for structured Pydantic outputs and `chat_text(...)`
for free-form text. Uses the Google Generative AI SDK with a free-tier API key.

The public surface (`chat_text`, `chat_json`, `DEFAULT_LIGHT_MODEL`,
`DEFAULT_HEAVY_MODEL`) is unchanged from the original implementation so the
agent nodes require no modification.
"""
from __future__ import annotations
import asyncio
import json
import os
import re
from typing import Type, TypeVar
from pydantic import BaseModel, ValidationError

import google.generativeai as genai

T = TypeVar("T", bound=BaseModel)

# Gemini model tiers, chosen to stay within the free-tier quota:
#   - light (extraction/tone/routing): flash-lite — fast, highest free quota
#   - heavy (synthesis/fact-check): flash — stronger, still free-tier friendly
# `gemini-2.5-pro` is intentionally avoided as the default: the free tier
# rate-limits it aggressively. Override via env to use it on a paid key.
DEFAULT_LIGHT_MODEL = os.environ.get("GEMINI_LIGHT_MODEL", "gemini-2.5-flash-lite")  # extraction / routing
DEFAULT_HEAVY_MODEL = os.environ.get("GEMINI_HEAVY_MODEL", "gemini-2.5-flash")       # synthesis / fact-check

_CONFIGURED = False


def _api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY not set in backend/.env — get a free key at "
            "https://aistudio.google.com/apikey"
        )
    return key


def _ensure_configured() -> None:
    global _CONFIGURED
    if not _CONFIGURED:
        genai.configure(api_key=_api_key())
        _CONFIGURED = True


def _generate_sync(system: str, user: str, model: str) -> str:
    """Blocking Gemini call — run inside a thread by the async wrappers."""
    _ensure_configured()
    gm = genai.GenerativeModel(model_name=model, system_instruction=system)
    resp = gm.generate_content(user)
    # `.text` raises if the response was blocked/empty; fall back defensively.
    try:
        text = resp.text
    except Exception:  # noqa: BLE001
        parts = []
        for cand in getattr(resp, "candidates", []) or []:
            content = getattr(cand, "content", None)
            for part in getattr(content, "parts", []) or []:
                if getattr(part, "text", None):
                    parts.append(part.text)
        text = "\n".join(parts)
    return text or ""


def _retry_after_seconds(err: Exception) -> float | None:
    """Extract the server-suggested retry delay from a 429 error, if present."""
    m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", str(err))
    return float(m.group(1)) if m else None


async def chat_text(system: str, user: str, *, model: str = DEFAULT_HEAVY_MODEL) -> str:
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            return await asyncio.to_thread(_generate_sync, system, user, model)
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt == 3:
                break
            # On a rate-limit (429), wait the server-suggested delay; otherwise
            # back off exponentially. Never auto-escalate to a heavier model —
            # that only makes quota pressure worse on the free tier.
            wait = _retry_after_seconds(e)
            if wait is None:
                wait = 2.0 * (attempt + 1)
            await asyncio.sleep(min(wait, 30.0))
    raise last_err  # type: ignore[misc]


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    return text


async def chat_json(
    system: str,
    user: str,
    schema: Type[T],
    *,
    model: str = DEFAULT_LIGHT_MODEL,
) -> T:
    """Ask the LLM for a JSON object and validate it against a Pydantic schema."""
    guardrail = (
        "\n\nReturn ONLY a single JSON object. No prose, no markdown fences. "
        f"The JSON MUST match this schema (Pydantic):\n{json.dumps(schema.model_json_schema(), indent=2)}"
    )
    raw = await chat_text(system + guardrail, user, model=model)
    raw = _strip_code_fence(raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # last-ditch: extract first {...} block
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            raise ValueError(f"LLM did not return JSON: {raw[:400]}")
        data = json.loads(m.group(0))
    try:
        return schema.model_validate(data)
    except ValidationError as e:
        raise ValueError(f"Pydantic validation failed: {e}\nRaw: {raw[:400]}")
