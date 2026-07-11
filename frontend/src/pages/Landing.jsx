import { useNavigate } from "react-router-dom";

// Marketing landing page. Faithful recreation of the Claude Design handoff
// ("AlphaScribe Landing.dc.html") — fixed dark theme, inline styles + the
// design's animation layer (entrance fades, pop-in, hover-lift, shimmer,
// slide-in, nav underline, cta glow, drifting grid). CTAs route into /app.
const BLUE = "#6E93FF";
const PURPLE = "#9B6CFF";

export default function Landing() {
  const nav = useNavigate();
  const toApp = () => nav("/app");

  return (
    <div style={{ background: "#0A0A0A", color: "#E0E0E0", minHeight: "100vh" }}>
      <style>{`
        html { scroll-behavior: smooth; }
        .lp a { color:${BLUE}; text-decoration:none; }
        .lp a:hover { color:#9AB4FF; }
        .lp-glines {
          background-image: linear-gradient(to right,#1a1a1a 1px,transparent 1px),linear-gradient(to bottom,#1a1a1a 1px,transparent 1px);
          background-size: 40px 40px;
          animation: lp-drift 6s linear infinite;
        }
        @keyframes lp-drift { 0% { background-position:0 0; } 100% { background-position:40px 40px; } }
        .lp-blink::after {
          content:''; display:inline-block; width:7px; height:1em; margin-left:3px;
          vertical-align:-2px; background:currentColor; animation: lp-blink 1s steps(2) infinite;
        }
        @keyframes lp-blink { 50% { opacity: 0; } }
        @keyframes lp-fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes lp-popIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
        @keyframes lp-slideL { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes lp-slideR { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes lp-glow { 0%,100% { box-shadow:0 0 0 rgba(155,108,255,0); } 50% { box-shadow:0 0 30px rgba(155,108,255,0.25); } }
        @keyframes lp-shimmerMove { 0% { left:-150%; } 100% { left:150%; } }
        .lp-fade1 { animation: lp-fadeUp 0.7s 0.05s ease-out both; }
        .lp-fade2 { animation: lp-fadeUp 0.7s 0.18s ease-out both; }
        .lp-fade3 { animation: lp-fadeUp 0.7s 0.30s ease-out both; }
        .lp-fade4 { animation: lp-fadeUp 0.7s 0.42s ease-out both; }
        .lp-pop { opacity:0; animation: lp-popIn 0.5s ease-out forwards; }
        .lp-pop:nth-child(1){animation-delay:.05s} .lp-pop:nth-child(2){animation-delay:.14s}
        .lp-pop:nth-child(3){animation-delay:.23s} .lp-pop:nth-child(4){animation-delay:.32s}
        .lp-pop:nth-child(5){animation-delay:.41s} .lp-pop:nth-child(6){animation-delay:.5s}
        .lp-slide-left { opacity:0; animation: lp-slideL 0.6s ease-out forwards; }
        .lp-slide-right { opacity:0; animation: lp-slideR 0.6s ease-out forwards; }
        .lp-lift { transition: transform 0.35s cubic-bezier(.16,1,.3,1), border-color 0.35s cubic-bezier(.16,1,.3,1), box-shadow 0.35s cubic-bezier(.16,1,.3,1); }
        .lp-lift:hover { transform:translateY(-4px); border-color:#9B6CFF; box-shadow:0 14px 32px -12px rgba(155,108,255,0.25); }
        .lp-btn { transition: transform 0.25s cubic-bezier(.16,1,.3,1), box-shadow 0.25s cubic-bezier(.16,1,.3,1); }
        .lp-btn:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(224,224,224,0.15); }
        .lp-ghost { transition: border-color 0.25s ease, color 0.25s ease; }
        .lp-ghost:hover { border-color:#9B6CFF; color:#9B6CFF; }
        .lp-glow { animation: lp-glow 3s ease-in-out infinite; }
        .lp-navlink { position:relative; }
        .lp-navlink::after { content:''; position:absolute; left:0; bottom:-4px; width:0; height:1px; background:#9B6CFF; transition:width 0.3s cubic-bezier(.16,1,.3,1); }
        .lp-navlink:hover::after { width:100%; }
        .lp-shimmer { position:relative; overflow:hidden; }
        .lp-shimmer::after { content:''; position:absolute; top:0; left:-150%; width:60%; height:100%; background:linear-gradient(100deg, transparent, rgba(255,255,255,0.08), transparent); animation: lp-shimmerMove 3.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .lp-glines, .lp-blink::after, .lp-fade1, .lp-fade2, .lp-fade3, .lp-fade4,
          .lp-pop, .lp-slide-left, .lp-slide-right, .lp-glow, .lp-shimmer::after {
            animation: none !important;
          }
          .lp-pop, .lp-slide-left, .lp-slide-right { opacity:1; }
        }
      `}</style>

      <div className="lp">
        {/* NAV */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, background: "rgba(10,10,10,0.92)", backdropFilter: "blur(6px)", borderBottom: "1px solid #1c1c1c" }}>
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            title="Back to top"
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          >
            <span className="mono" style={{ color: BLUE, fontSize: 16 }}>&gt;_</span>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.02em" }}>ALPHA<span style={{ color: BLUE }}>SCRIBE</span></span>
          </div>
          <div className="mono" style={{ display: "flex", gap: 32, fontSize: 12, color: "#888" }}>
            <a href="#how" className="lp-navlink" style={{ color: "#888" }}>HOW IT WORKS</a>
            <a href="#features" className="lp-navlink" style={{ color: "#888" }}>FEATURES</a>
            <a href="#pricing" className="lp-navlink" style={{ color: "#888" }}>PRICING</a>
            <a href="#faq" className="lp-navlink" style={{ color: "#888" }}>FAQ</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="mono" style={{ fontSize: 11, color: "#555" }}>v0.1</span>
            <button onClick={toApp} className="lp-btn" style={{ background: "#E0E0E0", color: "#0A0A0A", border: "none", padding: "9px 18px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer" }}>TRY FOR FREE →</button>
          </div>
        </div>

        {/* HERO */}
        <div className="lp-glines" style={{ padding: "120px 40px 90px", textAlign: "center", borderBottom: "1px solid #1c1c1c", position: "relative" }}>
          <div className="mono lp-fade1" style={{ color: BLUE, fontSize: 11, letterSpacing: "0.28em", marginBottom: 22 }}>MULTI-AGENT EQUITY RESEARCH</div>
          <h1 className="lp-fade2" style={{ fontSize: 64, lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 auto 24px", maxWidth: 920 }}>
            Ask a company a question.<br />Get a <span style={{ color: PURPLE }}>fact-checked</span> answer.
          </h1>
          <p className="lp-fade3" style={{ fontSize: 17, lineHeight: 1.7, color: "#888", maxWidth: 640, margin: "0 auto 40px" }}>
            Search any US- or India-listed company and AlphaScribe pulls the latest filing, extracts the financials, gauges management tone, drafts a brief, and verifies every number before you see it.
          </p>
          <div className="lp-fade4" style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 56 }}>
            <button onClick={toApp} className="lp-btn" style={{ background: "#E0E0E0", color: "#0A0A0A", border: "none", padding: "14px 28px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", cursor: "pointer" }}>TRY FOR FREE →</button>
            <a onClick={() => nav("/docs")} className="lp-ghost" style={{ background: "transparent", color: "#E0E0E0", border: "1px solid #333", padding: "14px 28px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, letterSpacing: "0.03em", cursor: "pointer" }}>READ THE DOCS</a>
          </div>

          {/* stylized dashboard mock */}
          <div className="lp-fade4" style={{ maxWidth: 920, margin: "0 auto", background: "#0A0A0A", border: "1px solid #222", textAlign: "left", boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid #1c1c1c", background: "#0d0d0d" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#333" }}></div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#333" }}></div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#333" }}></div>
              <span className="mono" style={{ marginLeft: 10, color: "#555", fontSize: 11 }}>/home &nbsp;generate a research brief</span>
            </div>
            <div style={{ padding: "28px 32px" }}>
              <div className="mono" style={{ border: "1px solid #222", background: "#000", padding: "14px 16px", color: "#666", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#444" }}>⌕</span> Search a company — e.g. Apple, Microsoft, Tesla<span className="lp-blink"></span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                {["TSLA · 2", "MSFT · 2", "HTHIY · 1", "AAPL · 1"].map((t) => (
                  <span key={t} className="mono" style={{ fontSize: 11, border: "1px solid #222", padding: "6px 10px", color: "#888" }}>{t}</span>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#1c1c1c", marginTop: 22 }}>
                {[
                  ["▤", BLUE, "Quarter Snapshot"],
                  ["↗", "#00E676", "Bull Thesis"],
                  ["↘", "#FF0055", "Bear / Risks"],
                  ["◈", "#FFCC00", "Financial Deep-Dive"],
                ].map(([icon, color, label]) => (
                  <div key={label} className="lp-lift" style={{ background: "#0A0A0A", padding: 16, border: "1px solid transparent" }}>
                    <div style={{ color, fontSize: 16, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TRUST / STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#1c1c1c", borderBottom: "1px solid #1c1c1c" }}>
          {[
            ["7", BLUE, "LLM PROVIDERS SUPPORTED", true],
            ["100%", "#00E676", "CLAIMS VERIFIED VS SOURCE", true],
            ["SEC + NSE/BSE", PURPLE, "FILINGS COVERAGE", false],
            ["MIT", "#FFCC00", "OPEN SOURCE LICENSE", false],
          ].map(([big, color, small, shimmer]) => (
            <div key={small} className={`lp-lift${shimmer ? " lp-shimmer" : ""}`} style={{ background: "#0A0A0A", padding: "36px 40px", textAlign: "center", border: "1px solid transparent" }}>
              <div className="mono" style={{ fontSize: 32, fontWeight: 600, color }}>{big}</div>
              <div className="mono" style={{ fontSize: 11, color: "#666", letterSpacing: "0.12em", marginTop: 6 }}>{small}</div>
            </div>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <div id="how" style={{ padding: "100px 40px", borderBottom: "1px solid #1c1c1c" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div className="mono" style={{ color: BLUE, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14, textAlign: "center" }}>THE PIPELINE</div>
            <h2 style={{ fontSize: 36, fontWeight: 600, textAlign: "center", margin: "0 0 60px", letterSpacing: "-0.01em" }}>Five agents. One fact-checked brief.</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 1, background: "#1c1c1c" }}>
              {[
                ["01", "Retriever", "Hybrid BM25 + dense + cross-encoder re-rank pulls the exact filing passages."],
                ["02", "Extractor", "Pulls financials from the retrieved passages in parallel with tone analysis."],
                ["03", "Tone / Risk", "Gauges management tone and surfaces disclosed risk language."],
                ["04", "Synthesizer", "Writes the brief with inline [1][2] citations back to source."],
                ["05", "Fact-Checker", "Verifies every number against the source — retries the draft if unsupported."],
              ].map(([n, title, body]) => (
                <div key={n} className="lp-lift lp-pop" style={{ background: "#0A0A0A", padding: "26px 20px", border: "1px solid transparent" }}>
                  <div className="mono" style={{ color: "#555", fontSize: 11, marginBottom: 14 }}>{n}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{title}</div>
                  <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6 }}>{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LIVE BRIEF EXAMPLE */}
        <div style={{ padding: "100px 40px", borderBottom: "1px solid #1c1c1c", background: "#0d0d0d" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 64, alignItems: "center" }}>
            <div className="lp-slide-left">
              <div className="mono" style={{ color: BLUE, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14 }}>GROUNDED, CITED, VERIFIED</div>
              <h2 style={{ fontSize: 34, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-0.01em" }}>Every claim traces back to a source.</h2>
              <p style={{ fontSize: 15, color: "#888", lineHeight: 1.75, margin: "0 0 28px" }}>
                No hallucinated numbers. Every figure in a brief is checked against the original filing — and flagged for a rewrite if it isn't supported.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="mono" style={{ fontSize: 11, border: "1px solid #00E676", color: "#00E676", padding: "4px 10px" }}>VERIFIED</span>
                <span className="mono" style={{ fontSize: 11, border: "1px solid #FF0055", color: "#FF0055", padding: "4px 10px" }}>FLAGGED</span>
              </div>
            </div>
            <div className="lp-slide-right" style={{ background: "#0A0A0A", border: "1px solid #222" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #1c1c1c" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Tesla, Inc. — Q2 2026 Snapshot</span>
                <span className="mono" style={{ fontSize: 10, border: "1px solid #00E676", color: "#00E676", padding: "3px 8px" }}>COMPLETE · VERIFIED</span>
              </div>
              <div style={{ padding: "22px 24px", fontSize: 13.5, lineHeight: 1.85, color: "#c8c8c8" }}>
                Revenue grew to <span className="mono" style={{ color: "#E0E0E0" }}>$27.4B</span> in the quarter <a href="#">[1]</a>, driven by energy storage deployments, which management called "the fastest-growing segment" <a href="#">[2]</a>. Automotive gross margin held at <span className="mono" style={{ color: "#E0E0E0" }}>18.2%</span> <a href="#">[3]</a> despite pricing pressure across the lineup.
              </div>
              <div className="mono" style={{ display: "flex", gap: 16, padding: "14px 24px", borderTop: "1px solid #1c1c1c", color: "#555", fontSize: 11 }}>
                <span>[1] 10-Q, p.4</span><span>[2] Earnings call</span><span>[3] 10-Q, p.9</span>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <div id="features" style={{ padding: "100px 40px", borderBottom: "1px solid #1c1c1c" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div className="mono" style={{ color: BLUE, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14, textAlign: "center" }}>BUILT FOR RESEARCH, NOT DEMOS</div>
            <h2 style={{ fontSize: 36, fontWeight: 600, textAlign: "center", margin: "0 0 60px", letterSpacing: "-0.01em" }}>Everything a research desk needs.</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#1c1c1c" }}>
              {[
                ["⌗", BLUE, "Hybrid RAG retrieval", "BM25 keyword search fused with dense embeddings, re-ranked by a cross-encoder for precision."],
                ["✓", "#00E676", "Automatic fact-checking", "Unsupported claims are flagged and the draft is retried until every number is grounded."],
                ["◱", "#FFCC00", "Quality scorecard", "RAGAS-style scoring on faithfulness, context precision, and answer relevance for every brief."],
                ["⇄", BLUE, "Any LLM provider", "Gemini, OpenAI, Anthropic, Groq, OpenRouter, DeepSeek, Mistral, or any OpenAI-compatible endpoint."],
                ["▣", "#FF0055", "Multiple ingest paths", "Auto-fetch from SEC EDGAR, paste text, load demo filings, or upload earnings-call audio."],
                ["⧉", "#00E676", "Compare & follow up", "Line up reports side by side and ask follow-up questions that build on a prior brief."],
              ].map(([icon, color, title, body]) => (
                <div key={title} className="lp-lift lp-pop" style={{ background: "#0A0A0A", padding: 32, border: "1px solid transparent" }}>
                  <div style={{ color, fontSize: 20, marginBottom: 16 }}>{icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#888", lineHeight: 1.7 }}>{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PRICING */}
        <div id="pricing" style={{ padding: "100px 40px", borderBottom: "1px solid #1c1c1c", background: "#0d0d0d" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div className="mono" style={{ color: BLUE, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14, textAlign: "center" }}>PRICING</div>
            <h2 style={{ fontSize: 36, fontWeight: 600, textAlign: "center", margin: "0 0 60px", letterSpacing: "-0.01em" }}>Bring your own key. Pay the provider, not us.</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#1c1c1c" }}>
              {[
                ["SELF-HOSTED", "#666", "$0", "Run locally, use free-tier or self-hosted models", ["Gemini / Groq free tier", "Local Ollama / LM Studio", "One-command launcher", "MIT licensed, fully open"], false],
                ["HOSTED", BLUE, "Usage-based", "We run the pipeline, you bring any provider key", ["Everything in Self-Hosted", "Managed retrieval index", "SSE pipeline streaming", "Priority support"], true],
                ["DESK / TEAM", "#666", "Contact us", "Shared coverage, history, and comparisons across a desk", ["Everything in Hosted", "Shared coverage & history", "Compare across analysts", "SSO on request"], false],
              ].map(([tier, tierColor, price, sub, feats, featured]) => (
                <div key={tier} className="lp-lift" style={{ background: "#0A0A0A", padding: "36px 30px", border: "1px solid transparent", borderTop: featured ? `2px solid ${PURPLE}` : "1px solid transparent" }}>
                  <div className="mono" style={{ fontSize: 11, color: tierColor, letterSpacing: "0.12em", marginBottom: 10 }}>{tier}</div>
                  <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 6 }}>{price}</div>
                  <div style={{ fontSize: 12.5, color: "#666", marginBottom: 24 }}>{sub}</div>
                  <div className="mono" style={{ fontSize: 12, color: "#888", lineHeight: 2.1 }}>
                    {feats.map((f, i) => (<span key={f}>{i > 0 && <br />}{f}</span>))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div id="faq" style={{ padding: "100px 40px", borderBottom: "1px solid #1c1c1c" }}>
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <div className="mono" style={{ color: BLUE, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14, textAlign: "center" }}>FAQ</div>
            <h2 style={{ fontSize: 36, fontWeight: 600, textAlign: "center", margin: "0 0 50px", letterSpacing: "-0.01em" }}>Questions, answered.</h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                ["Which LLM provider do I need?", "Any one — Gemini, OpenAI, Anthropic, Groq, OpenRouter, DeepSeek, Mistral, or a self-hosted OpenAI-compatible endpoint. Gemini's free tier is the simplest zero-cost start."],
                ["How does the fact-checking actually work?", "A dedicated fact-checker agent compares every numeric claim in the drafted brief against the retrieved source passages, then triggers a retry if a claim isn't grounded."],
                ["Which companies and filings are supported?", "Any US-listed company via SEC EDGAR, plus bundled NSE/BSE-listed tickers. You can also paste text or upload an earnings-call recording."],
                ["Is my API key safe?", "Keys pasted into the app live in your browser only and are sent per-request — they never touch our server beyond that single call."],
                ["Can I run this myself?", "Yes — it's MIT licensed. One command downloads a portable MongoDB, installs dependencies, and starts the app locally."],
              ].map(([q, a], i, arr) => (
                <div key={q} className={i < 4 ? `lp-fade${i + 1}` : undefined} style={{ borderTop: "1px solid #1c1c1c", borderBottom: i === arr.length - 1 ? "1px solid #1c1c1c" : undefined, padding: "22px 0" }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{q}</div>
                  <div style={{ fontSize: 13.5, color: "#888", lineHeight: 1.7 }}>{a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FINAL CTA */}
        <div className="lp-glines" style={{ padding: "110px 40px", textAlign: "center", borderBottom: "1px solid #1c1c1c" }}>
          <h2 style={{ fontSize: 40, fontWeight: 600, margin: "0 0 18px", letterSpacing: "-0.01em" }}>Stop reading 40-page filings.</h2>
          <p style={{ fontSize: 15, color: "#888", margin: "0 0 36px" }}>Ask the question. Get the cited answer.</p>
          <button onClick={toApp} className="lp-btn lp-glow" style={{ background: "#E0E0E0", color: "#0A0A0A", border: "none", padding: "15px 32px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", cursor: "pointer" }}>TRY FOR FREE →</button>
        </div>

        {/* FOOTER */}
        <div style={{ padding: "48px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mono" style={{ color: BLUE, fontSize: 14 }}>&gt;_</span>
            <span className="mono" style={{ fontSize: 11, color: "#555" }}>ALPHASCRIBE · EQUITY INTEL · MIT LICENSED</span>
          </div>
          <div className="mono" style={{ display: "flex", gap: 28, fontSize: 11, color: "#666" }}>
            <a href="#" style={{ color: "#666" }}>GitHub</a>
            <a onClick={() => nav("/docs")} style={{ color: "#666", cursor: "pointer" }}>Docs</a>
            <a href="#how" style={{ color: "#666" }}>Pipeline</a>
            <a href="#pricing" style={{ color: "#666" }}>Pricing</a>
          </div>
        </div>
      </div>
    </div>
  );
}
