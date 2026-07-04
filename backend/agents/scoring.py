"""RAGAS-lite quality scoring for AlphaScribe reports.

Computes three heuristic quality metrics without external dependencies:

- **faithfulness**       fraction of numeric claims marked supported by the
                         fact-checker (higher = more grounded).
- **context_precision**  fraction of retrieved chunks that are actually cited
                         in the final draft via `[n]` markers.
- **answer_relevance**   Jaccard-like token overlap between the draft and the
                         user query (proxy for "did we answer the question").
"""
from __future__ import annotations
import re


_CITATION_RE = re.compile(r"\[(\d+)\]")
_TOKEN_RE = re.compile(r"[a-zA-Z]{3,}")


def _tokens(text: str) -> set[str]:
    stop = {"the", "and", "for", "with", "that", "this", "from", "into",
            "over", "under", "about", "have", "has", "was", "were", "are",
            "will", "been", "which", "what", "how", "why", "when", "who",
            "did", "does", "your", "you", "our"}
    return {t.lower() for t in _TOKEN_RE.findall(text) if t.lower() not in stop}


def compute_scorecard(report: dict) -> dict:
    draft = report.get("draft_report", "") or ""
    docs = report.get("source_documents", []) or []
    query = report.get("query", "") or ""
    verified = report.get("verified_claims", []) or []

    # faithfulness
    if verified:
        supported = sum(1 for c in verified if c.get("supported"))
        faithfulness = supported / len(verified)
    else:
        # No numeric claims -> if fact-check passed trivially, credit as 1.0
        faithfulness = 1.0 if report.get("fact_check_status") else 0.0

    # context precision — count distinct [n] markers actually used
    cited_ids = {int(m) for m in _CITATION_RE.findall(draft) if m.isdigit()}
    cited_ids = {i for i in cited_ids if 1 <= i <= len(docs)}
    context_precision = (len(cited_ids) / len(docs)) if docs else 0.0

    # answer relevance — token overlap between query and draft
    q_tokens = _tokens(query)
    d_tokens = _tokens(draft)
    if q_tokens and d_tokens:
        answer_relevance = len(q_tokens & d_tokens) / len(q_tokens)
    else:
        answer_relevance = 0.0

    # overall = simple average
    overall = (faithfulness + context_precision + answer_relevance) / 3.0

    return {
        "faithfulness": round(faithfulness, 3),
        "context_precision": round(context_precision, 3),
        "answer_relevance": round(answer_relevance, 3),
        "overall": round(overall, 3),
        "cited_sources": sorted(cited_ids),
        "n_claims": len(verified),
        "n_supported": sum(1 for c in verified if c.get("supported")),
    }
