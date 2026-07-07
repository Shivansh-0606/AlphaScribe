"""Multi-provider LLM wrapper (Gemini / OpenAI / Groq).

Provides `chat_json(...)` for structured Pydantic outputs and `chat_text(...)`
for free-form text. The active provider + API key can be set per-request via a
contextvar (so users can bring their own key in the UI), falling back to
environment variables for local/dev use.

Public surface (`chat_text`, `chat_json`, `DEFAULT_LIGHT_MODEL`,
`DEFAULT_HEAVY_MODEL`) is unchanged, so the agent nodes need no modification.
"""
from __future__ import annotations
import asyncio
import json
import os
import re
from contextvars import ContextVar
from typing import Type, TypeVar
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

# Per-request LLM credentials. Set by the API layer from request headers; falls
# back to environment variables when unset (local dev / .env).
#   {"provider": "gemini"|"openai"|"groq", "api_key": "...",
#    "light_model": "...", "heavy_model": "..."}
_LLM_CTX: ContextVar[dict | None] = ContextVar("_LLM_CTX", default=None)

# Sensible free-tier-friendly defaults per provider.
PROVIDER_DEFAULTS = {
    "gemini":     ("gemini-2.0-flash-lite", "gemini-2.0-flash"),
    "openai":     ("gpt-4o-mini", "gpt-4o"),
    "anthropic":  ("claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"),
    "groq":       ("llama-3.1-8b-instant", "llama-3.3-70b-versatile"),
    "openrouter": ("openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"),
    "deepseek":   ("deepseek-chat", "deepseek-chat"),
    "mistral":    ("mistral-small-latest", "mistral-large-latest"),
    # any OpenAI-compatible endpoint (aipipe, local LLMs). base_url from request.
    "custom":     ("gpt-4o-mini", "gpt-4o-mini"),
}

# Built-in base URLs for OpenAI-compatible providers.
PROVIDER_BASE_URL = {
    "groq":       "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "deepseek":   "https://api.deepseek.com/v1",
    "mistral":    "https://api.mistral.ai/v1",
}

# Symbolic tiers — resolved to a concrete model at call time based on provider.
DEFAULT_LIGHT_MODEL = "__light__"
DEFAULT_HEAVY_MODEL = "__heavy__"


def set_llm_context(provider: str | None, api_key: str | None,
                    light_model: str | None = None, heavy_model: str | None = None,
                    base_url: str | None = None):
    """Set the active provider/key for the current async context. Returns a token
    to reset later. No-op-ish if provider/key missing (falls back to env)."""
    return _LLM_CTX.set({
        "provider": (provider or "").lower() or None,
        "api_key": api_key or None,
        "light_model": light_model or None,
        "heavy_model": heavy_model or None,
        "base_url": base_url or None,
    })


def reset_llm_context(token) -> None:
    try:
        _LLM_CTX.reset(token)
    except Exception:  # noqa: BLE001
        pass


def _active() -> dict:
    """Resolve provider + key + models from context, else environment."""
    ctx = _LLM_CTX.get() or {}
    provider = ctx.get("provider") or os.environ.get("LLM_PROVIDER") or "gemini"
    provider = provider.lower()

    key = ctx.get("api_key")
    if not key:
        env_keys = {
            "gemini": "GEMINI_API_KEY", "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY", "groq": "GROQ_API_KEY",
            "openrouter": "OPENROUTER_API_KEY", "deepseek": "DEEPSEEK_API_KEY",
            "mistral": "MISTRAL_API_KEY",
        }
        key = os.environ.get(env_keys.get(provider, ""))
        if provider == "gemini" and not key:
            key = os.environ.get("GOOGLE_API_KEY")

    d_light, d_heavy = PROVIDER_DEFAULTS.get(provider, PROVIDER_DEFAULTS["gemini"])
    light = ctx.get("light_model") or os.environ.get("LLM_LIGHT_MODEL") or d_light
    heavy = ctx.get("heavy_model") or os.environ.get("LLM_HEAVY_MODEL") or d_heavy
    base_url = ctx.get("base_url") or os.environ.get("LLM_BASE_URL") or PROVIDER_BASE_URL.get(provider)
    return {"provider": provider, "api_key": key, "light": light, "heavy": heavy, "base_url": base_url}


def _resolve_model(model: str, cfg: dict) -> str:
    if model == DEFAULT_LIGHT_MODEL:
        return cfg["light"]
    if model == DEFAULT_HEAVY_MODEL:
        return cfg["heavy"]
    return model


# --------------------------------------------------------------------------
# Provider backends (blocking; run in a thread)
# --------------------------------------------------------------------------
def _gen_gemini(system: str, user: str, model: str, key: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=key)
    gm = genai.GenerativeModel(model_name=model, system_instruction=system)
    resp = gm.generate_content(user)
    try:
        return resp.text or ""
    except Exception:  # noqa: BLE001
        parts = []
        for cand in getattr(resp, "candidates", []) or []:
            for part in getattr(getattr(cand, "content", None), "parts", []) or []:
                if getattr(part, "text", None):
                    parts.append(part.text)
        return "\n".join(parts)


def _gen_openai_compatible(system: str, user: str, model: str, key: str, base_url: str | None) -> str:
    # openai>=1.0 SDK; Groq is OpenAI-compatible via base_url.
    from openai import OpenAI
    client = OpenAI(api_key=key, base_url=base_url) if base_url else OpenAI(api_key=key)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        temperature=0.3,
    )
    return resp.choices[0].message.content or ""


def _gen_anthropic(system: str, user: str, model: str, key: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    resp = client.messages.create(
        model=model, max_tokens=4096, system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def _generate_sync(system: str, user: str, model: str) -> str:
    cfg = _active()
    provider, key = cfg["provider"], cfg["api_key"]
    if not key:
        raise RuntimeError(
            f"No API key for provider '{provider}'. Set it in backend/.env or "
            "paste a key in the app (Settings)."
        )
    real_model = _resolve_model(model, cfg)
    if provider == "gemini":
        return _gen_gemini(system, user, real_model, key)
    if provider == "anthropic":
        return _gen_anthropic(system, user, real_model, key)
    # openai / groq / openrouter / deepseek / mistral / custom all use the
    # OpenAI-compatible chat API. base_url distinguishes them.
    if provider in ("openai", "groq", "openrouter", "deepseek", "mistral", "custom"):
        return _gen_openai_compatible(system, user, real_model, key, cfg["base_url"])
    raise RuntimeError(f"Unknown LLM provider: {provider}")


def _retry_after_seconds(err: Exception) -> float | None:
    m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", str(err))
    if m:
        return float(m.group(1))
    m = re.search(r"try again in ([\d.]+)s", str(err), re.IGNORECASE)
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
        m = re.search(r"\{.*\}|\[.*\]", raw, re.DOTALL)
        if not m:
            raise ValueError(f"LLM did not return JSON: {raw[:400]}")
        data = json.loads(m.group(0))
    # Model sometimes returns a bare array when schema wraps one list field.
    if isinstance(data, list):
        list_fields = [
            name for name, f in schema.model_fields.items()
            if "list" in str(f.annotation).lower()
        ]
        if len(list_fields) == 1:
            data = {list_fields[0]: data}
    try:
        return schema.model_validate(data)
    except ValidationError as e:
        raise ValueError(f"Pydantic validation failed: {e}\nRaw: {raw[:400]}")
