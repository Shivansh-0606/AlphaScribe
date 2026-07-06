"""Filing ingestion: accepts raw text or fetches from SEC EDGAR."""
from __future__ import annotations
import re
import uuid
from datetime import datetime, timezone
from typing import Any
import httpx
from .retrieval import chunk_text


SEC_UA = "AlphaScribe Research research@alphascribe.ai"


def _clean_html(html: str) -> str:
    # crude but effective for EDGAR filings
    text = re.sub(r"<script.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


async def fetch_edgar_latest(ticker: str, form_type: str = "10-Q") -> dict | None:
    """Fetch latest 10-K/10-Q from SEC EDGAR by ticker.

    Returns dict {source, url, text} or None on failure.
    """
    ticker = ticker.upper()
    headers = {"User-Agent": SEC_UA, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        # 1. resolve CIK
        r = await client.get("https://www.sec.gov/files/company_tickers.json")
        r.raise_for_status()
        mapping = r.json()
        cik = None
        company_name = None
        for _, row in mapping.items():
            if row.get("ticker", "").upper() == ticker:
                cik = str(row["cik_str"]).zfill(10)
                company_name = row.get("title")
                break
        if not cik:
            return None

        # 2. get submissions
        r = await client.get(f"https://data.sec.gov/submissions/CIK{cik}.json")
        r.raise_for_status()
        subs = r.json().get("filings", {}).get("recent", {})
        forms = subs.get("form", [])
        accs = subs.get("accessionNumber", [])
        docs = subs.get("primaryDocument", [])
        dates = subs.get("filingDate", [])
        for i, (form, acc, doc) in enumerate(zip(forms, accs, docs)):
            if form == form_type:
                acc_nodash = acc.replace("-", "")
                filing_date = dates[i] if i < len(dates) else None
                url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_nodash}/{doc}"
                r2 = await client.get(url)
                r2.raise_for_status()
                text = _clean_html(r2.text)
                return {
                    "source": f"{form_type} {acc} filed {filing_date}" if filing_date else f"{form_type} {acc}",
                    "url": url,
                    "text": text[:200_000],
                    "company_name": company_name,
                    "filing_date": filing_date,
                }
    return None


def _fmt_num(v) -> str:
    """Human-format a large number (e.g. 1.06e12 -> '$1.06T')."""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "n/a"
    for unit, div in (("T", 1e12), ("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if abs(v) >= div:
            return f"{v / div:.2f}{unit}"
    return f"{v:.2f}"


def _fetch_yfinance_sync(ticker: str, exchange: str | None) -> dict | None:
    """Build a research-text document for ANY company from Yahoo Finance.

    Works for US tickers directly and for global tickers via exchange suffixes
    (NSE '.NS', BSE '.BO'). Returns {source, text, company_name, url} or None.
    """
    import yfinance as yf

    candidates = [ticker]
    if exchange == "IN":
        candidates = [f"{ticker}.NS", f"{ticker}.BO", ticker]

    for sym in candidates:
        try:
            info = yf.Ticker(sym).info
        except Exception:
            continue
        if not info or not (info.get("longName") or info.get("shortName")):
            continue

        name = info.get("longName") or info.get("shortName")
        pct = lambda k: (f"{info[k] * 100:.1f}%" if isinstance(info.get(k), (int, float)) else "n/a")  # noqa: E731
        lines = [
            f"{name} ({sym}) — Company Financial Profile (source: Yahoo Finance)",
            "",
            f"Sector: {info.get('sector', 'n/a')}   Industry: {info.get('industry', 'n/a')}",
            f"Country: {info.get('country', 'n/a')}   Currency: {info.get('currency', 'n/a')}",
            "",
            "## Key Metrics",
            f"Market Cap: {_fmt_num(info.get('marketCap'))}",
            f"Total Revenue (ttm): {_fmt_num(info.get('totalRevenue'))}",
            f"EBITDA: {_fmt_num(info.get('ebitda'))}",
            f"Net Income to Common: {_fmt_num(info.get('netIncomeToCommon'))}",
            f"Trailing EPS: {info.get('trailingEps', 'n/a')}   Forward EPS: {info.get('forwardEps', 'n/a')}",
            f"Gross Margin: {pct('grossMargins')}   Operating Margin: {pct('operatingMargins')}   Profit Margin: {pct('profitMargins')}",
            f"Revenue Growth (yoy): {pct('revenueGrowth')}   Earnings Growth: {pct('earningsGrowth')}",
            f"Return on Equity: {pct('returnOnEquity')}   Debt/Equity: {info.get('debtToEquity', 'n/a')}",
            f"P/E (trailing): {info.get('trailingPE', 'n/a')}   Forward P/E: {info.get('forwardPE', 'n/a')}",
            f"Dividend Yield: {pct('dividendYield')}   52w High/Low: {info.get('fiftyTwoWeekHigh', 'n/a')}/{info.get('fiftyTwoWeekLow', 'n/a')}",
            f"Analyst Recommendation: {info.get('recommendationKey', 'n/a')}   Target Mean: {info.get('targetMeanPrice', 'n/a')}",
        ]
        summary = info.get("longBusinessSummary")
        if summary:
            lines += ["", "## Business Summary", summary]

        text = "\n".join(lines)
        return {
            "source": f"Yahoo Finance Profile — {sym}",
            "text": text,
            "company_name": name,
            "url": f"https://finance.yahoo.com/quote/{sym}",
        }
    return None


async def fetch_yfinance(ticker: str, exchange: str | None = None) -> dict | None:
    """Async wrapper around the blocking yfinance fetch."""
    import asyncio
    return await asyncio.to_thread(_fetch_yfinance_sync, ticker.upper(), exchange)


async def ingest_document(
    db: Any,
    *,
    ticker: str,
    source: str,
    text: str,
    company_name: str | None = None,
) -> dict:
    """Chunk the document and store chunks in MongoDB. Returns summary stats."""
    ticker = ticker.upper()
    doc_id = str(uuid.uuid4())
    chunks = chunk_text(text)
    now = datetime.now(timezone.utc).isoformat()

    # Embed chunks once at ingest and cache the vectors, so retrieval never has
    # to re-embed the whole filing on every query. Falls back to no-cache (BM25
    # + on-the-fly embedding) if the embedder isn't available.
    from .retrieval import embed_texts
    vectors = embed_texts(chunks) if chunks else None

    rows = []
    for i, c in enumerate(chunks):
        row = {
            "doc_id": doc_id,
            "ticker": ticker,
            "source": source,
            "chunk_idx": i,
            "text": c,
            "created_at": now,
        }
        if vectors is not None:
            row["embedding"] = [float(x) for x in vectors[i]]
        rows.append(row)
    if rows:
        await db.filing_chunks.insert_many(rows)
    await db.filings.insert_one({
        "doc_id": doc_id,
        "ticker": ticker,
        "company_name": company_name,
        "source": source,
        "num_chunks": len(rows),
        "char_count": len(text),
        "created_at": now,
    })
    # keep the ticker -> company mapping fresh (upsert)
    if company_name:
        await db.companies.update_one(
            {"ticker": ticker},
            {"$set": {"ticker": ticker, "name": company_name, "updated_at": now}},
            upsert=True,
        )
    return {
        "doc_id": doc_id,
        "ticker": ticker,
        "company_name": company_name,
        "source": source,
        "num_chunks": len(rows),
        "char_count": len(text),
    }
