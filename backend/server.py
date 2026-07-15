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
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from agents import auth, notify
from agents.graph import build_graph
from agents.ingest import (
    extract_pdf_text,
    fetch_bse_annual_report,
    fetch_edgar_latest,
    fetch_yfinance,
    ingest_document,
)
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

# Bound the registry: cap concurrent pipelines (each burns LLM quota + CPU) and
# evict finished entries so JOBS/JOB_QUEUES don't grow forever (delete_report
# only removes the Mongo docs).
MAX_ACTIVE_JOBS = int(os.environ.get("MAX_ACTIVE_JOBS", "8"))
MAX_JOB_HISTORY = int(os.environ.get("MAX_JOB_HISTORY", "200"))
_DONE_STATES = ("completed", "failed", "cancelled")


def _reap_jobs() -> None:
    """Drop the oldest finished jobs once the registry exceeds MAX_JOB_HISTORY.
    Only finished jobs are evicted, so active ones are never dropped."""
    if len(JOBS) <= MAX_JOB_HISTORY:
        return
    finished = sorted(
        (j for j in JOBS.values() if j.get("status") in _DONE_STATES),
        key=lambda j: j.get("created_at", ""),
    )
    for j in finished[: len(JOBS) - MAX_JOB_HISTORY]:
        JOBS.pop(j["id"], None)
        JOB_QUEUES.pop(j["id"], None)

# Compile graph once at startup.
graph = build_graph(db)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("alphascribe")

# Surface the active LLM provider at startup (helps diagnose quota/key issues).
from agents.llm import _active  # noqa: E402
_cfg = _active()
logger.info("LLM provider=%s  light=%s  heavy=%s  key=%s",
            _cfg["provider"], _cfg["light"], _cfg["heavy"],
            "set" if _cfg["api_key"] else "MISSING")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class IngestTextRequest(BaseModel):
    ticker: str = Field(max_length=20)
    source: str = Field(max_length=200, description="Human label, e.g. '10-Q FY24 Q3'")
    text: str = Field(max_length=1_000_000)   # ~1MB; chunker handles the rest
    company_name: Optional[str] = Field(default=None, max_length=200)


class IngestEdgarRequest(BaseModel):
    ticker: str = Field(max_length=20)
    form_type: str = Field(default="10-Q", max_length=20)


class GenerateRequest(BaseModel):
    ticker: str = Field(max_length=20)
    query: str = Field(max_length=2000)
    context_report_id: Optional[str] = None   # if set, treat as a follow-up
                                              # and inject prior brief into synth
    llm_provider: Optional[str] = None        # gemini|openai|groq|custom
    llm_api_key: Optional[str] = None         # bring-your-own key (not stored)
    llm_base_url: Optional[str] = None        # for custom OpenAI-compatible endpoints
    llm_model: Optional[str] = None           # optional model override
    no_cache: bool = False                    # force a fresh run, skip cache


class JobSummary(BaseModel):
    id: str
    ticker: str
    query: str
    status: str
    created_at: str
    fact_check_status: Optional[bool] = None
    retry_count: Optional[int] = None


class RegisterRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=256)
    remember: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class DeleteAccountRequest(BaseModel):
    email: str = Field(max_length=254)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(max_length=254)


class ResetPasswordRequest(BaseModel):
    email: str = Field(max_length=254)
    otp: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=256)


def _set_session_cookie(response: Response, token: str, remember: bool) -> None:
    kwargs: dict[str, Any] = dict(
        key=auth.COOKIE_NAME, value=token, httponly=True, secure=True,
        samesite="lax", path="/",
    )
    if remember:
        kwargs["max_age"] = int(auth.SESSION_TTL_REMEMBER.total_seconds())
    # else: no max-age -> session cookie, cleared when the browser closes
    response.set_cookie(**kwargs)


async def current_user(request: Request) -> dict:
    """Dependency: cookie -> session -> user, or 401. Wired into every tool
    route (Phase 4 login wall) — only Landing/Docs/health/auth stay open."""
    user = await auth.get_current_user(db, request.cookies.get(auth.COOKIE_NAME))
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


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
        "llm_key_configured": llm_key,
        "filings": docs,
        "chunks": chunks,
        "retrieval": retrieval_status(),
    }


@api.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    try:
        user = await auth.create_user(db, email, req.password)
    except ValueError:
        raise HTTPException(status_code=409, detail="Email already registered")
    token, _ = await auth.create_session(db, user["id"], remember=False)
    _set_session_cookie(response, token, remember=False)
    return auth.public_user(user)


@api.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    # Keyed by email only (not IP): this is a shared single-process backend,
    # and IP-keying would let unrelated brute-force attempts against other
    # accounts lock out a legitimate user behind the same NAT/proxy.
    # Recorded before the DB await (not after, on failure) so concurrent
    # requests for the same key can't all read the pre-attempt count and
    # slip past the cap together; clear_hits undoes it on success.
    key = f"login:{req.email.strip().lower()}"
    if auth.is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    auth.record_hit(key)
    user = await auth.authenticate(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    auth.clear_hits(key)
    token, _ = await auth.create_session(db, user["id"], remember=req.remember)
    _set_session_cookie(response, token, remember=req.remember)
    return auth.public_user(user)


@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """Always returns the same response regardless of whether the email is
    registered or the send succeeds — don't leak account existence. Keyed by
    email only (see /auth/login) — caps OTP spam per victim without an
    IP dimension that would self-DoS shared networks/proxies."""
    email = req.email.strip().lower()
    key = f"reset-req:{email}"
    if not auth.is_rate_limited(key):
        auth.record_hit(key)
        user = await db.users.find_one({"email": email})
        if user:
            otp = await auth.create_password_reset(db, email)
            # Fire-and-forget: awaiting the outbound Resend HTTP call here
            # would make this branch measurably slower than the not-found
            # branch, leaking account existence via response timing even
            # though the response body is identical either way.
            asyncio.create_task(notify.send_otp_email(email, otp))
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    email = req.email.strip().lower()
    key = f"reset-verify:{email}"
    if auth.is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    auth.record_hit(key)  # see /auth/login: recorded before the await, not after, to close the race
    ok = await auth.verify_password_reset(db, email, req.otp)
    user = await db.users.find_one({"email": email}) if ok else None
    if not ok or not user:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    auth.clear_hits(key)
    await auth.update_password(db, user["id"], req.new_password)
    await auth.delete_all_sessions(db, user["id"])
    return {"ok": True}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(auth.COOKIE_NAME)
    if token:
        await auth.delete_session(db, token)
    response.delete_cookie(
        key=auth.COOKIE_NAME, path="/", httponly=True, secure=True, samesite="lax",
    )
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return auth.public_user(user)


@api.post("/auth/password")
async def change_password(req: ChangePasswordRequest, request: Request,
                           user: dict = Depends(current_user)):
    if not auth.verify_password(req.current_password, user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await auth.update_password(db, user["id"], req.new_password)
    # Changing the password signs out every other device; this one stays
    # signed in since the caller just proved they know the (new) password.
    token = request.cookies.get(auth.COOKIE_NAME)
    await auth.delete_other_sessions(db, user["id"], token)
    return {"ok": True}


@api.post("/auth/logout-all")
async def logout_everywhere(response: Response, user: dict = Depends(current_user)):
    await auth.delete_all_sessions(db, user["id"])
    response.delete_cookie(
        key=auth.COOKIE_NAME, path="/", httponly=True, secure=True, samesite="lax",
    )
    return {"ok": True}


@api.delete("/auth/me")
async def delete_account(req: DeleteAccountRequest, response: Response,
                          user: dict = Depends(current_user)):
    if req.email.strip().lower() != user["email"]:
        raise HTTPException(status_code=400, detail="Email confirmation does not match")
    # Cascade: user's own sessions + reports. Shared filings/chunks corpus and
    # is_sample reports (user_id=None) are intentionally untouched.
    report_ids = [
        r["id"] for r in
        await db.reports.find({"user_id": user["id"]}, {"id": 1, "_id": 0}).to_list(None)
    ]
    await db.reports.delete_many({"user_id": user["id"]})
    if report_ids:
        await db.jobs.delete_many({"id": {"$in": report_ids}})
        for rid in report_ids:
            JOBS.pop(rid, None)
            JOB_QUEUES.pop(rid, None)
    await auth.delete_all_sessions(db, user["id"])
    await db.users.delete_one({"id": user["id"]})
    response.delete_cookie(
        key=auth.COOKIE_NAME, path="/", httponly=True, secure=True, samesite="lax",
    )
    return {"ok": True}


@api.post("/ingest/text")
async def ingest_text(req: IngestTextRequest, user: dict = Depends(current_user)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text is empty")
    result = await ingest_document(
        db, ticker=req.ticker, source=req.source, text=req.text,
        company_name=req.company_name,
    )
    return result


@api.post("/ingest/edgar")
async def ingest_edgar(req: IngestEdgarRequest, user: dict = Depends(current_user)):
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
async def ingest_samples(user: dict = Depends(current_user)):
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


def _reject_oversize(request: Request, limit: int) -> None:
    """Reject an upload by Content-Length before buffering the whole body into
    memory. The post-read len() check still backstops a missing/lying header."""
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > limit:
        raise HTTPException(status_code=413, detail=f"File exceeds {limit // (1024 * 1024)}MB")


@api.post("/ingest/audio")
async def ingest_audio(
    request: Request,
    file: UploadFile = File(...),
    ticker: str = Form(...),
    source: str = Form("Audio Transcript"),
    company_name: Optional[str] = Form(None),
    language: Optional[str] = Form("en"),
    user: dict = Depends(current_user),
):
    """Transcribe an audio file via OpenAI Whisper and ingest the transcript.

    Supports mp3, mp4, mpeg, mpga, m4a, wav, webm. Max 25MB.
    """
    ALLOWED = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail=f"Unsupported audio type: .{ext}")

    _reject_oversize(request, 25 * 1024 * 1024)
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
        from agents.llm import GEMINI_LOCK

        def _transcribe() -> str:
            # configure() is process-global; share llm.py's lock so a concurrent
            # pipeline Gemini call can't swap the key out from under us.
            with GEMINI_LOCK:
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(
                    os.environ.get("GEMINI_LIGHT_MODEL", "gemini-2.5-flash")
                )
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
    except Exception:
        # Don't echo the raw provider error: SDK exceptions can embed the API
        # key (Gemini passes it as a ?key=... URL param). Full detail is logged.
        logger.exception("gemini transcription failed")
        raise HTTPException(status_code=502, detail="Transcription failed. See server logs.")

    if not transcript or not transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript was empty")

    result = await ingest_document(
        db, ticker=ticker, source=source, text=transcript,
        company_name=company_name,
    )
    result["transcript_chars"] = len(transcript)
    result["transcript_preview"] = transcript[:400]
    return result


@api.post("/ingest/pdf")
async def ingest_pdf(
    request: Request,
    file: UploadFile = File(...),
    ticker: str = Form(...),
    source: str = Form("Annual Report"),
    company_name: Optional[str] = Form(None),
    user: dict = Depends(current_user),
):
    """Extract text from an uploaded PDF (e.g. an Indian annual report) and ingest it.

    Gives non-US stocks a rich narrative source, since yfinance only returns a
    2-line summary. Scanned/image PDFs extract nothing — we detect that and tell
    the user to paste the text instead.
    """
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext != "pdf":
        raise HTTPException(status_code=400, detail=f"Not a PDF: .{ext}")

    _reject_oversize(request, 50 * 1024 * 1024)
    raw = await file.read()
    if len(raw) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF exceeds 50MB")
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        text = await asyncio.to_thread(extract_pdf_text, raw)
    except Exception as e:
        logger.exception("pdf extraction failed")
        raise HTTPException(status_code=422, detail=f"Couldn't read PDF: {e}")

    if not text or not text.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "No text found — this looks like a scanned/image PDF. "
                "Copy the text and use 'Paste text' instead."
            ),
        )

    result = await ingest_document(
        db, ticker=ticker, source=source, text=text, company_name=company_name,
    )
    result["extracted_chars"] = len(text)
    result["text_preview"] = text[:400]
    return result


@api.get("/companies")
async def list_companies(user: dict = Depends(current_user)):
    """Ticker -> company name mapping derived from ingested filings."""
    rows = await db.companies.find({}, {"_id": 0}).to_list(1000)
    return {"companies": {r["ticker"]: r["name"] for r in rows if r.get("name")}}


@api.get("/companies/search")
async def companies_search(q: str, limit: int = 8, user: dict = Depends(current_user)):
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
async def ensure_company(req: EnsureRequest, user: dict = Depends(current_user)):
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

    # US companies: try SEC EDGAR first (full filings, richest source).
    if exch != "IN":
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

    # Indian companies: try BSE's latest annual-report PDF first — it's the rich
    # narrative source (MD&A, mgmt commentary) that yfinance can't give. Falls
    # through to yfinance below on any failure (anti-bot, scanned PDF, no code).
    if exch == "IN":
        try:
            bdoc = await fetch_bse_annual_report(ticker)
        except Exception as e:
            logger.warning("BSE annual-report fetch failed for %s: %s", ticker, e)
            bdoc = None
        if bdoc and bdoc.get("text"):
            result = await ingest_document(
                db, ticker=ticker, source=bdoc["source"], text=bdoc["text"],
                company_name=bdoc.get("company_name") or name,
            )
            result["action"] = "ingested_from_bse"
            result["url"] = bdoc.get("url")
            result["exchange"] = "IN"
            return result

    # Fallback (and primary path for non-US): Yahoo Finance profile — works for
    # any listed company worldwide (NSE/BSE tickers via .NS/.BO suffixes).
    try:
        ydoc = await fetch_yfinance(ticker, exch)
    except Exception as e:
        logger.warning("yfinance fetch failed for %s: %s", ticker, e)
        ydoc = None
    if ydoc and ydoc.get("text"):
        result = await ingest_document(
            db, ticker=ticker, source=ydoc["source"], text=ydoc["text"],
            company_name=ydoc.get("company_name"),
        )
        result["action"] = "ingested_from_yfinance"
        result["url"] = ydoc.get("url")
        result["exchange"] = exch or "US"
        return result

    raise HTTPException(
        status_code=404,
        detail=(
            f"Couldn't fetch data for {name or ticker} from SEC EDGAR or Yahoo "
            "Finance. Try 'Paste text' or 'Upload audio' on the Ingest page."
        ),
    )


@api.get("/filings")
async def list_filings(ticker: Optional[str] = None, user: dict = Depends(current_user)):
    q: dict = {}
    if ticker:
        q["ticker"] = ticker.upper()
    rows = await db.filings.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"filings": rows}


@api.get("/tickers")
async def list_tickers(user: dict = Depends(current_user)):
    tickers = await db.filings.distinct("ticker")
    return {"tickers": sorted(tickers)}


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

async def _run_pipeline(job_id: str, ticker: str, query: str,
                        prior_brief: str = "",
                        llm_provider: str | None = None,
                        llm_api_key: str | None = None,
                        llm_base_url: str | None = None,
                        llm_model: str | None = None,
                        user_id: str | None = None) -> None:
    from agents.llm import set_llm_context, reset_llm_context
    _tok = (
        set_llm_context(llm_provider, llm_api_key,
                        light_model=llm_model, heavy_model=llm_model, base_url=llm_base_url)
        if (llm_provider or llm_api_key) else None
    )
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
            "user_id": user_id,
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
    except asyncio.CancelledError:
        job["status"] = "cancelled"
        await db.jobs.update_one(
            {"id": job_id}, {"$set": {"status": "cancelled"}}
        )
        await push({
            "node": "pipeline",
            "status": "warn",
            "message": "Analysis cancelled by user",
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        # Don't persist/stream the raw error: provider SDK exceptions can embed
        # the API key (Gemini passes it as a ?key=... URL param), and this text
        # is written to Mongo and pushed to the client. Full detail is logged.
        logger.exception("pipeline failed")
        err = "Analysis failed. See server logs for details."
        job["status"] = "failed"
        job["error"] = err
        await db.jobs.update_one(
            {"id": job_id}, {"$set": {"status": "failed", "error": err}}
        )
        await push({
            "node": "pipeline",
            "status": "error",
            "message": f"Pipeline failed: {err}",
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    finally:
        if _tok is not None:
            reset_llm_context(_tok)
        await q.put(None)  # sentinel


@api.post("/reports/generate")
async def generate_report(req: GenerateRequest, user: dict = Depends(current_user)):
    ticker = req.ticker.strip().upper()
    if not ticker or not req.query.strip():
        raise HTTPException(status_code=400, detail="ticker and query are required")

    # Custom provider (bring-your-own OpenAI-compatible endpoint) is admin-only
    # — it's the only path that accepts a client-supplied base_url at all, so
    # gating it here also gates the SSRF surface below to a trusted operator.
    if (req.llm_provider == "custom" or req.llm_base_url) and not auth.is_admin(user):
        raise HTTPException(
            status_code=403,
            detail="The Custom LLM provider is restricted to admin accounts.",
        )

    # SSRF guard: the custom LLM endpoint is client-supplied and fetched by the
    # server, so it must not point at internal/loopback addresses.
    if req.llm_base_url:
        from agents.llm import assert_public_url
        try:
            assert_public_url(req.llm_base_url)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Custom LLM base URL must be a publicly reachable http(s) "
                    "address — the server calls it directly, so localhost and "
                    "private-network addresses aren't allowed. Use a hosted "
                    "endpoint, or tunnel a local LLM with ngrok/cloudflared."
                ),
            )

    # Require at least one ingested chunk for the ticker
    has_data = await db.filing_chunks.count_documents({"ticker": ticker}) > 0
    if not has_data:
        raise HTTPException(
            status_code=400,
            detail=f"No filings ingested for {ticker}. Ingest a filing first "
                   f"(POST /api/ingest/samples for demo data).",
        )

    # Cache: an identical (ticker, query) analysis with no follow-up context and
    # no new filings since is deterministic enough to reuse — saves time + quota
    # with zero accuracy cost (same sources, same verified brief). `no_cache`
    # forces a fresh run.
    if not req.context_report_id and not req.no_cache:
        latest_filing = await db.filings.find_one(
            {"ticker": ticker}, {"created_at": 1, "_id": 0}, sort=[("created_at", -1)]
        )
        cached = await db.reports.find_one(
            {"ticker": ticker, "query": req.query.strip()},
            {"id": 1, "created_at": 1, "fact_check_status": 1, "user_id": 1, "is_sample": 1, "_id": 0},
            sort=[("created_at", -1)],
        )
        if cached and (
            not latest_filing
            or cached.get("created_at", "") >= latest_filing.get("created_at", "")
        ):
            # A cache hit skips _run_pipeline (where user_id normally gets set),
            # so an unclaimed report a signed-in user reuses would otherwise
            # never show up in their history. Claim it once; leave already-owned
            # reports and curated public samples alone. (Unclaimed reports are a
            # pre-Phase-4 leftover — every report is user-owned going forward.)
            if not cached.get("user_id") and not cached.get("is_sample"):
                await db.reports.update_one(
                    {"id": cached["id"], "user_id": None}, {"$set": {"user_id": user["id"]}}
                )
            return {"job_id": cached["id"], "cached": True}

    # Cap concurrency (any signed-in user can still spin up unbounded pipelines
    # one at a time; this bounds the server-wide total) and prune finished jobs.
    active = sum(1 for j in JOBS.values() if j.get("status") in ("queued", "running"))
    if active >= MAX_ACTIVE_JOBS:
        raise HTTPException(
            status_code=429,
            detail="Too many analyses in progress. Retry in a moment.",
        )
    _reap_jobs()

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
    JOBS[job_id]["task"] = asyncio.create_task(
        _run_pipeline(job_id, ticker, req.query, prior_brief=prior_brief,
                      llm_provider=req.llm_provider, llm_api_key=req.llm_api_key,
                      llm_base_url=req.llm_base_url, llm_model=req.llm_model,
                      user_id=user["id"])
    )
    return {"job_id": job_id}


@api.post("/reports/{job_id}/cancel")
async def cancel_report(job_id: str, user: dict = Depends(current_user)):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.get("status") in ("completed", "failed", "cancelled"):
        return {"job_id": job_id, "status": job["status"], "note": "already finished"}
    task = job.get("task")
    if task and not task.done():
        task.cancel()
    job["status"] = "cancelled"
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "cancelled"}})
    return {"job_id": job_id, "status": "cancelled"}


@api.get("/reports/{job_id}/stream")
async def stream_report(job_id: str, user: dict = Depends(current_user)):
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
async def get_report(job_id: str, user: dict = Depends(current_user)):
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
async def list_reports(ticker: Optional[str] = None, limit: int = 50,
                        user: dict = Depends(current_user)):
    # Login wall means every caller is a real account now, so listing always
    # scopes to the caller's own reports plus the curated public samples —
    # never another user's history.
    q: dict = {"$or": [{"user_id": user["id"]}, {"is_sample": True}]}
    if ticker:
        q["ticker"] = ticker.upper()
    rows = (
        await db.reports.find(q, {"_id": 0, "events": 0, "source_documents": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return {"reports": rows}


@api.delete("/reports/{report_id}")
async def delete_report(report_id: str, user: dict = Depends(current_user)):
    # Scoped to the caller's own reports — unlike the read-side endpoints,
    # deletion is destructive/irreversible, so it can't lean on the report id
    # being an unguessable UUID the way GET/compare do. Without this, any
    # signed-in user could delete another user's report or (since `is_sample`
    # ids are visible to every caller via GET /reports) the shared public
    # samples. Samples have user_id=None, so this also makes them read-only.
    result = await db.reports.delete_one({"id": report_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="report not found")
    await db.jobs.delete_one({"id": report_id})
    # Also evict the in-memory job entry — get_report falls back to JOBS when
    # the Mongo doc is missing, so without this a deleted report still 200s
    # (as "completed") until the process restarts or _reap_jobs() evicts it.
    JOBS.pop(report_id, None)
    JOB_QUEUES.pop(report_id, None)
    return {"deleted": report_id}


@api.get("/companies/trending")
async def trending_companies(limit: int = 8, user: dict = Depends(current_user)):
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
async def rescore_reports(user: dict = Depends(current_user)):
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
async def compare_reports(req: CompareRequest, user: dict = Depends(current_user)):
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


@app.exception_handler(RequestValidationError)
async def _validation_error_handler(request: Request, exc: RequestValidationError):
    # FastAPI's default 422 handler echoes each invalid field's raw value
    # verbatim (pydantic's `input` key) — that would put a too-short password
    # in plaintext in the response body. Strip it app-wide.
    errors = jsonable_encoder(exc.errors())
    for e in errors:
        e.pop("input", None)
    return JSONResponse(status_code=422, content={"detail": errors})


app.add_middleware(
    CORSMiddleware,
    # Cookie-based sessions cross-origin (dev is frontend :3001 / backend
    # :8001) require credentials allowed AND an explicit origin — "*" is
    # invalid with credentials. Every tool route is gated behind the login
    # wall (Phase 4), so this is load-bearing, not just for manual testing.
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3001").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _warmup():
    """Preload embedding + rerank models in the background so the first pipeline
    run does not incur ~30-40s of cold-start model download / ONNX load."""
    await auth.ensure_indexes(db)

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
