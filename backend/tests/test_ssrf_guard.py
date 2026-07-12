"""Unit check for the SSRF guard on the custom LLM base_url (agents/llm.py).

assert_public_url must reject internal/loopback/metadata targets and bad
schemes, while allowing an ordinary public host. Uses numeric IPs so it needs
no DNS/network.

    python backend/tests/test_ssrf_guard.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.llm import assert_public_url

BLOCKED = [
    "http://127.0.0.1:8001",            # loopback
    "http://169.254.169.254/latest",    # cloud metadata (link-local)
    "http://10.0.0.5/v1",               # private
    "http://192.168.1.1",               # private
    "https://0.0.0.0",                  # unspecified
    "ftp://example.com",                # bad scheme
    "not-a-url",                        # no scheme/host
]

ALLOWED = [
    "https://1.1.1.1/v1",               # public IP, no DNS needed
    "https://8.8.8.8",                  # public IP
]


def test_ssrf_guard():
    for url in BLOCKED:
        try:
            assert_public_url(url)
        except ValueError:
            continue
        raise AssertionError(f"should have blocked: {url}")

    for url in ALLOWED:
        assert_public_url(url)  # must not raise


if __name__ == "__main__":
    test_ssrf_guard()
    print("ok: SSRF guard blocks internal targets, allows public")
