// Documentation page. Recreation of the Claude Design handoff
// ("AlphaScribe Docs.dc.html") — sidebar + centered content — restyled to the
// app's own design system (dark-only, IBM Plex Sans/Mono, #0A0A0A palette,
// sharp corners, #6E93FF accent) so it matches the rest of AlphaScribe rather
// than the handoff's stock light Helvetica theme. Sibling of Landing.jsx.
import { Link } from "react-router-dom";

const SANS = "'IBM Plex Sans', system-ui, -apple-system, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";

// Dark palette aligned to index.css (:root) + Landing.jsx.
const C = {
  bg: "#0A0A0A",
  surface: "#121212",
  text: "#E0E0E0",
  textSoft: "#b4b4b4",
  muted: "#888888",
  border: "#222222",
  hover: "#1a1a1a",
  accent: "#6E93FF",
  codeBg: "#000000",
  codeText: "#d4d4d4",
  codeBorder: "#222222",
};

export default function Docs() {
  const rootStyle = {
    display: "flex",
    minHeight: "100vh",
    background: C.bg,
    fontFamily: SANS,
    color: C.text,
  };

  const sidebarStyle = {
    width: "252px",
    flex: "none",
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
    padding: "24px 16px",
    borderRight: `1px solid ${C.border}`,
    boxSizing: "border-box",
  };

  const mainStyle = {
    flex: "1",
    minWidth: 0,
    maxWidth: "760px",
    margin: "0 auto",
    padding: "56px 40px 0",
    boxSizing: "border-box",
  };

  const sectionStyle = { padding: "0 0 44px", marginBottom: "44px", borderBottom: `1px solid ${C.border}` };
  const sectionStyleLast = { padding: "0 0 20px", marginBottom: "0" };

  const h2Style = { fontSize: "24px", fontWeight: 700, letterSpacing: "-0.01em", color: C.text, margin: "0 0 16px" };
  const h3Style = { fontSize: "16px", fontWeight: 700, color: C.text, margin: "26px 0 10px" };
  const pStyle = { fontSize: "15px", lineHeight: 1.7, color: C.textSoft, margin: "0 0 14px" };
  const pStyleTight = { fontSize: "13.5px", lineHeight: 1.6, color: C.textSoft, margin: 0 };
  const ulStyle = { margin: "0 0 8px", paddingLeft: "20px" };
  const olStyle = { margin: "0 0 8px", paddingLeft: "20px" };
  const liStyle = { fontSize: "15px", lineHeight: 1.7, color: C.textSoft, marginBottom: "12px" };

  const inlineCodeStyle = {
    fontFamily: MONO,
    fontSize: "0.87em",
    background: C.surface,
    border: `1px solid ${C.border}`,
    padding: "1px 5px",
    color: C.text,
  };

  const preBlockStyle = {
    background: C.codeBg,
    color: C.codeText,
    border: `1px solid ${C.codeBorder}`,
    padding: "14px 16px",
    fontFamily: MONO,
    fontSize: "12.5px",
    lineHeight: 1.65,
    overflowX: "auto",
    margin: "10px 0 14px",
    whiteSpace: "pre",
  };
  const preBlockStyle_inNote = { ...preBlockStyle, margin: "8px 0 0" };
  const preBlockStyle_inCard = { ...preBlockStyle, margin: "0", fontSize: "12px" };

  const noteBoxStyle = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    padding: "16px 18px",
    fontSize: "14px",
    color: C.textSoft,
    lineHeight: 1.6,
    marginTop: "18px",
  };

  const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "13.5px" };
  const thStyle = { textAlign: "left", padding: "9px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: "11.5px", letterSpacing: "0.03em", textTransform: "uppercase", fontFamily: MONO };
  const tdStyle = { textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textSoft, verticalAlign: "top" };
  const tdMonoStyle = { ...tdStyle, fontFamily: MONO, fontSize: "12.5px" };
  const tdStyleTight = { ...tdStyle, padding: "6px 10px", fontSize: "12.5px" };
  const tdMonoStyleTight = { ...tdMonoStyle, padding: "6px 10px", fontSize: "12px" };

  const cardGridStyle = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", margin: "20px 0 8px" };
  const featureCardStyle = { background: C.surface, border: `1px solid ${C.border}`, padding: "14px 16px" };

  const endpointCardStyle = { background: C.surface, border: `1px solid ${C.border}`, padding: "18px 20px", marginBottom: "16px" };
  const issueCardStyle = { borderLeft: `3px solid ${C.accent}`, background: C.surface, padding: "12px 16px", marginBottom: "12px" };

  const methodStyle = (m) => ({
    fontSize: "11px",
    fontWeight: 700,
    fontFamily: MONO,
    padding: "3px 8px",
    color: "#0A0A0A",
    background: m === "GET" ? C.accent : m === "POST" ? "#00E676" : "#FF0055",
  });

  const navItems = [
    { label: "Overview", href: "#overview" },
    { label: "Installation", href: "#installation" },
    { label: "Usage", href: "#usage" },
    { label: "Configuration", href: "#configuration" },
    { label: "API Reference", href: "#api-reference" },
    { label: "Troubleshooting", href: "#troubleshooting" },
    { label: "Contributing", href: "#contributing" },
    { label: "License", href: "#license" },
  ];

  const features = [
    { title: "Multi-agent pipeline", desc: "LangGraph pipeline: retriever, parallel extractor + tone analyst, synthesizer, fact-checker, with automatic retry when claims aren't grounded." },
    { title: "Hybrid retrieval (RAG)", desc: "BM25 keyword search fused with dense vector embeddings, re-ranked by a cross-encoder for precision." },
    { title: "Grounded, cited briefs", desc: "Every brief cites sources inline as [1], [2]; unsupported numbers are flagged and rewritten." },
    { title: "Quality scorecard", desc: "A RAGAS-style scorecard rates faithfulness, context precision, and answer relevance." },
    { title: "Multiple ingest paths", desc: "Paste text, auto-fetch from SEC EDGAR, load bundled demos, upload earnings-call audio, or upload an annual-report PDF." },
    { title: "Live streaming + compare", desc: "Watch each agent's progress over SSE; compare reports side by side with follow-up questions." },
  ];

  const stack = [
    { layer: "Frontend", tech: "React 19, React Router, Tailwind, Recharts, Phosphor Icons, react-markdown" },
    { layer: "Backend", tech: "FastAPI, LangGraph, Pydantic, Motor (async MongoDB)" },
    { layer: "AI / ML", tech: "Pluggable LLM (Gemini, OpenAI, Anthropic, Groq, more); rank-bm25 + fastembed + cross-encoder rerank" },
    { layer: "Data", tech: "MongoDB, SEC EDGAR, Yahoo Finance, BSE annual reports" },
  ];

  const envVars = [
    { name: "MONGO_URL", default: "mongodb://localhost:27017", desc: "MongoDB connection string. Point at Atlas to skip the local download." },
    { name: "DB_NAME", default: "alphascribe", desc: "Database name used for filings, chunks, reports, and jobs." },
    { name: "CORS_ORIGINS", default: "*", desc: "Comma-separated allowed origins." },
    { name: "GEMINI_API_KEY", default: "(empty)", desc: "Google Gemini key. Also required for audio transcription regardless of chat provider." },
    { name: "GROQ_API_KEY", default: "(empty)", desc: "Groq key. Free, fast Llama models." },
    { name: "OPENAI_API_KEY", default: "(empty)", desc: "OpenAI key." },
    { name: "LLM_PROVIDER", default: "gemini", desc: "Server-default provider: gemini, groq, openai, or another supported provider." },
  ];

  const endpoints = [
    {
      method: "GET",
      path: "/api/health",
      desc: "Health check. Reports whether an LLM key is configured and current filing/chunk counts.",
      params: [],
      example: 'curl http://localhost:8001/api/health\n\n{\n  "ok": true,\n  "llm_key_configured": true,\n  "filings": 6,\n  "chunks": 214\n}',
    },
    {
      method: "POST",
      path: "/api/ingest/samples",
      desc: "Ingests the bundled demo filings (AAPL, MSFT, NVDA, and more) so you can generate reports without an external fetch.",
      params: [],
      example: 'curl -X POST http://localhost:8001/api/ingest/samples\n\n{ "ingested": [ {"ticker": "AAPL", "num_chunks": 38} ], "total_samples": 6 }',
    },
    {
      method: "POST",
      path: "/api/reports/generate",
      desc: "Starts the LangGraph pipeline for a ticker + question. Returns immediately with a job id; stream progress via /api/reports/{job_id}/stream.",
      params: [
        { name: "ticker", type: "string", desc: "Ticker to analyze. Must have at least one ingested filing." },
        { name: "query", type: "string", desc: "Natural-language question, e.g. Bull thesis?" },
        { name: "llm_provider", type: "string?", desc: "Override provider for this request only." },
      ],
      example: 'curl -X POST http://localhost:8001/api/reports/generate \\\n  -H "Content-Type: application/json" \\\n  -d \'{"ticker": "AAPL", "query": "Bull thesis?"}\'\n\n{ "job_id": "3f1c2a9e-4b7d-4e2a-9c1f-8a2b0d5e6f11" }',
    },
  ];

  const issues = [
    { problem: "Python was not found", solution: "Install Python 3.11+ and re-check Add Python to PATH during setup, then re-run run.bat." },
    { problem: "Frontend won't start / npm not found", solution: "Install Node.js LTS (includes npm) from nodejs.org, then re-run." },
    { problem: "Reports fail with an API-key error", solution: "Set GEMINI_API_KEY (or another provider's key) in backend/.env, or paste one in the app's LLM Key sidebar panel. Restart the backend after adding it." },
    { problem: "Port 8001 or 3000 already in use", solution: "Another process, often a previous run that didn't shut down, is holding the port. Close it, or restart your machine, then re-run." },
    { problem: "MongoDB download fails", solution: "Set MONGO_URL in backend/.env to a MongoDB Atlas connection string to skip the local download entirely." },
    { problem: "Want a totally clean slate", solution: "Run python run.py --clean to remove .venv, .mongo (and its data), node_modules, and .env.local, then re-run to rebuild from scratch." },
  ];

  return (
    <div className="docs" style={rootStyle}>
      <style>{`
        .docs ::selection { background: #6E93FF; color: #0A0A0A; }
        .docs a { text-decoration: none; }
        .docs-nav a:hover { background: ${C.hover}; color: ${C.text}; }
        .docs-nav a.docs-logo:hover { background: transparent; }
        .docs-nav a.docs-logo:hover div { opacity: 0.85; }
      `}</style>

      {/* Sidebar */}
      <nav style={sidebarStyle} className="docs-nav">
        <Link to="/" className="docs-logo" title="Back to landing page" style={{ display: "flex", alignItems: "center", gap: "9px", padding: "0 4px 20px", cursor: "pointer" }}>
          <span style={{ fontFamily: MONO, color: C.accent, fontSize: "16px" }}>&gt;_</span>
          <div style={{ fontSize: "15px", fontWeight: 700, color: C.text, letterSpacing: "0.01em" }}>ALPHA<span style={{ color: C.accent }}>SCRIBE</span></div>
        </Link>

        <div style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: C.muted, textTransform: "uppercase", padding: "14px 4px 8px" }}>Documentation</div>
        {navItems.map((item) => (
          <a key={item.href} href={item.href} style={{ display: "block", padding: "7px 10px", margin: "1px 0", fontSize: "13.5px", color: C.textSoft, background: "transparent" }}>{item.label}</a>
        ))}

        <div style={{ marginTop: "24px", padding: "14px 12px", background: C.surface, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: C.text, marginBottom: "4px" }}>v0.1.0 · MIT License</div>
          <div style={{ fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>Multi-agent equity research copilot.</div>
        </div>
      </nav>

      {/* Main content */}
      <main style={mainStyle}>
        <header style={{ paddingBottom: "28px", marginBottom: "36px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", background: C.surface, border: `1px solid ${C.border}`, fontFamily: MONO, fontSize: "12px", color: C.muted, fontWeight: 600, marginBottom: "16px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3fb950" }}></span>
            v0.1.0 &nbsp;·&nbsp; MIT
          </div>
          <h1 style={{ fontSize: "38px", fontWeight: 700, letterSpacing: "-0.02em", color: C.text, margin: "0 0 10px", lineHeight: 1.15 }}>AlphaScribe</h1>
          <p style={{ fontSize: "17px", color: C.textSoft, lineHeight: 1.6, margin: 0, maxWidth: "640px" }}>Multi-agent equity research copilot that turns SEC filings and earnings-call transcripts into concise, fact-checked briefs.</p>
        </header>

        {/* OVERVIEW */}
        <section id="overview" style={sectionStyle}>
          <h2 style={h2Style}>Project Overview</h2>
          <p style={pStyle}>AlphaScribe answers a natural-language question about a public company by retrieving relevant passages from ingested filings, extracting financial figures, gauging management tone, drafting a cited brief, and then verifying every numeric claim against the source text — automatically retrying the draft if a claim isn't grounded.</p>
          <p style={pStyle}>The pipeline is built on <strong style={{ color: C.text }}>LangGraph</strong>, with hybrid retrieval (BM25 keyword search + dense embeddings + cross-encoder re-ranking) and a pluggable LLM layer supporting Gemini, OpenAI, Anthropic, Groq, OpenRouter, DeepSeek, Mistral, or any OpenAI-compatible endpoint.</p>

          <div style={cardGridStyle}>
            {features.map((f) => (
              <div key={f.title} style={featureCardStyle}>
                <div style={{ fontSize: "13.5px", fontWeight: 600, color: C.text, marginBottom: "5px" }}>{f.title}</div>
                <div style={{ fontSize: "13px", color: C.textSoft, lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          <h3 style={h3Style}>Architecture</h3>
          <p style={pStyle}>A React frontend talks to a FastAPI backend over REST and Server-Sent Events. The backend runs a LangGraph pipeline — retriever → parallel extractor/tone analyst → synthesizer → fact-checker (with retry) — backed by MongoDB and SEC EDGAR.</p>
          <pre style={preBlockStyle}>retriever → [extractor, tone] (parallel) → synthesizer → fact_checker → (retry or done)</pre>

          <div style={{ overflowX: "auto", marginTop: "18px" }}>
            <table style={tableStyle}>
              <thead><tr>
                <th style={thStyle}>Layer</th>
                <th style={thStyle}>Tech</th>
              </tr></thead>
              <tbody>
                {stack.map((row) => (
                  <tr key={row.layer}>
                    <td style={tdStyle}><strong style={{ color: C.text }}>{row.layer}</strong></td>
                    <td style={tdStyle}>{row.tech}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* INSTALLATION */}
        <section id="installation" style={sectionStyle}>
          <h2 style={h2Style}>Installation</h2>
          <p style={pStyle}>AlphaScribe ships with a one-command local launcher. You do not need to install MongoDB by hand — it's downloaded automatically into the project folder.</p>

          <h3 style={h3Style}>Prerequisites</h3>
          <ul style={ulStyle}>
            <li style={liStyle}><strong style={{ color: C.text }}>Python 3.11+</strong> — check with <code style={inlineCodeStyle}>python --version</code></li>
            <li style={liStyle}><strong style={{ color: C.text }}>Node.js 18+</strong> — check with <code style={inlineCodeStyle}>node --version</code> (includes npm)</li>
          </ul>

          <h3 style={h3Style}>Steps</h3>
          <ol style={olStyle}>
            <li style={liStyle}>
              <strong style={{ color: C.text }}>Add an LLM key.</strong> Pick any one supported provider and set it in <code style={inlineCodeStyle}>backend/.env</code>:
              <pre style={preBlockStyle}>{`GEMINI_API_KEY=your_key_here       # Google Gemini — free tier
GROQ_API_KEY=your_key_here         # Groq (Llama) — free, fast
ANTHROPIC_API_KEY=your_key_here    # Anthropic Claude
OPENAI_API_KEY=your_key_here       # OpenAI (GPT-4o)`}</pre>
              Or skip this and paste a key into the app's <strong style={{ color: C.text }}>LLM Key</strong> sidebar panel instead — it's stored in your browser only.
            </li>
            <li style={liStyle}>
              <strong style={{ color: C.text }}>Start everything.</strong> Double-click <code style={inlineCodeStyle}>run.bat</code> on Windows, or run:
              <pre style={preBlockStyle}>python run.py</pre>
              The first run creates a virtualenv, downloads a portable MongoDB, and installs frontend dependencies — a few minutes. Later runs start in seconds.
            </li>
            <li style={liStyle}>Open <code style={inlineCodeStyle}>http://localhost:3000</code>.</li>
            <li style={liStyle}>
              On the <strong style={{ color: C.text }}>Ingest</strong> page, click <strong style={{ color: C.text }}>Load samples</strong> — or:
              <pre style={preBlockStyle}>curl -X POST http://localhost:8001/api/ingest/samples</pre>
              Then pick a company on the Dashboard and generate a report.
            </li>
          </ol>

          <div style={noteBoxStyle}>
            <strong style={{ color: C.text }}>Useful launcher flags</strong>
            <pre style={preBlockStyle_inNote}>{`python run.py --setup    # install/download everything, don't start the app
python run.py --clean    # delete .venv, .mongo, node_modules, .env.local`}</pre>
          </div>
        </section>

        {/* USAGE */}
        <section id="usage" style={sectionStyle}>
          <h2 style={h2Style}>Usage</h2>
          <p style={pStyle}>Once running, three services share one terminal: MongoDB (<code style={inlineCodeStyle}>:27017</code>), the FastAPI backend (<code style={inlineCodeStyle}>:8001</code>), and the React frontend (<code style={inlineCodeStyle}>:3000</code>).</p>

          <h3 style={h3Style}>1. Load data</h3>
          <p style={pStyle}>The app needs at least one ingested filing before it can generate a report. Load the bundled demo filings:</p>
          <pre style={preBlockStyle}>{`curl -X POST http://localhost:8001/api/ingest/samples

# → { "ingested": [...], "total_samples": 6 }`}</pre>
          <p style={pStyle}>Or auto-fetch a real filing from SEC EDGAR for a US ticker:</p>
          <pre style={preBlockStyle}>{`curl -X POST http://localhost:8001/api/companies/ensure \\
  -H "Content-Type: application/json" \\
  -d '{"ticker": "AAPL"}'

# → { "ticker": "AAPL", "action": "ingested_from_edgar", "num_chunks": 42, ... }`}</pre>

          <h3 style={h3Style}>2. Generate a research brief</h3>
          <p style={pStyle}>Ask a question about an ingested company. This kicks off the pipeline and returns a job id immediately:</p>
          <pre style={preBlockStyle}>{`curl -X POST http://localhost:8001/api/reports/generate \\
  -H "Content-Type: application/json" \\
  -d '{"ticker": "AAPL", "query": "How did gross margin trend this quarter?"}'

# → { "job_id": "3f1c2a9e-..." }`}</pre>

          <h3 style={h3Style}>3. Stream progress, then fetch the report</h3>
          <pre style={preBlockStyle}>{`curl http://localhost:8001/api/reports/3f1c2a9e-.../stream
# → SSE: node "retriever" → "extractor" → "tone" → "synthesizer" → "fact_checker" → "final"

curl http://localhost:8001/api/reports/3f1c2a9e-...
# → { "status": "completed", "report": { "draft_report": "...", "scorecard": {...} } }`}</pre>
          <p style={pStyle}>In the UI, the same flow happens on the <strong style={{ color: C.text }}>Dashboard</strong>: search a company, pick a preset question (Quarter Snapshot, Bull Thesis, Bear/Risks, Financial Deep-Dive), and watch the pipeline stream live. Every brief cites sources inline as <code style={inlineCodeStyle}>[1]</code>, <code style={inlineCodeStyle}>[2]</code>, etc.</p>
        </section>

        {/* CONFIGURATION */}
        <section id="configuration" style={sectionStyle}>
          <h2 style={h2Style}>Configuration</h2>
          <p style={pStyle}>Backend settings live in <code style={inlineCodeStyle}>backend/.env</code> (copy from <code style={inlineCodeStyle}>backend/.env.example</code>). This file is git-ignored — never commit it.</p>

          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead><tr>
                <th style={thStyle}>Variable</th>
                <th style={thStyle}>Default</th>
                <th style={thStyle}>Description</th>
              </tr></thead>
              <tbody>
                {envVars.map((v) => (
                  <tr key={v.name}>
                    <td style={tdStyle}><code style={inlineCodeStyle}>{v.name}</code></td>
                    <td style={tdMonoStyle}>{v.default}</td>
                    <td style={tdStyle}>{v.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={noteBoxStyle}>
            Users can also paste a key into the app's <strong style={{ color: C.text }}>LLM Key</strong> sidebar panel — it's stored in the browser and sent per request, overriding the server default without touching <code style={inlineCodeStyle}>.env</code>.
          </div>
        </section>

        {/* API REFERENCE */}
        <section id="api-reference" style={sectionStyle}>
          <h2 style={h2Style}>API Reference</h2>
          <p style={pStyle}>All routes are prefixed with <code style={inlineCodeStyle}>/api</code> and served by the FastAPI backend at <code style={inlineCodeStyle}>http://localhost:8001</code>. Key endpoints below; see <code style={inlineCodeStyle}>backend/server.py</code> for the full list (companies, filings, compare, etc).</p>

          {endpoints.map((ep) => (
            <div key={ep.method + ep.path} style={endpointCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={methodStyle(ep.method)}>{ep.method}</span>
                <code style={{ fontFamily: MONO, fontSize: "14px", fontWeight: 600, color: C.text }}>{ep.path}</code>
              </div>
              <p style={pStyleTight}>{ep.desc}</p>
              {ep.params.length > 0 && (
                <>
                  <div style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: C.muted, textTransform: "uppercase", margin: "12px 0 6px" }}>Parameters</div>
                  <table style={tableStyle}>
                    <tbody>
                      {ep.params.map((p) => (
                        <tr key={p.name}>
                          <td style={tdMonoStyleTight}>{p.name}</td>
                          <td style={tdMonoStyleTight}>{p.type}</td>
                          <td style={tdStyleTight}>{p.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <div style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: C.muted, textTransform: "uppercase", margin: "14px 0 6px" }}>Example</div>
              <pre style={preBlockStyle_inCard}>{ep.example}</pre>
            </div>
          ))}
        </section>

        {/* TROUBLESHOOTING */}
        <section id="troubleshooting" style={sectionStyle}>
          <h2 style={h2Style}>Troubleshooting</h2>
          {issues.map((iss) => (
            <div key={iss.problem} style={issueCardStyle}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: C.text, marginBottom: "6px" }}>{iss.problem}</div>
              <div style={{ fontSize: "13.5px", color: C.textSoft, lineHeight: 1.6 }}>{iss.solution}</div>
            </div>
          ))}
        </section>

        {/* CONTRIBUTING */}
        <section id="contributing" style={sectionStyle}>
          <h2 style={h2Style}>Contributing</h2>
          <p style={pStyle}>Contributions are welcome. Suggested workflow:</p>
          <ol style={olStyle}>
            <li style={liStyle}>Fork the repo and create a feature branch off <code style={inlineCodeStyle}>main</code>.</li>
            <li style={liStyle}>Run the backend test suite before opening a PR:
              <pre style={preBlockStyle}>cd backend && pytest</pre>
            </li>
            <li style={liStyle}>Keep pipeline changes (in <code style={inlineCodeStyle}>backend/agents/</code>) covered by a test in <code style={inlineCodeStyle}>backend/tests/</code>.</li>
            <li style={liStyle}>Match existing code style — typed Pydantic models for API payloads, async Motor calls for MongoDB.</li>
            <li style={liStyle}>Open a pull request describing the change and any new environment variables or endpoints.</li>
          </ol>
        </section>

        {/* LICENSE */}
        <section id="license" style={sectionStyleLast}>
          <h2 style={h2Style}>License</h2>
          <p style={pStyle}>Released under the <strong style={{ color: C.text }}>MIT License</strong> — free to use, modify, and adapt, including for commercial purposes, with attribution preserved in copies of the source.</p>
        </section>

        <footer style={{ padding: "32px 0 60px", color: C.muted, fontSize: "12.5px", fontFamily: MONO }}>ALPHASCRIBE · v0.1.0 · MIT LICENSED</footer>
      </main>
    </div>
  );
}
