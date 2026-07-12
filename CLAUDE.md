# AlphaScribe — project guide for Claude

AI equity-research assistant: a LangGraph agent pipeline turns SEC/BSE filings
into grounded research briefs, served by FastAPI to a React UI.

## Architecture

- **Backend** (`backend/`): FastAPI (`server.py`) + a LangGraph pipeline in
  `agents/`. Flow: `retriever → (extractor ‖ tone) → synthesizer →
  fact_checker`, with a conditional router that retries the synthesizer or
  ends (`agents/graph.py`). State is a `TypedDict` in `agents/state.py`.
- **LLM access** goes through `agents/llm.py` only — `chat_text` / `chat_json`.
  It is multi-provider (Gemini, OpenAI-compatible, Anthropic) with per-request
  keys via a `contextvar`. Do not call provider SDKs directly from nodes.
- **Retrieval** (`agents/retrieval.py`): hybrid BM25 (`rank-bm25`) + dense
  (`fastembed`) with a reranker. Data in MongoDB via `motor` (async).
- **Frontend** (`frontend/`): Create React App via **craco**, React 19,
  react-router. Pages in `src/pages/`, shared UI in `src/components/`.

## Conventions

- **Package manager is npm**, not yarn. Lockfile is `package-lock.json`;
  there is no `yarn.lock`. `run.py` installs with `npm install
  --legacy-peer-deps`. Never add a `yarn.lock`.
- **Frontend imports use the `@/` alias** (`@/lib/...`, `@/components/...`),
  configured in `craco.config.js` and `jsconfig.json`.
- **Toasts use `sonner` directly** (`import { toast } from "sonner"`). This repo
  does **not** use shadcn/ui — there is no `src/components/ui/` folder and no
  `cn()` helper. Do not reintroduce them or their Radix/CVA dependencies.
- **Icons**: `@phosphor-icons/react`. **Charts**: `recharts`. **Markdown**:
  `react-markdown`. Reach for these before adding anything new.
- **Test IDs** live in `src/constants/testIds/alphascribe.js` and are applied
  via `data-testid`. Add new IDs there, not inline string literals.
- **Client persistence**: `usePersistedState` (sessionStorage) and the
  watchlist store (`lib/watchlist.js`, `useSyncExternalStore`). Reuse these.

## Dependencies

Keep both dependency manifests lean — they were deliberately pruned of an
unused scaffold. Before adding a dependency, confirm nothing already installed
(or the stdlib / platform) does the job. The app has **no auth**; do not add
auth, JWT, OAuth, or cloud-SDK dependencies.

## Backend specifics

- Python 3.11, Pydantic v2. LLM structured output is validated against the
  schemas in `agents/schemas.py`.
- Scoring (`agents/scoring.py`) is intentionally dependency-free (RAGAS-lite,
  stdlib `re` only). Keep it that way.
- External data sources are best-effort: BSE/yfinance failures must return
  `None` and fall back, never crash a request (see `agents/ingest.py`).

## Running & testing

- One command: `python run.py` (sets up venv + portable MongoDB + deps, then
  starts all three services). Ports: backend `8001`, frontend `3001`,
  MongoDB `27017`.
- Backend tests (`backend/tests/`) are live HTTP tests against a running
  server, run with pytest-xdist. **Do not change `pytest.ini`'s `addopts`**
  (`-n 2 --dist loadscope`) — the suites assume that layout.
- The `backend_test_iter*.py` files are additive per-feature suites, not
  superseded snapshots; keep them.

## Deliberate shortcuts

Shortcuts with a known ceiling are marked with a `ponytail:` comment naming the
ceiling and upgrade path (currently one, in `agents/ingest.py`). Preserve these
markers; don't silently "fix" the thing they intentionally defer.
