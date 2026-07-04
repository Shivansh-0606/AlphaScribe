"""In-memory fuzzy index over the full SEC company universe.

Loaded once at FastAPI startup from https://www.sec.gov/files/company_tickers.json
(and refreshed daily on-demand). Kept as a list of {ticker, name, exchange} dicts
with a cheap ranker so search results feel instant. Also merges a bundled list
of top NSE/BSE Indian tickers.
"""
from __future__ import annotations
import asyncio
import re
import time
from typing import Any
import httpx
from .indian_companies import INDIAN_TICKERS

SEC_UA = "AlphaScribe Research research@alphascribe.ai"

_INDEX: list[dict] = []
_TICKER_TO_NAME: dict[str, str] = {}
_LOADED_AT: float = 0.0
_LOAD_LOCK = asyncio.Lock()


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


async def load_index(force: bool = False) -> int:
    """Fetch the SEC company_tickers.json and populate the in-memory index."""
    global _INDEX, _TICKER_TO_NAME, _LOADED_AT
    async with _LOAD_LOCK:
        if _INDEX and not force and (time.time() - _LOADED_AT) < 24 * 3600:
            return len(_INDEX)
        try:
            headers = {"User-Agent": SEC_UA, "Accept": "application/json"}
            async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
                r = await client.get("https://www.sec.gov/files/company_tickers.json")
                r.raise_for_status()
                data = r.json()
        except Exception:
            # Never crash startup — index just stays empty and search falls
            # back to the local companies collection.
            return len(_INDEX)

        rows: list[dict] = []
        seen: set[str] = set()
        for _, row in data.items():
            ticker = str(row.get("ticker", "")).upper().strip()
            name = str(row.get("title", "")).strip()
            if not ticker or ticker in seen:
                continue
            seen.add(ticker)
            rows.append({
                "ticker": ticker,
                "name": name,
                "exchange": "US",
                "_nt": _norm(ticker),
                "_nn": _norm(name),
            })
        # Merge Indian tickers
        for row in INDIAN_TICKERS:
            ticker = row["ticker"].upper().strip()
            if ticker in seen:
                continue
            seen.add(ticker)
            rows.append({
                "ticker": ticker,
                "name": row["name"],
                "exchange": "IN",
                "_nt": _norm(ticker),
                "_nn": _norm(row["name"]),
            })
        _INDEX = rows
        _TICKER_TO_NAME = {r["ticker"]: r["name"] for r in rows}
        _LOADED_AT = time.time()
        return len(_INDEX)


def lookup_ticker(ticker: str) -> str | None:
    return _TICKER_TO_NAME.get(ticker.upper())


def lookup_exchange(ticker: str) -> str | None:
    for row in _INDEX:
        if row["ticker"] == ticker.upper():
            return row["exchange"]
    return None


def is_loaded() -> bool:
    return bool(_INDEX)


def search(query: str, limit: int = 10) -> list[dict]:
    """Rank matches by: ticker exact > ticker prefix > name prefix > name contains."""
    q = (query or "").strip()
    if not q:
        return []
    nq = _norm(q)
    if not nq:
        return []

    results: list[tuple[int, dict]] = []
    for row in _INDEX:
        nt, nn = row["_nt"], row["_nn"]
        score = -1
        if nt == nq:
            score = 100
        elif nt.startswith(nq):
            score = 80
        elif nn.startswith(nq):
            score = 70
        elif nq in nn:
            score = 40 + max(0, 10 - nn.find(nq))
        elif nq in nt:
            score = 30
        if score > 0:
            # Prefer shorter names (major/well-known tickers tend to be short)
            score += max(0, 20 - len(nn) // 4)
            results.append((score, row))
    results.sort(key=lambda x: x[0], reverse=True)
    return [
        {"ticker": r["ticker"], "name": r["name"], "exchange": r.get("exchange", "US")}
        for _, r in results[:limit]
    ]
