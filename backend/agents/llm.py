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
import ipaddress
import json
import os
import re
import socket
import threading
from contextvars import ContextVar
from typing import Type, TypeVar, get_origin, get_args
from urllib.parse import urlparse
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
    "anthropic":  ("claude-haiku-4-5", "claude-sonnet-4-6"),
    "groq":       ("llama-3.1-8b-instant", "llama-3.3-70b-versatile"),
    "openrouter": ("openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5"),
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


def assert_public_url(url: str) -> None:
    """Raise ValueError unless `url` is an http(s) endpoint on a public host.

    SSRF guard for the client-supplied custom LLM base_url: a caller must not be
    able to point the server's outbound request at loopback/private/link-local/
    reserved addresses (cloud metadata at 169.254.169.254, intranet hosts).
    ponytail: resolves the host once here; a determined attacker could DNS-rebind
    between this check and the SDK's own connect. Pin the resolved IP in the HTTP
    client if that threat ever matters.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("must be an http(s) URL")
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port,
                                   proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise ValueError("host does not resolve") from e
    for *_, sockaddr in infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            raise ValueError("resolves to a non-public address")


def _resolve_model(model: str, cfg: dict) -> str:
    if model == DEFAULT_LIGHT_MODEL:
        return cfg["light"]
    if model == DEFAULT_HEAVY_MODEL:
        return cfg["heavy"]
    return model


# --------------------------------------------------------------------------
# Provider backends (blocking; run in a thread)
# --------------------------------------------------------------------------
# Guards google.generativeai's process-global configure(). Shared with the
# audio-transcription path in server.py, which uses the same global.
GEMINI_LOCK = threading.Lock()

# Per-call network timeout so a hung provider connection can't tie up a worker
# thread indefinitely (the to_thread executor is shared with PDF/audio work).
_REQUEST_TIMEOUT = float(os.environ.get("LLM_REQUEST_TIMEOUT", "120"))


class NonRetryableLLMError(RuntimeError):
    """A deterministic failure (bad config, truncated output) where retrying just
    burns more calls + backoff for the same result. chat_text re-raises these
    immediately instead of looping."""


def _gen_gemini(system: str, user: str, model: str, key: str) -> str:
    import google.generativeai as genai
    # google.generativeai.configure() sets a PROCESS-GLOBAL key, so two
    # concurrent requests with different keys would clobber each other and a
    # call could run under the wrong caller's key (cross-tenant billing/leak).
    # Hold the lock across configure+generate so the key can't change mid-call.
    # ponytail: global lock serializes all Gemini traffic; upgrade path is the
    # newer google-genai SDK whose Client(api_key=...) takes a per-call key.
    with GEMINI_LOCK:
        genai.configure(api_key=key)
        gm = genai.GenerativeModel(model_name=model, system_instruction=system)
        resp = gm.generate_content(user, request_options={"timeout": _REQUEST_TIMEOUT})
    cand = (getattr(resp, "candidates", None) or [None])[0]
    if getattr(getattr(cand, "finish_reason", None), "name", "") == "MAX_TOKENS":
        # Truncated brief — don't let a cut-off draft reach the fact-checker.
        raise NonRetryableLLMError("Gemini output was truncated (MAX_TOKENS).")
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
    client = (OpenAI(api_key=key, base_url=base_url, timeout=_REQUEST_TIMEOUT)
              if base_url else OpenAI(api_key=key, timeout=_REQUEST_TIMEOUT))
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        temperature=0.3,
        # Cap output: without this, OpenRouter reserves the model's max output
        # (e.g. 64K) from your credit balance and 402s on low-credit accounts.
        # The pipeline's largest output (the brief) is prompted to <500 words
        # (~700 tokens), so 2048 leaves ~3x headroom. Raise via env if needed.
        max_tokens=int(os.environ.get("LLM_MAX_OUTPUT_TOKENS", "2048")),
    )
    choice = resp.choices[0]
    if choice.finish_reason == "length":
        # Surface truncation instead of letting a cut-off brief flow into the
        # fact-checker as if it were complete.
        raise NonRetryableLLMError(
            "LLM output was truncated by the max_tokens cap "
            "(LLM_MAX_OUTPUT_TOKENS). Raise it in backend/.env and retry."
        )
    return choice.message.content or ""


def _gen_anthropic(system: str, user: str, model: str, key: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=key, timeout=_REQUEST_TIMEOUT)
    resp = client.messages.create(
        model=model, max_tokens=4096, system=system,
        messages=[{"role": "user", "content": user}],
    )
    if resp.stop_reason == "max_tokens":
        # Same truncation guard as the other providers (was missing here).
        raise NonRetryableLLMError("Anthropic output was truncated (max_tokens=4096).")
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def _generate_sync(system: str, user: str, model: str) -> str:
    cfg = _active()
    provider, key = cfg["provider"], cfg["api_key"]
    if not key:
        raise NonRetryableLLMError(
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
        except NonRetryableLLMError:
            raise  # deterministic — retrying wastes calls + backoff
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt == 3:
                break
            wait = _retry_after_seconds(e)
            if wait is None:
                wait = 2.0 * (attempt + 1)
            await asyncio.sleep(min(wait, 30.0))
    raise last_err  # type: ignore[misc]


def _type_name(ann) -> str:
    s = str(ann).replace("typing.", "")
    if s.startswith("<class '") and s.endswith("'>"):
        s = s[len("<class '"):-len("'>")]  # e.g. "str", "float"
    return s


def _schema_hint(model: Type[BaseModel], _indent: int = 0) -> str:
    """Readable field spec for the prompt, recursing into nested Pydantic models
    so array-of-object schemas (e.g. FactCheckSchema.claims) show their item fields."""
    pad = "  " * (_indent + 1)
    lines: list[str] = []
    for name, f in model.model_fields.items():
        ann = f.annotation
        origin = get_origin(ann)
        args = get_args(ann)
        req = "required" if f.is_required() else "optional"
        desc = f" - {f.description}" if f.description else ""
        if isinstance(ann, type) and issubclass(ann, BaseModel):
            lines.append(f'{pad}"{name}": object ({req}){desc}, with fields:')
            lines.append(_schema_hint(ann, _indent + 1))
        elif origin in (list, tuple) and args and isinstance(args[0], type) and issubclass(args[0], BaseModel):
            lines.append(f'{pad}"{name}": array ({req}){desc}, each item an object with fields:')
            lines.append(_schema_hint(args[0], _indent + 1))
        else:
            lines.append(f'{pad}"{name}": {_type_name(ann)} ({req}){desc}')
    return "\n".join(lines)


def _strip_code_fence(text: str) -> str:
    """Strip a single fence that wraps the whole string, e.g. ```json / ```markdown."""
    text = text.strip()
    m = re.match(r"^```[a-zA-Z0-9]*\s*\n?(.*?)\n?\s*```$", text, re.DOTALL)
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
    # Describe the fields directly instead of dumping the JSON Schema. The raw
    # schema (with its own "properties"/"type" keys) tempts weaker models to echo
    # the envelope back, e.g. {"properties": {...}, "type": "object"}.
    guardrail = (
        "\n\nReturn ONLY a single JSON object with exactly these keys "
        "(no wrapper, no \"properties\" key, no schema metadata). "
        "Include every field named below verbatim; do not rename or replace them "
        "with index/id fields. No prose, no markdown fences.\n"
        + _schema_hint(schema)
    )
    raw = await chat_text(system + guardrail, user, model=model)
    raw = _strip_code_fence(raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}|\[.*\]", raw, re.DOTALL)
        if m:
            data = json.loads(m.group(0))
        else:
            # Model sometimes drops the outer braces, returning bare "k": v pairs.
            try:
                data = json.loads("{" + raw.strip().rstrip(",") + "}")
            except json.JSONDecodeError:
                raise ValueError(f"LLM did not return JSON: {raw[:400]}")
    # Model sometimes echoes the JSON Schema envelope instead of an instance,
    # e.g. {"properties": {<real values>}, "type": "object"}. Unwrap it when the
    # top level has none of the expected fields but does carry "properties".
    if (
        isinstance(data, dict)
        and "properties" in data
        and isinstance(data["properties"], dict)
        and not (set(schema.model_fields) & set(data))
    ):
        data = data["properties"]
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
