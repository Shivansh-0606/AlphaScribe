"""LangGraph agent nodes for AlphaScribe."""
from __future__ import annotations
import re
from datetime import datetime, timezone
from typing import Any
from .state import AgentState
from .schemas import FinancialsSchema, ToneSchema, FactCheckSchema
from .llm import chat_json, chat_text, DEFAULT_LIGHT_MODEL, DEFAULT_HEAVY_MODEL


def _event(node: str, status: str, message: str, **extra) -> dict:
    return {
        "node": node,
        "status": status,        # "start" | "ok" | "warn" | "error"
        "message": message,
        "ts": datetime.now(timezone.utc).isoformat(),
        **extra,
    }


def _format_docs(docs: list[dict], *, max_chars: int = 8000) -> str:
    out: list[str] = []
    total = 0
    for i, d in enumerate(docs, start=1):
        header = f"[{i}] {d.get('source','?')} (chunk {d.get('chunk_idx','?')})"
        body = d["text"].strip()
        block = f"{header}\n{body}"
        if total + len(block) > max_chars:
            break
        out.append(block)
        total += len(block)
    return "\n\n---\n\n".join(out)


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

async def retriever_node(state: AgentState, *, db) -> dict:
    from .retrieval import retrieve
    docs, meta = await retrieve(db, state["ticker"], state["query"], top_k=8)
    stages = []
    if meta.get("bm25"):
        stages.append("bm25")
    if meta.get("dense"):
        stages.append("dense")
    if meta.get("reranker"):
        stages.append("cross-encoder")
    stage_str = "+".join(stages) if stages else "empty"
    return {
        "source_documents": docs,
        "trace": [_event("retriever", "ok",
                         f"Retrieved {len(docs)}/{meta.get('total_chunks',0)} chunks via {stage_str}",
                         count=len(docs), stages=stages,
                         total_chunks=meta.get("total_chunks", 0))],
    }


async def financial_extractor_node(state: AgentState) -> dict:
    docs = state.get("source_documents", [])
    if not docs:
        return {
            "extracted_data": {},
            "trace": [_event("extractor", "warn", "No source docs; skipping extraction")],
        }
    system = (
        "You are a precise financial-data extractor. Extract line items from the "
        "provided SEC filing / earnings-call excerpts. Only return values that appear "
        "explicitly in the text. If a field is not present, set it to null."
    )
    user = (
        f"Ticker: {state['ticker']}\nUser question: {state['query']}\n\n"
        f"SOURCE EXCERPTS:\n{_format_docs(docs)}\n\n"
        "Extract the key financials for the most recent reporting period referenced."
    )
    try:
        result: FinancialsSchema = await chat_json(system, user, FinancialsSchema,
                                                    model=DEFAULT_LIGHT_MODEL)
        return {
            "extracted_data": result.model_dump(exclude_none=False),
            "trace": [_event("extractor", "ok", "Structured financials extracted")],
        }
    except Exception as e:
        return {
            "extracted_data": {},
            "trace": [_event("extractor", "error", f"Extraction failed: {e}")],
        }


async def tone_risk_node(state: AgentState) -> dict:
    docs = state.get("source_documents", [])
    if not docs:
        return {
            "sentiment_analysis": {},
            "trace": [_event("tone", "warn", "No source docs; skipping tone analysis")],
        }
    system = (
        "You are an equity analyst evaluating management commentary. Score sentiment "
        "as Bullish, Bearish, or Neutral with a confidence between 0 and 1. "
        "Extract concrete risks and positive drivers grounded in the text."
    )
    user = (
        f"Ticker: {state['ticker']}\n\n"
        f"COMMENTARY EXCERPTS:\n{_format_docs(docs)}\n\n"
        "Return sentiment, confidence, a short summary, key risks and key positives."
    )
    try:
        result: ToneSchema = await chat_json(system, user, ToneSchema,
                                              model=DEFAULT_LIGHT_MODEL)
        return {
            "sentiment_analysis": result.model_dump(),
            "trace": [_event("tone", "ok",
                             f"Sentiment: {result.sentiment} ({result.confidence:.2f})")],
        }
    except Exception as e:
        return {
            "sentiment_analysis": {},
            "trace": [_event("tone", "error", f"Tone analysis failed: {e}")],
        }


async def synthesizer_node(state: AgentState) -> dict:
    docs = state.get("source_documents", [])
    fins = state.get("extracted_data") or {}
    tone = state.get("sentiment_analysis") or {}
    prev_errors = state.get("validation_errors") or []
    prior_brief = state.get("prior_brief") or ""
    retry = state.get("retry_count", 0)

    correction = ""
    if prev_errors:
        bullet = "\n".join(f"- {e}" for e in prev_errors)
        correction = (
            "\n\nIMPORTANT: The previous draft had UNSUPPORTED claims flagged by the "
            "fact-checker. Rewrite so every number/claim is directly grounded in the "
            "sources. Remove or hedge unsupported statements. Flagged issues:\n"
            f"{bullet}"
        )

    context_block = ""
    if prior_brief:
        # cap to ~1200 chars so it doesn't dominate the prompt
        excerpt = prior_brief[:1200]
        context_block = (
            "\n\n## Previous brief (context for this follow-up)\n"
            f"{excerpt}\n\n"
            "Answer the user's follow-up in your own new brief. Do NOT copy the "
            "previous brief verbatim — build on it, focusing specifically on the "
            "new question. If the previous brief already answered part of it, "
            "reference the conclusion briefly and add the new evidence.\n"
        )

    system = (
        "You are a senior equity research analyst. Write a concise, decision-grade "
        "research brief in Markdown. Cite sources inline as [1], [2], ... using the "
        "chunk index provided. Do NOT invent numbers. If a datapoint is not in the "
        "sources, omit it or say 'not disclosed'. Keep it under 500 words."
    )
    user = (
        f"# Ticker: {state['ticker']}\n"
        f"# User query: {state['query']}\n\n"
        f"## Structured financials (from extractor)\n{fins}\n\n"
        f"## Tone & risk (from analyst)\n{tone}\n\n"
        f"## Source excerpts (cite by number)\n{_format_docs(docs)}"
        f"{context_block}"
        f"{correction}\n\n"
        "Deliver a Markdown brief with sections: "
        "**Snapshot**, **Financial Highlights**, **Management Tone**, "
        "**Key Risks**, **Bottom Line**."
    )
    try:
        draft = await chat_text(system, user, model=DEFAULT_HEAVY_MODEL)
        return {
            "draft_report": draft.strip(),
            "trace": [_event("synthesizer", "ok",
                             f"Draft written ({len(draft)} chars)"
                             + (f" [retry {retry}]" if retry else ""))],
        }
    except Exception as e:
        return {
            "draft_report": "",
            "trace": [_event("synthesizer", "error", f"Synthesis failed: {e}")],
        }


def _extract_candidate_claims(draft: str) -> list[str]:
    """Pull sentences that contain numeric evidence, which are the highest-risk claims."""
    sentences = re.split(r"(?<=[\.\?\!])\s+", draft)
    number_re = re.compile(r"\$[\d,\.]+[MBK]?|\d+(?:\.\d+)?\s?%|[+-]?\d+(?:\.\d+)?\s?(?:bps|pp)")
    claims = [s.strip() for s in sentences if number_re.search(s)]
    # dedupe & cap
    seen: set[str] = set()
    out: list[str] = []
    for c in claims:
        k = c.lower()[:120]
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
        if len(out) >= 12:
            break
    return out


async def fact_checker_node(state: AgentState) -> dict:
    draft = state.get("draft_report", "")
    docs = state.get("source_documents", [])
    retry = state.get("retry_count", 0)

    if not draft:
        return {
            "fact_check_status": False,
            "validation_errors": ["No draft to fact-check"],
            "verified_claims": [],
            "retry_count": retry + 1,
            "trace": [_event("fact_checker", "error", "No draft available")],
        }

    claims = _extract_candidate_claims(draft)
    if not claims:
        return {
            "fact_check_status": True,
            "validation_errors": [],
            "verified_claims": [],
            "retry_count": retry,
            "trace": [_event("fact_checker", "ok",
                             "No numeric claims detected — trivially accepted")],
        }

    system = (
        "You are a strict fact-checker. For every claim, decide if it is directly "
        "supported by the source excerpts. A number must appear (or be a trivial "
        "computation) in the source text; otherwise mark supported=false. Provide a "
        "short quoted evidence string when supported."
    )
    claim_list = "\n".join(f"{i+1}. {c}" for i, c in enumerate(claims))
    user = (
        f"SOURCE EXCERPTS:\n{_format_docs(docs)}\n\n"
        f"CLAIMS TO CHECK:\n{claim_list}\n\n"
        "Return one entry per claim in order."
    )
    try:
        result: FactCheckSchema = await chat_json(system, user, FactCheckSchema,
                                                   model=DEFAULT_HEAVY_MODEL)
    except Exception as e:
        return {
            "fact_check_status": False,
            "validation_errors": [f"Fact-check failed: {e}"],
            "verified_claims": [],
            "retry_count": retry + 1,
            "trace": [_event("fact_checker", "error", f"Fact-check failed: {e}")],
        }

    errors: list[str] = []
    verified = [c.model_dump() for c in result.claims]
    for c in result.claims:
        if not c.supported:
            errors.append(f"UNSUPPORTED: \"{c.claim}\" — {c.reason or 'no evidence found'}")

    passed = len(errors) == 0
    return {
        "fact_check_status": passed,
        "validation_errors": errors,
        "verified_claims": verified,
        "retry_count": retry if passed else retry + 1,
        "trace": [_event(
            "fact_checker",
            "ok" if passed else "warn",
            f"Checked {len(claims)} claims — {len(errors)} flagged" if not passed
            else f"All {len(claims)} claims verified",
            flagged=len(errors),
            total=len(claims),
        )],
    }


def fact_check_router(state: AgentState) -> str:
    """Conditional edge: retry synthesis if fact-check failed and retries remain."""
    if state.get("fact_check_status"):
        return "accept"
    if state.get("retry_count", 0) < 2:
        return "retry"
    return "give_up"
