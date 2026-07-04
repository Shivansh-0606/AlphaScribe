"""LangGraph state definitions for AlphaScribe."""
from __future__ import annotations
from typing import TypedDict, Annotated
from operator import add


class SourceDocument(TypedDict):
    doc_id: str
    ticker: str
    source: str            # e.g. "10-Q FY24 Q3", "Earnings Call Q3-24"
    chunk_idx: int
    text: str
    score: float


class ExtractedFinancials(TypedDict, total=False):
    revenue: str
    revenue_yoy: str
    eps: str
    net_income: str
    guidance: str
    operating_margin: str
    free_cash_flow: str


class ToneAnalysis(TypedDict, total=False):
    sentiment: str          # "Bullish" | "Bearish" | "Neutral"
    confidence: float       # 0..1
    summary: str
    key_risks: list[str]
    key_positives: list[str]


class AgentState(TypedDict, total=False):
    # inputs
    ticker: str
    query: str
    prior_brief: str        # optional — set for follow-up questions to give
                             # the synthesizer conversational context

    # retrieval
    source_documents: list[SourceDocument]

    # parallel extraction outputs
    extracted_data: ExtractedFinancials
    sentiment_analysis: ToneAnalysis

    # synthesis
    draft_report: str

    # fact checking
    fact_check_status: bool
    validation_errors: list[str]
    verified_claims: list[dict]
    retry_count: int

    # observability trace (list of pipeline events, appended by each node)
    trace: Annotated[list[dict], add]
