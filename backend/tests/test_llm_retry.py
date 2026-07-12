"""Unit check for chat_text's retry policy in agents/llm.py.

NonRetryableLLMError (bad config / truncated output) must fail fast — retrying
it just burns more LLM calls + backoff. Ordinary errors still retry up to 4x.
No network: _generate_sync is stubbed with a call counter.

    python backend/tests/test_llm_retry.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agents.llm as llm


def test_non_retryable_fails_fast():
    calls = {"n": 0}

    def boom(*a, **k):
        calls["n"] += 1
        raise llm.NonRetryableLLMError("bad config")

    llm._generate_sync = boom
    try:
        asyncio.run(llm.chat_text("s", "u"))
    except llm.NonRetryableLLMError:
        pass
    else:
        raise AssertionError("expected NonRetryableLLMError to propagate")
    assert calls["n"] == 1, f"non-retryable error retried {calls['n']}x (expected 1)"


def test_ordinary_error_retries_four_times():
    calls = {"n": 0}

    def boom(*a, **k):
        calls["n"] += 1
        raise RuntimeError("transient")

    llm._generate_sync = boom
    real_sleep = asyncio.sleep
    asyncio.sleep = lambda *a, **k: real_sleep(0)  # skip the real backoff
    try:
        try:
            asyncio.run(llm.chat_text("s", "u"))
        except RuntimeError:
            pass
    finally:
        asyncio.sleep = real_sleep
    assert calls["n"] == 4, f"expected 4 attempts, got {calls['n']}"


if __name__ == "__main__":
    test_non_retryable_fails_fast()
    test_ordinary_error_retries_four_times()
    print("ok: non-retryable fails fast (1 call); ordinary errors retry 4x")
