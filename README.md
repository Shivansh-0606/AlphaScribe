# AlphaScribe — Multi-Agent Equity Research Copilot

AlphaScribe turns raw SEC filings and earnings-call transcripts into concise,
**fact-checked** equity-research briefs. Ask a question about a company, and a
pipeline of specialized AI agents retrieves the relevant filing passages,
extracts the financials, gauges management tone, writes a cited brief, and then
**verifies every numeric claim against the source documents** — retrying the
draft if anything is unsupported.

> Built with a LangGraph agent pipeline, hybrid RAG retrieval (BM25 + dense
> embeddings + cross-encoder re-ranking), and Google Gemini.

---

## ✨ Features

- **Multi-agent pipeline (LangGraph):** retriever → parallel financial-extractor
  + tone/risk analyst → synthesizer → fact-checker, with an automatic
  **retry loop** when claims aren't grounded in the sources.
- **Hybrid retrieval (RAG):** BM25 keyword search fused with dense vector
  embeddings, then re-ranked by a cross-encoder for precision.
- **Grounded, cited briefs:** every brief cites its sources inline as `[1]`,
  `[2]`, … and unsupported numbers are flagged and rewritten.
- **Quality scorecard:** a RAGAS-style scorecard scores each report on
  faithfulness, context precision, and answer relevance.
- **Multiple ingest paths:** paste text, auto-fetch the latest 10-Q/10-K from
  **SEC EDGAR**, load bundled demo filings, or upload an **earnings-call audio**
  file (transcribed with Gemini).
- **Live pipeline streaming:** watch each agent's progress in real time over
  Server-Sent Events.
- **Compare & follow-up:** compare multiple reports side by side and ask
  follow-up questions that build on a prior brief.

---

## 🏗️ Architecture

```
                         ┌──────────────────────────────────────────┐
   React (CRA + shadcn)  │              FastAPI backend             │
   ────────────────────► │                                          │
     REST + SSE          │   LangGraph pipeline                     │
                         │                                          │
                         │     START                                │
                         │       │                                  │
                         │   ┌───▼────────┐   hybrid retrieval      │
                         │   │  retriever │   BM25 + dense + rerank  │
                         │   └───┬────┬───┘                         │
                         │       │    │                             │
                         │  ┌────▼─┐ ┌▼───────┐   (parallel)        │
                         │  │extract│ │  tone  │                    │
                         │  └────┬─┘ └┬───────┘                     │
                         │       └──┬─┘                             │
                         │     ┌────▼──────┐                        │
                         │     │synthesizer│  writes cited brief    │
                         │     └────┬──────┘                        │
                         │     ┌────▼──────┐  verifies numeric      │
                         │     │fact_checker│  claims → retry/accept │
                         │     └────┬──────┘                        │
                         │        END                               │
                         └──────────┬───────────────────────────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
             MongoDB         Google Gemini        SEC EDGAR
        (filings, chunks,   (extraction, synth,  (filing fetch)
         reports, jobs)      fact-check, audio)
```

**Tech stack**

| Layer | Tech |
|-------|------|
| Frontend | React 19, React Router, shadcn/ui, Tailwind, Recharts, Framer Motion |
| Backend | FastAPI, LangGraph, Pydantic, Motor (async MongoDB) |
| AI / ML | Google Gemini (`gemini-1.5-flash` / `gemini-1.5-pro`), hybrid RAG: `rank-bm25` + `fastembed` dense embeddings + cross-encoder re-ranking |
| Data | MongoDB, SEC EDGAR |

---

## 🚀 Run it locally (one command)

**Prerequisites:** [Python 3.11+](https://www.python.org/downloads/) and
[Node.js 18+](https://nodejs.org/). You do **not** need to install MongoDB —
the launcher downloads a portable copy into the project.

1. **Add an LLM key from any supported provider.** AlphaScribe is provider-agnostic
   — pick whichever you already have. Two ways to set it:
   - **In the app (easiest):** open **LLM Key** in the sidebar, choose a provider,
     and paste your key. It's stored in your browser only and sent per-request.
   - **In `backend/.env`** as a server default, using that provider's variable:
     ```
     GEMINI_API_KEY=your_key_here       # Google Gemini  — free tier
     GROQ_API_KEY=your_key_here         # Groq (Llama)   — free, fast
     ANTHROPIC_API_KEY=your_key_here    # Anthropic Claude
     OPENAI_API_KEY=your_key_here       # OpenAI (GPT-4o)
     OPENROUTER_API_KEY=your_key_here   # OpenRouter (100+ models)
     DEEPSEEK_API_KEY=your_key_here     # DeepSeek
     MISTRAL_API_KEY=your_key_here      # Mistral
     ```
   Any **OpenAI-compatible** endpoint (aipipe, a local Ollama/LM Studio server, …)
   also works via the **Custom** provider — no key cost at all if you self-host.
   Google's Gemini free tier is the simplest zero-cost option to start.
2. **Start everything** — double-click **`run.bat`** (Windows) or run:
   ```bash
   python run.py
   ```
   The first run sets up a Python virtualenv, downloads a portable MongoDB, and
   installs frontend dependencies (a few minutes). Later runs start in seconds.
3. Open **http://localhost:3000**.
4. On the **Ingest** page, click **Load samples** (or
   `curl -X POST http://localhost:8001/api/ingest/samples`), then pick a company
   on the Dashboard and generate a report.

See **[README-RUN.md](README-RUN.md)** for detailed setup and troubleshooting.

---

## 📁 Project structure

```
backend/
  server.py              FastAPI app: ingest, report generation, SSE streaming
  agents/
    graph.py             LangGraph pipeline definition
    nodes.py             retriever / extractor / tone / synthesizer / fact-checker
    retrieval.py         hybrid BM25 + dense + cross-encoder retrieval
    llm.py               multi-provider LLM wrapper (Gemini / OpenAI / Anthropic / Groq / …)
    scoring.py           RAGAS-style quality scorecard
    ingest.py            SEC EDGAR fetch + document chunking
frontend/
  src/pages/             Dashboard, ReportView, Ingest, Compare
  src/components/        Scorecard, FinancialsTable, ToneGauge, PipelineLog, …
run.py / run.bat         one-command local launcher
```

---

## 🔒 Notes

- `backend/.env` holds your API key and is git-ignored — never commit it.
  Use `backend/.env.example` as the template.
- The AI features need a valid key from **any one** supported provider (Gemini,
  Groq, Anthropic, OpenAI, OpenRouter, DeepSeek, Mistral, or any OpenAI-compatible
  endpoint). Free tiers (Gemini, Groq) or a self-hosted local model are enough for
  local use and demos.
- Keys pasted in the app's **LLM Key** panel live in your browser and never touch
  the server beyond the single request that uses them.

---

## 📸 Screenshots

### Dashboard — ask a company a question

![AlphaScribe dashboard](docs/dashboard.png)

The home screen: search any US-listed company, pick a preset question (Quarter
Snapshot, Bull Thesis, Bear / Risks, Financial Deep-Dive), and watch the
multi-agent pipeline stream a fact-checked brief. The sidebar shows coverage,
history with quality scores, the active retrieval mode, and the current LLM provider.

### Research brief — grounded and cited

![Cited research brief](docs/report.png)

Every brief is written with inline `[1]`/`[2]` citations back to the source
filing. The header shows the run status (**COMPLETE · VERIFIED**) with one-click
Markdown / PDF export and a Re-run button.

### Compare — portfolio view

![Compare page with quality chart](docs/compare_charts.png)

Select multiple past reports and compare them side by side. The Quality &
Confidence chart plots each company's scorecard metrics against the others.

![Side-by-side company columns](docs/compare_breifs.png)

Per-company columns line up management tone, extracted financials, and the full
quality breakdown (faithfulness, context precision, answer relevance) for a
direct read across the portfolio.

---

## License

MIT — free to use and adapt.
