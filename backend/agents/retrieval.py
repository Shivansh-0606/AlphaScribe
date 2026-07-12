"""Hybrid retrieval: BM25 + dense embeddings (fastembed) + cross-encoder rerank.

The dense embedder and cross-encoder are lazily initialized on first use and
cached at module scope so subsequent queries are fast. If model loading fails
(e.g. offline container), we gracefully degrade to BM25-only.
"""
from __future__ import annotations
import math
import re
import threading
from typing import Any
import numpy as np
from rank_bm25 import BM25Okapi

_TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9%$\.-]+")

# Lazy singletons
_EMBEDDER = None
_RERANKER = None
_LOAD_LOCK = threading.Lock()
_EMBEDDER_STATUS = "not_loaded"    # "ready" | "not_loaded" | "failed"
_RERANKER_STATUS = "not_loaded"


def _get_embedder():
    global _EMBEDDER, _EMBEDDER_STATUS
    if _EMBEDDER is not None or _EMBEDDER_STATUS == "failed":
        return _EMBEDDER
    with _LOAD_LOCK:
        if _EMBEDDER is not None or _EMBEDDER_STATUS == "failed":
            return _EMBEDDER
        try:
            from fastembed import TextEmbedding
            _EMBEDDER = TextEmbedding("BAAI/bge-small-en-v1.5")
            _EMBEDDER_STATUS = "ready"
        except Exception:
            _EMBEDDER_STATUS = "failed"
            _EMBEDDER = None
    return _EMBEDDER


def _get_reranker():
    global _RERANKER, _RERANKER_STATUS
    if _RERANKER is not None or _RERANKER_STATUS == "failed":
        return _RERANKER
    with _LOAD_LOCK:
        if _RERANKER is not None or _RERANKER_STATUS == "failed":
            return _RERANKER
        try:
            from fastembed.rerank.cross_encoder import TextCrossEncoder
            _RERANKER = TextCrossEncoder(model_name="Xenova/ms-marco-MiniLM-L-6-v2")
            _RERANKER_STATUS = "ready"
        except Exception:
            _RERANKER_STATUS = "failed"
            _RERANKER = None
    return _RERANKER


def retrieval_status() -> dict:
    return {
        "embedder": _EMBEDDER_STATUS,
        "reranker": _RERANKER_STATUS,
    }


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _minmax(scores: list[float]) -> list[float]:
    if not scores:
        return []
    lo, hi = min(scores), max(scores)
    if hi - lo < 1e-9:
        return [0.5 for _ in scores]
    return [(s - lo) / (hi - lo) for s in scores]


def embed_texts(texts: list[str]) -> np.ndarray | None:
    emb = _get_embedder()
    if emb is None:
        return None
    return np.asarray(list(emb.embed(texts)), dtype=np.float32)


def embed_query(text: str) -> np.ndarray | None:
    emb = _get_embedder()
    if emb is None:
        return None
    # bge query prompt template improves recall a bit
    return np.asarray(list(emb.query_embed([text]))[0], dtype=np.float32)


def rerank_pairs(query: str, texts: list[str]) -> list[float] | None:
    rr = _get_reranker()
    if rr is None:
        return None
    try:
        return list(rr.rerank(query, texts))
    except Exception:
        return None


def chunk_text(text: str, *, chunk_size: int = 900, overlap: int = 120) -> list[str]:
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paragraphs:
        if len(buf) + len(p) + 2 <= chunk_size:
            buf = f"{buf}\n\n{p}" if buf else p
        else:
            if buf:
                chunks.append(buf)
            if len(p) <= chunk_size:
                buf = p
            else:
                parts = re.split(r"(?<=[\.\?\!])\s+", p)
                buf = ""
                for s in parts:
                    if len(buf) + len(s) + 1 <= chunk_size:
                        buf = f"{buf} {s}".strip()
                    else:
                        if buf:
                            chunks.append(buf)
                        buf = s
    if buf:
        chunks.append(buf)
    if overlap > 0 and len(chunks) > 1:
        out = [chunks[0]]
        for i in range(1, len(chunks)):
            tail = chunks[i - 1][-overlap:]
            out.append(tail + " " + chunks[i])
        chunks = out
    return chunks


async def retrieve(
    db: Any,
    ticker: str,
    query: str,
    *,
    top_k: int = 8,
    candidate_k: int = 24,
) -> tuple[list[dict], dict]:
    """Hybrid retrieval.

    1) BM25 over all ticker chunks -> top `candidate_k`.
    2) Dense cosine (if embedder available) -> merge normalized scores.
    3) Cross-encoder rerank (if reranker available) -> final ordering.
    Returns (docs, meta) where meta describes which stages were used.
    """
    # Newest-first so that when a ticker has >2000 chunks (repeated re-ingests),
    # the cap drops the oldest rather than silently dropping the latest filing.
    # ponytail: no dedup/replace on re-ingest, so stale chunks still coexist with
    # fresh ones; add a doc_id/version filter if that ever causes bad retrievals.
    cursor = db.filing_chunks.find({"ticker": ticker.upper()}, {"_id": 0}).sort("created_at", -1)
    chunks: list[dict] = await cursor.to_list(2000)
    meta = {"total_chunks": len(chunks), "bm25": True, "dense": False, "reranker": False}
    if not chunks:
        return [], meta

    # ---- Stage 1: BM25 ----
    corpus_tokens = [_tokenize(c["text"]) for c in chunks]
    bm25 = BM25Okapi(corpus_tokens)
    q_tokens = _tokenize(query)
    bm_scores = bm25.get_scores(q_tokens)
    bm_norm = _minmax([float(s) for s in bm_scores])

    # ---- Stage 2: Dense ----
    dense_norm: list[float] | None = None
    if len(chunks) >= 2:
        q_emb = embed_query(query)
        if q_emb is not None:
            # Use cached embeddings (stored at ingest) when every chunk has one;
            # otherwise embed on the fly. This is the big per-query speedup.
            cached = [c.get("embedding") for c in chunks]
            if all(v is not None for v in cached):
                emb = np.asarray(cached, dtype=np.float32)
            else:
                emb = embed_texts([c["text"] for c in chunks])
            if emb is not None and emb.size:
                # cosine (rows already l2-normalized by fastembed)
                sims = emb @ q_emb / (np.linalg.norm(emb, axis=1) * np.linalg.norm(q_emb) + 1e-9)
                dense_norm = _minmax([float(x) for x in sims])
                meta["dense"] = True

    # ---- Stage 3: Numeric boost + fusion ----
    number_re = re.compile(r"\$[\d,\.]+|[\d,\.]+%|[\d]{4,}")
    fused = []
    for i, c in enumerate(chunks):
        c.pop("embedding", None)  # don't carry vectors downstream (report/prompt bloat)
        b = bm_norm[i]
        d = dense_norm[i] if dense_norm is not None else 0.0
        # weighted fusion: 55% BM25, 40% dense, 5% numeric-evidence heuristic
        score = 0.55 * b + (0.40 * d if dense_norm is not None else 0.0)
        num_hits = len(number_re.findall(c["text"]))
        score += 0.05 * min(num_hits, 6) / 6.0
        # if only BM25 available, weight BM25 fully
        if dense_norm is None:
            score = 0.95 * b + 0.05 * min(num_hits, 6) / 6.0
        fused.append({**c, "score": float(score), "_bm25": b, "_dense": d})
    fused.sort(key=lambda x: x["score"], reverse=True)
    candidates = fused[:candidate_k]

    # ---- Stage 4: Cross-encoder rerank on candidates ----
    ce_scores = rerank_pairs(query, [c["text"] for c in candidates])
    if ce_scores is not None:
        meta["reranker"] = True
        ce_norm = _minmax(ce_scores)
        for c, s, raw in zip(candidates, ce_norm, ce_scores):
            # blend: 70% CE, 30% prior fused score
            c["_ce"] = float(raw)
            c["score"] = float(0.7 * s + 0.3 * c["score"])
        candidates.sort(key=lambda x: x["score"], reverse=True)

    return candidates[:top_k], meta
