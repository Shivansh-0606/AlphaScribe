"""Batch quality-eval harness for AlphaScribe — produces DEFENSIBLE aggregate
numbers for the RAGAS-lite scorecard (faithfulness / context precision /
answer relevance) across many (ticker, query) pairs.

It drives the REAL running pipeline over HTTP (ensure -> generate -> poll),
then aggregates the `scorecard` each report already carries. No re-implemented
scoring, no new dependencies (stdlib only). Throwaway dev tool — delete freely.

Every tool route is behind AlphaScribe's login wall (agents/auth.py), so this
logs in first (email/password of an existing account -- register one via the
frontend if you don't have one) and reuses the session cookie for every call.

Usage (server must be running on :8001 with an LLM key configured):
    python eval_scorecard.py --email you@x.com                    # prompts for password
    python eval_scorecard.py --email you@x.com --password secret  # or set
                                    ALPHASCRIBE_EMAIL / ALPHASCRIBE_PASSWORD
    python eval_scorecard.py --email you@x.com --pairs AAPL:"key risks" TCS:"margin trends"
    python eval_scorecard.py --base-url http://localhost:8001/api --email you@x.com
    python eval_scorecard.py --selftest             # verify the aggregation math (no login)

The printed averages are what you can honestly put on a resume — quote them WITH
the N (e.g. "avg faithfulness 0.9X across 8 automated evals"), never as N=1.
"""
from __future__ import annotations
import argparse
import getpass
import json
import os
import re
import statistics
import sys
import time
import urllib.error
import urllib.request

# (ticker, query) — mix of US (EDGAR) + India (yfinance/BSE) and query intents
# that actually elicit numeric claims (so faithfulness is meaningful).
DEFAULT_PAIRS = [
    ("AAPL", "What are the key financial risks and gross-margin trends?"),
    ("MSFT", "Summarize revenue growth and cloud-segment performance."),
    ("NVDA", "What is the bull case based on data-center revenue?"),
    ("TSLA", "What are the main risks to automotive gross margin?"),
    ("ORCL", "How is cloud revenue trending and what guidance was given?"),
    ("RELIANCE", "What are the key business segments and revenue drivers?"),
    ("TCS", "Summarize revenue growth and operating-margin trends."),
    ("INFY", "What are the main risks and guidance highlights?"),
]

METRICS = ("faithfulness", "context_precision", "answer_relevance", "overall")


def _post(base: str, path: str, body: dict, cookie: str = "",
          timeout: float = 30.0, capture_headers: bool = False):
    data = json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(base + path, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        parsed = json.loads(r.read())
        return (parsed, r.headers) if capture_headers else parsed


def _get(base: str, path: str, cookie: str = "", timeout: float = 30.0) -> dict:
    headers = {"Cookie": cookie} if cookie else {}
    req = urllib.request.Request(base + path, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def login(base: str, email: str, password: str) -> str:
    """POST /auth/login and return a raw `Cookie:` header value.

    The session cookie is set with Secure (server.py:_set_session_cookie),
    which a standards-compliant client would refuse to echo back over plain
    http://localhost. This is a script, not a browser, so it bypasses that by
    reading the token straight out of Set-Cookie and resending it manually.
    """
    body, headers = _post(base, "/auth/login",
                          {"email": email, "password": password, "remember": False},
                          timeout=15.0, capture_headers=True)
    raw = headers.get("Set-Cookie", "")
    m = re.search(r"as_session=([^;]+)", raw)
    if not m:
        raise RuntimeError(f"login succeeded but no session cookie in response: {raw!r}")
    return f"as_session={m.group(1)}"


def run_one(base: str, ticker: str, query: str, llm: dict, cookie: str,
            no_cache: bool, poll_timeout: float) -> dict | None:
    """Ensure -> generate -> poll. Returns the report's scorecard, or None on
    any best-effort failure (missing data source, pipeline failure)."""
    ticker = ticker.strip().upper()
    try:
        _post(base, "/companies/ensure", {"ticker": ticker, "refresh": False},
              cookie=cookie, timeout=180.0)
    except urllib.error.HTTPError as e:
        print(f"  ! {ticker}: ensure failed ({e.code}) — skipping", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ! {ticker}: ensure error ({e}) — skipping", file=sys.stderr)
        return None

    gen_body = {"ticker": ticker, "query": query, "no_cache": no_cache, **llm}
    try:
        res = _post(base, "/reports/generate", gen_body, cookie=cookie, timeout=30.0)
    except urllib.error.HTTPError as e:
        print(f"  ! {ticker}: generate rejected ({e.code}) — skipping", file=sys.stderr)
        return None
    job_id = res.get("job_id")
    if not job_id:
        return None

    deadline = time.time() + poll_timeout
    while time.time() < deadline:
        doc = _get(base, f"/reports/{job_id}", cookie=cookie)
        if "report" in doc:                       # completed
            return doc["report"].get("scorecard")
        if doc.get("status") in ("failed", "cancelled"):
            print(f"  ! {ticker}: pipeline {doc['status']} — skipping", file=sys.stderr)
            return None
        time.sleep(3.0)
    print(f"  ! {ticker}: timed out after {poll_timeout:.0f}s — skipping", file=sys.stderr)
    return None


def summarize(cards: list[dict]) -> dict:
    """Aggregate a list of per-report scorecards into resume-grade stats."""
    out: dict = {"n_reports": len(cards)}
    for m in METRICS:
        vals = [c[m] for c in cards if m in c]
        if vals:
            out[m] = {
                "mean": round(statistics.mean(vals), 3),
                "stdev": round(statistics.stdev(vals), 3) if len(vals) > 1 else 0.0,
                "min": round(min(vals), 3),
                "max": round(max(vals), 3),
                "n": len(vals),
            }
    # micro-averaged faithfulness = total supported claims / total claims
    total_claims = sum(c.get("n_claims", 0) for c in cards)
    total_supported = sum(c.get("n_supported", 0) for c in cards)
    out["faithfulness_micro"] = (
        round(total_supported / total_claims, 3) if total_claims else None
    )
    out["total_claims"] = total_claims
    out["total_supported"] = total_supported
    return out


def _selftest() -> None:
    cards = [
        {"faithfulness": 1.0, "context_precision": 0.5, "answer_relevance": 0.4,
         "overall": 0.633, "n_claims": 4, "n_supported": 4},
        {"faithfulness": 0.5, "context_precision": 1.0, "answer_relevance": 0.6,
         "overall": 0.7, "n_claims": 2, "n_supported": 1},
    ]
    s = summarize(cards)
    assert s["n_reports"] == 2
    assert s["faithfulness"]["mean"] == 0.75, s["faithfulness"]
    assert s["context_precision"]["mean"] == 0.75
    # micro faithfulness = (4+1)/(4+2) = 5/6
    assert s["faithfulness_micro"] == round(5 / 6, 3), s["faithfulness_micro"]
    assert summarize([])["n_reports"] == 0        # empty must not crash
    print("selftest OK")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base-url", default="http://localhost:8001/api")
    ap.add_argument("--email", default=os.environ.get("ALPHASCRIBE_EMAIL"),
                    help="existing AlphaScribe account (or set ALPHASCRIBE_EMAIL)")
    ap.add_argument("--password", default=os.environ.get("ALPHASCRIBE_PASSWORD"),
                    help="prompted for if omitted (or set ALPHASCRIBE_PASSWORD)")
    ap.add_argument("--pairs", nargs="*", default=None,
                    help='TICKER:"query" items; overrides the default set')
    ap.add_argument("--use-cache", action="store_true",
                    help="reuse cached reports (default: force fresh runs)")
    ap.add_argument("--poll-timeout", type=float, default=420.0)
    ap.add_argument("--llm-provider", default=None)
    ap.add_argument("--llm-key", default=None)
    ap.add_argument("--llm-model", default=None)
    ap.add_argument("--llm-base-url", default=None)
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        _selftest()
        return 0

    if not args.email:
        ap.error("--email is required (or set ALPHASCRIBE_EMAIL) — "
                 "register an account via the frontend first if you don't have one")
    password = args.password or getpass.getpass(f"Password for {args.email}: ")
    try:
        cookie = login(args.base_url, args.email, password)
    except urllib.error.HTTPError as e:
        print(f"Login failed ({e.code}). Wrong password, or no account for "
              f"{args.email} yet — register via the frontend first.", file=sys.stderr)
        return 1
    print(f"Logged in as {args.email}\n")

    if args.pairs:
        pairs = []
        for p in args.pairs:
            t, _, q = p.partition(":")
            if not q:
                ap.error(f'bad --pairs item {p!r}; use TICKER:"query"')
            pairs.append((t, q))
    else:
        pairs = DEFAULT_PAIRS

    llm = {}
    if args.llm_provider:
        llm["llm_provider"] = args.llm_provider
    if args.llm_key:
        llm["llm_api_key"] = args.llm_key
    if args.llm_model:
        llm["llm_model"] = args.llm_model
    if args.llm_base_url:
        llm["llm_base_url"] = args.llm_base_url

    cards, rows = [], []
    for i, (ticker, query) in enumerate(pairs, 1):
        print(f"[{i}/{len(pairs)}] {ticker}: {query}")
        card = run_one(args.base_url, ticker, query, llm, cookie,
                       no_cache=not args.use_cache, poll_timeout=args.poll_timeout)
        if card:
            cards.append(card)
            rows.append((ticker, card))
            print(f"      faith={card.get('faithfulness')} "
                  f"ctx={card.get('context_precision')} "
                  f"rel={card.get('answer_relevance')} "
                  f"claims={card.get('n_supported')}/{card.get('n_claims')}")

    if not cards:
        print("\nNo successful reports — is the server up (:8001) and an LLM key set?")
        return 1

    s = summarize(cards)
    print("\n" + "=" * 64)
    print(f"AGGREGATE over {s['n_reports']} reports")
    print("=" * 64)
    print(f"{'metric':<20}{'mean':>8}{'stdev':>8}{'min':>8}{'max':>8}")
    for m in METRICS:
        if m in s:
            v = s[m]
            print(f"{m:<20}{v['mean']:>8}{v['stdev']:>8}{v['min']:>8}{v['max']:>8}")
    print(f"\nfaithfulness (micro, all claims): {s['faithfulness_micro']}  "
          f"({s['total_supported']}/{s['total_claims']} claims supported)")

    print("\n--- honest resume phrasing (only if the N above is acceptable) ---")
    if "faithfulness" in s and "context_precision" in s:
        print(
            f"Benchmarked output with a RAGAS-style scorecard across "
            f"{s['n_reports']} US/India equity reports: mean faithfulness "
            f"{s['faithfulness']['mean']:.2f}, context precision "
            f"{s['context_precision']['mean']:.2f}."
        )
    print("\n(paste the raw numbers to me and I'll fit them to the bullet + styling)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
