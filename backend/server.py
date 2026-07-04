"""AlphaScribe FastAPI backend — Multi-Agent Equity Research Copilot."""
from __future__ import annotations
import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from agents.graph import build_graph
from agents.ingest import fetch_edgar_latest, ingest_document
from agents.sample_data import SAMPLES
from agents.scoring import compute_scorecard
from agents.retrieval import retrieval_status
from agents import company_index

# ---------------------------------------------------------------------------
# DB / App setup
# ---------------------------------------------------------------------------

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

app = FastAPI(title="AlphaScribe", version="0.1.0")
api = APIRouter(prefix="/api")

# In-memory task registry for report generation. Each entry:
#   {"id", "ticker", "query", "status", "created_at", "state", "events"}
JOBS: dict[str, dict[str, Any]] = {}
JOB_QUEUES: dict[str, asyncio.Queue] = {}

# Compile graph once at startup.
graph = build_graph(db)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("alphascribe")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class IngestTextRequest(BaseModel):
    ticker: str
    source: str = Field(description="Human label, e.g. '10-Q FY24 Q3'")
    text: str
    company_name: Optional[str] = None


class IngestEdgarRequest(BaseModel):
    ticker: str
    form_type: str = "10-Q"


class GenerateRequest(BaseModel):
    ticker: str
    query: str
    context_report_id: Optional[str] = None   # if set, treat as a follow-up
                                              # and inject prior brief into synth


class JobSummary(BaseModel):
    id: str
    ticker: str
    query: str
    status: str
    created_at: str
    fact_check_status: Optional[bool] = None
    retry_count: Optional[int] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@api.get("/")
async def root():
    return {"service": "alphascribe", "version": "0.1.0"}


@api.get("/health")
async def health():
    llm_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    docs = await db.filings.count_documents({})
    chunks = await db.filing_chunks.count_documents({})
    return {
        "ok": True,
        "gemini_key_configured": llm_key,
        "filings": docs,
        "chunks": chunks,
        "retrieval": retrieval_status(),
    }


@api.post("/ingest/text")
async def ingest_text(req: IngestTextRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text is empty")
    result = await ingest_document(
        db, ticker=req.ticker, source=req.source, text=req.text,
        company_name=req.company_name,
    )
    return result


@api.post("/ingest/edgar")
async def ingest_edgar(req: IngestEdgarRequest):
    doc = await fetch_edgar_latest(req.ticker, req.form_type)
    if not doc:
        raise HTTPException(status_code=404, detail=f"No {req.form_type} found for {req.ticker}")
    result = await ingest_document(
        db, ticker=req.ticker, source=doc["source"], text=doc["text"],
        company_name=doc.get("company_name"),
    )
    result["url"] = doc.get("url")
    return result


@api.post("/ingest/samples")
async def ingest_samples():
    ingested = []
    for s in SAMPLES:
        # skip if already there
        exists = await db.filings.find_one({"ticker": s["ticker"], "source": s["source"]})
        if exists:
            continue
        r = await ingest_document(
            db, ticker=s["ticker"], source=s["source"], text=s["text"],
            company_name=s.get("company_name"),
        )
        ingested.append(r)
    return {"ingested": ingested, "total_samples": len(SAMPLES)}


@api.post("/ingest/audio")
async def ingest_audio(
    file: UploadFile = File(...),
    ticker: str = Form(...),
    source: str = Form("Audio Transcript"),
    company_name: Optional[str] = Form(None),
    language: Optional[str] = Form("en"),
):
    """Transcribe an audio file via OpenAI Whisper and ingest the transcript.

    Supports mp3, mp4, mpeg, mpga, m4a, wav, webm. Max 25MB.
    """
    ALLOWED = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail=f"Unsupported audio type: .{ext}")

    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file exceeds 25MB")
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=501,
            detail="Audio ingest is disabled — set GEMINI_API_KEY to enable transcription.",
        )

    # Map file extension to a MIME type Gemini accepts.
    MIME = {
        "mp3": "audio/mp3", "mpeg": "audio/mpeg", "mpga": "audio/mpeg",
        "m4a": "audio/mp4", "mp4": "audio/mp4", "wav": "audio/wav",
        "webm": "audio/webm",
    }
    try:
        import google.generativeai as genai

        def _transcribe() -> str:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                "Transcribe this audio verbatim to plain text. "
                "Return only the transcript, no commentary."
            )
            resp = model.generate_content([
                prompt,
                {"mime_type": MIME.get(ext, "audio/mpeg"), "data": raw},
            ])
            return resp.text or ""

        transcript = await asyncio.to_thread(_transcribe)
    except Exception as e:
        logger.exception("gemini transcription failed")
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")

    if not transcript or not transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript was empty")

    result = await ingest_document(
        db, ticker=ticker, source=source, text=transcript,
        company_name=company_name,
    )
    result["transcript_chars"] = len(transcript)
    result["transcript_preview"] = transcript[:400]
    return result


@api.get("/companies")
async def list_companies():
    """Ticker -> company name mapping derived from ingested filings."""
    rows = await db.companies.find({}, {"_id": 0}).to_list(1000)
    return {"companies": {r["ticker"]: r["name"] for r in rows if r.get("name")}}


@api.get("/companies/search")
async def companies_search(q: str, limit: int = 8):
    """Fuzzy search the SEC company universe. Falls back to locally ingested
    companies if the SEC index hasn't been loaded yet."""
    q = (q or "").strip()
    if not q:
        return {"results": []}

    if not company_index.is_loaded():
        # kick a background load — first call may return few results, subsequent are richer
        asyncio.create_task(company_index.load_index())

    results = company_index.search(q, limit=limit)

    # augment with which companies we already have filings for
    if results:
        tickers = [r["ticker"] for r in results]
        have = set()
        cursor = db.filings.find({"ticker": {"$in": tickers}}, {"ticker": 1, "_id": 0})
        async for row in cursor:
            have.add(row["ticker"])
        for r in results:
            r["has_filings"] = r["ticker"] in have

    # If SEC index unavailable, fall back to our own companies collection
    if not results:
        qn = q.lower()
        local = await db.companies.find({}, {"_id": 0}).to_list(1000)
        local_scored = []
        for row in local:
            name = (row.get("name") or "").lower()
            tk = (row.get("ticker") or "").lower()
            if qn in name or qn in tk:
                local_scored.append({
                    "ticker": row["ticker"],
                    "name": row.get("name") or row["ticker"],
                    "has_filings": True,
                })
        results = local_scored[:limit]

    return {"results": results, "index_loaded": company_index.is_loaded()}


class EnsureRequest(BaseModel):
    ticker: str
    refresh: bool = False


@api.post("/companies/ensure")
async def ensure_company(req: EnsureRequest):
    """Guarantee we have some filing for `ticker`. If none (or `refresh=True`),
    fetch latest 10-Q (falling back to 10-K) from SEC EDGAR and ingest it."""
    ticker = req.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="ticker required")

    # Indian tickers aren't in SEC EDGAR
    exch = company_index.lookup_exchange(ticker)
    name = company_index.lookup_ticker(ticker)

    exists = await db.filing_chunks.count_documents({"ticker": ticker}) > 0
    if exists and not req.refresh:
        latest = await db.filings.find_one(
            {"ticker": ticker}, {"_id": 0}, sort=[("created_at", -1)]
        )
        return {
            "ticker": ticker,
            "company_name": name,
            "exchange": exch,
            "action": "already_ingested",
            "latest_filing": latest,
        }

    if exch == "IN":
        raise HTTPException(
            status_code=422,
            detail=(
                f"{name or ticker} is an NSE/BSE listing. Automatic filing "
                "download isn't supported for Indian companies yet — use "
                "'Paste Text' or 'Upload Audio' on the Ingest page to load a "
                "quarterly result or earnings call."
            ),
        )

    for form in ("10-Q", "10-K"):
        try:
            doc = await fetch_edgar_latest(ticker, form)
        except Exception as e:
            logger.warning("EDGAR fetch failed for %s %s: %s", ticker, form, e)
            doc = None
        if doc and doc.get("text"):
            result = await ingest_document(
                db, ticker=ticker, source=doc["source"], text=doc["text"],
                company_name=doc.get("company_name"),
            )
            result["action"] = "ingested_from_edgar"
            result["url"] = doc.get("url")
            result["filing_date"] = doc.get("filing_date")
            result["form_type"] = form
            result["exchange"] = "US"
            return result

    raise HTTPException(
        status_code=404,
        detail=f"No SEC filing available for {name or ticker}. Try 'Paste text' or 'Upload audio' instead.",
    )


@api.get("/filings")
async def list_filings(ticker: Optional[str] = None):
    q: dict = {}
    if ticker:
        q["ticker"] = ticker.upper()
    rows = await db.filings.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"filings": rows}


@api.get("/tickers")
async def list_tickers():
    tickers = await db.filings.distinct("ticker")
    return {"tickers": sorted(tickers)}


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

async def _run_pipeline(job_id: str, ticker: str, query: str,
                        prior_brief: str = "") -> None:
    q = JOB_QUEUES[job_id]
    job = JOBS[job_id]
    job["status"] = "running"
    await db.jobs.update_one(
        {"id": job_id}, {"$set": {"status": "running"}}, upsert=True
    )

    async def push(ev: dict) -> None:
        job["events"].append(ev)
        await q.put(ev)
        # also mirror event to Mongo so a reconnecting client can resume
        await db.jobs.update_one(
            {"id": job_id},
            {"$push": {"events": ev}, "$set": {"updated_at": ev.get("ts", "")}}
        )

    await push({"node": "pipeline", "status": "start",
                "message": f"Starting AlphaScribe pipeline for {ticker}",
                "ts": datetime.now(timezone.utc).isoformat()})
    try:
        initial: dict = {
            "ticker": ticker.upper(),
            "query": query,
            "retry_count": 0,
            "trace": [],
        }
        if prior_brief:
            initial["prior_brief"] = prior_brief
        final_state: dict = {}
        async for event in graph.astream(initial, {"recursion_limit": 25}):
            # event is {node_name: node_return_value}
            for _node_name, node_state in event.items():
                if not isinstance(node_state, dict):
                    continue
                final_state.update(node_state)
                for t in node_state.get("trace", []):
                    await push(t)

        # Persist final state (strip trace for storage cleanliness)
        report_doc = {
            "id": job_id,
            "ticker": ticker.upper(),
            "query": query,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "draft_report": final_state.get("draft_report", ""),
            "extracted_data": final_state.get("extracted_data", {}),
            "sentiment_analysis": final_state.get("sentiment_analysis", {}),
            "source_documents": final_state.get("source_documents", []),
            "fact_check_status": bool(final_state.get("fact_check_status")),
            "validation_errors": final_state.get("validation_errors", []),
            "verified_claims": final_state.get("verified_claims", []),
            "retry_count": int(final_state.get("retry_count", 0)),
            "events": job["events"],
        }
        report_doc["scorecard"] = compute_scorecard(report_doc)
        # attach company name for display
        comp = await db.companies.find_one({"ticker": ticker.upper()}, {"_id": 0})
        report_doc["company_name"] = comp.get("name") if comp else None
        await db.reports.insert_one(report_doc)
        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "completed",
                      "report_id": job_id,
                      "fact_check_status": report_doc["fact_check_status"],
                      "retry_count": report_doc["retry_count"]}}
        )
        job["report"] = report_doc
        job["status"] = "completed"
        await push({
            "node": "pipeline",
            "status": "ok",
            "message": "Pipeline complete",
            "fact_check_status": report_doc["fact_check_status"],
            "retry_count": report_doc["retry_count"],
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.exception("pipeline failed")
        job["status"] = "failed"
        job["error"] = str(e)
        await db.jobs.update_one(
            {"id": job_id}, {"$set": {"status": "failed", "error": str(e)}}
        )
        await push({
            "node": "pipeline",
            "status": "error",
            "message": f"Pipeline failed: {e}",
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    finally:
        await q.put(None)  # sentinel


@api.post("/reports/generate")
async def generate_report(req: GenerateRequest):
    ticker = req.ticker.strip().upper()
    if not ticker or not req.query.strip():
        raise HTTPException(status_code=400, detail="ticker and query are required")

    # Require at least one ingested chunk for the ticker
    has_data = await db.filing_chunks.count_documents({"ticker": ticker}) > 0
    if not has_data:
        raise HTTPException(
            status_code=400,
            detail=f"No filings ingested for {ticker}. Ingest a filing first "
                   f"(POST /api/ingest/samples for demo data).",
        )

    job_id = str(uuid.uuid4())
    prior_brief = ""
    if req.context_report_id:
        prior = await db.reports.find_one(
            {"id": req.context_report_id}, {"draft_report": 1, "_id": 0}
        )
        if prior:
            prior_brief = prior.get("draft_report", "") or ""
    JOBS[job_id] = {
        "id": job_id,
        "ticker": ticker,
        "query": req.query,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "events": [],
        "context_report_id": req.context_report_id,
    }
    await db.jobs.insert_one({
        "id": job_id,
        "ticker": ticker,
        "query": req.query,
        "status": "queued",
        "created_at": JOBS[job_id]["created_at"],
        "context_report_id": req.context_report_id,
        "events": [],
    })
    JOB_QUEUES[job_id] = asyncio.Queue()
    asyncio.create_task(_run_pipeline(job_id, ticker, req.query, prior_brief=prior_brief))
    return {"job_id": job_id}


@api.get("/reports/{job_id}/stream")
async def stream_report(job_id: str):
    if job_id not in JOB_QUEUES:
        raise HTTPException(status_code=404, detail="job not found")

    q = JOB_QUEUES[job_id]
    job = JOBS[job_id]

    async def event_source():
        # replay any already-emitted events
        for ev in list(job["events"]):
            yield f"data: {json.dumps(ev)}\n\n"
        while True:
            try:
                item = await asyncio.wait_for(q.get(), timeout=120.0)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue
            if item is None:
                # send final snapshot
                if job.get("report"):
                    payload = {"node": "final", "status": "ok",
                               "report": job["report"]}
                    yield f"data: {json.dumps(payload, default=str)}\n\n"
                yield "event: end\ndata: {}\n\n"
                break
            yield f"data: {json.dumps(item, default=str)}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@api.get("/reports/{job_id}")
async def get_report(job_id: str):
    doc = await db.reports.find_one({"id": job_id}, {"_id": 0})
    if not doc:
        # maybe still running — return job snapshot (in-memory or persisted)
        job = JOBS.get(job_id)
        if job:
            return {"status": job["status"], "id": job_id, "events": job["events"]}
        job_doc = await db.jobs.find_one({"id": job_id}, {"_id": 0})
        if job_doc:
            return {"status": job_doc.get("status", "unknown"),
                    "id": job_id,
                    "events": job_doc.get("events", [])}
        raise HTTPException(status_code=404, detail="report not found")
    # ensure scorecard exists for old reports
    if "scorecard" not in doc:
        doc["scorecard"] = compute_scorecard(doc)
        await db.reports.update_one({"id": job_id}, {"$set": {"scorecard": doc["scorecard"]}})
    return {"status": "completed", "id": job_id, "report": doc}


@api.get("/reports")
async def list_reports(ticker: Optional[str] = None, limit: int = 50):
    q: dict = {}
    if ticker:
        q["ticker"] = ticker.upper()
    rows = (
        await db.reports.find(q, {"_id": 0, "events": 0, "source_documents": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return {"reports": rows}


@api.delete("/reports/{report_id}")
async def delete_report(report_id: str):
    result = await db.reports.delete_one({"id": report_id})
    await db.jobs.delete_one({"id": report_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="report not found")
    return {"deleted": report_id}


@api.get("/companies/trending")
async def trending_companies(limit: int = 8):
    """Return the companies with the most generated reports (proxy for interest)."""
    pipeline = [
        {"$group": {"_id": "$ticker", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    rows = await db.reports.aggregate(pipeline).to_list(limit)
    tickers = [r["_id"] for r in rows]
    # look up company names
    comp_rows = await db.companies.find({"ticker": {"$in": tickers}}, {"_id": 0}).to_list(len(tickers))
    name_by_ticker = {c["ticker"]: c.get("name") for c in comp_rows}
    # fallback: SEC index
    trending = [
        {
            "ticker": r["_id"],
            "name": name_by_ticker.get(r["_id"])
                    or company_index.lookup_ticker(r["_id"])
                    or r["_id"],
            "count": r["count"],
        }
        for r in rows
    ]
    # If we have very few reports, seed with popular US tickers
    if len(trending) < limit:
        seeds = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "NFLX"]
        have = {t["ticker"] for t in trending}
        for s in seeds:
            if s in have:
                continue
            name = name_by_ticker.get(s) or company_index.lookup_ticker(s)
            if name:
                trending.append({"ticker": s, "name": name, "count": 0})
            if len(trending) >= limit:
                break
    return {"trending": trending[:limit]}


@api.post("/reports/rescore")
async def rescore_reports():
    """Recompute scorecards for all reports using full source_documents.

    Useful after upgrading the scoring logic; safe to re-run.
    """
    cursor = db.reports.find({}, {"_id": 0})
    updated = 0
    async for doc in cursor:
        card = compute_scorecard(doc)
        await db.reports.update_one({"id": doc["id"]}, {"$set": {"scorecard": card}})
        updated += 1
    return {"updated": updated}


class CompareRequest(BaseModel):
    report_ids: list[str] = Field(min_length=2, max_length=4)


@api.post("/reports/compare")
async def compare_reports(req: CompareRequest):
    """Load 2-4 reports side by side for portfolio comparison."""
    rows = await db.reports.find(
        {"id": {"$in": req.report_ids}},
        {"_id": 0, "events": 0, "source_documents": 0},
    ).to_list(len(req.report_ids))
    # preserve requested order
    by_id = {r["id"]: r for r in rows}
    ordered = [by_id[i] for i in req.report_ids if i in by_id]
    if len(ordered) < 2:
        raise HTTPException(status_code=404, detail="fewer than 2 reports found")
    return {"reports": ordered}


# ---------------------------------------------------------------------------
# Wire router + middleware
# ---------------------------------------------------------------------------

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _warmup():
    """Preload embedding + rerank models in the background so the first pipeline
    run does not incur ~30-40s of cold-start model download / ONNX load."""

    async def _run():
        from agents.retrieval import _get_embedder, _get_reranker  # noqa: WPS437
        loop = asyncio.get_running_loop()
        try:
            await loop.run_in_executor(None, _get_embedder)
            await loop.run_in_executor(None, _get_reranker)
            logger.info("retrieval warmup complete")
        except Exception as e:
            logger.warning("retrieval warmup failed: %s", e)
        try:
            n = await company_index.load_index()
            logger.info("company index loaded (%d rows)", n)
        except Exception as e:
            logger.warning("company index load failed: %s", e)

    asyncio.create_task(_run())


@app.on_event("shutdown")
async def _shutdown():
    mongo_client.close()
