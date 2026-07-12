"""Unit check for the Gemini key-isolation fix in agents/llm.py.

google.generativeai.configure() sets a PROCESS-GLOBAL key. Without a lock held
across configure+generate, two concurrent requests with different keys clobber
each other and a call can run under the wrong caller's key. This fakes the SDK
and asserts each concurrent call sees only its own key.

Standalone (no server, no network, no real key):
    python backend/tests/test_gemini_key_isolation.py
"""
import os
import sys
import time
import types
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _install_fake_genai():
    """Register a fake `google.generativeai` whose generate_content reports the
    globally-configured key it observed — after a delay that widens the race."""
    mod = types.ModuleType("google.generativeai")
    state = {"key": None}

    def configure(api_key=None):
        state["key"] = api_key
        time.sleep(0.02)                 # widen the configure->generate window

    class GenerativeModel:
        def __init__(self, model_name=None, system_instruction=None):
            pass

        def generate_content(self, user, **kwargs):
            # SDK reads the process-global key here; a competing configure()
            # during the window above corrupts it unless the caller held a lock.
            return types.SimpleNamespace(text=state["key"])

    mod.configure = configure
    mod.GenerativeModel = GenerativeModel
    google_pkg = sys.modules.get("google") or types.ModuleType("google")
    google_pkg.generativeai = mod
    sys.modules["google"] = google_pkg
    sys.modules["google.generativeai"] = mod


def test_gemini_key_isolation():
    _install_fake_genai()
    from agents.llm import _gen_gemini

    keys = [f"key-{i}" for i in range(8)]
    with ThreadPoolExecutor(max_workers=len(keys)) as ex:
        results = list(ex.map(lambda k: _gen_gemini("sys", "user", "model", k), keys))

    # Each call must get back exactly the key it passed in. Without the lock,
    # concurrent configure() calls corrupt the global and this fails.
    assert results == keys, f"key leaked across concurrent calls: {results}"


if __name__ == "__main__":
    test_gemini_key_isolation()
    print("ok: gemini key isolation holds under concurrency")
