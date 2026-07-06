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
