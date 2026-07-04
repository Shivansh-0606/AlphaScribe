"""Pydantic schemas used by extractor, tone, and fact-checker nodes."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class FinancialsSchema(BaseModel):
    revenue: Optional[str] = Field(default=None, description="Total revenue (with unit, e.g. '$94.9B')")
    revenue_yoy: Optional[str] = Field(default=None, description="Year-over-year revenue growth, e.g. '+6%'")
    eps: Optional[str] = Field(default=None, description="Diluted EPS, e.g. '$1.64'")
    net_income: Optional[str] = Field(default=None, description="Net income, e.g. '$25.0B'")
    operating_margin: Optional[str] = Field(default=None, description="Operating margin %, e.g. '30.2%'")
    free_cash_flow: Optional[str] = Field(default=None, description="Free cash flow, e.g. '$25.9B'")
    guidance: Optional[str] = Field(default=None, description="Forward guidance quoted or summarized")


class ToneSchema(BaseModel):
    sentiment: str = Field(description="One of: Bullish, Bearish, Neutral")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence 0..1")
    summary: str = Field(description="Two-to-three sentence summary of management tone")
    key_risks: list[str] = Field(default_factory=list, description="Top 3-5 risk factors")
    key_positives: list[str] = Field(default_factory=list, description="Top 3-5 positive drivers")


class ClaimCheck(BaseModel):
    claim: str = Field(description="A specific factual/numeric claim from the draft")
    supported: bool = Field(description="Whether the claim is directly supported by source docs")
    evidence: Optional[str] = Field(default=None, description="Quoted supporting text, if any")
    reason: Optional[str] = Field(default=None, description="Explanation when not supported")


class FactCheckSchema(BaseModel):
    claims: list[ClaimCheck] = Field(default_factory=list)
