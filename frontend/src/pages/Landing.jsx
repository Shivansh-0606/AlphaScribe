import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";

// Marketing landing page. Warm-light / editorial-fintech redesign — cream paper
// canvas, ink-navy type, an emerald→teal signature accent, mesh-gradient hero
// glow, and a layered animation pass (entrance fades, pop-in, hover-lift,
// shimmer, gradient-CTA glow, slide-in, nav underline). CTAs route into /app.
const INK = "#15212F";       // primary text / ink navy
const PAPER = "#EEEAE2";     // warm parchment canvas (softened from glare)
const CARD = "#F6F3EF";      // soft off-white card (lifts off paper, not pure white)
const BAND = "#E8E2D8";      // slightly deeper section band
const SLATE = "#59626F";     // muted text
const BORDER = "#DBD5CC";    // warm hairline
const EMERALD = "#047857";   // legible accent (links, labels)
const EMERALD_HI = "#089A70"; // deep emerald (gradients) — rich, not neon
const TEAL = "#0E9488";      // deep teal end of the signature gradient
const GREEN = "#059669";
const RED = "#DC2626";
const AMBER = "#C2740B";
const GRAD = `linear-gradient(135deg, ${EMERALD_HI}, ${TEAL})`;

// Scroll-reveal presets — sections fade/slide in as they enter the viewport
// (Framer Motion whileInView), replacing the old load-time CSS entrances below
// the fold. `once` so they don't re-run on scroll-back.
const EASE = [0.16, 1, 0.3, 1];
const REVEAL = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: EASE },
};
const REVEAL_L = {
  initial: { opacity: 0, x: -28 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: EASE },
};
const REVEAL_R = {
  initial: { opacity: 0, x: 28 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: EASE },
};

export default function Landing() {
  const nav = useNavigate();
  const toApp = () => nav("/dashboard");
  const { user } = useAuth();
  const onLogoClick = () =>
    user ? nav("/dashboard") : window.scrollTo({ top: 0, behavior: "smooth" });

  // Mouse-driven 3D tilt on the hero dashboard mock. Writes CSS vars via ref
  // (no state re-render); a reduced-motion guard keeps it flat for those users.
  const mockRef = useRef(null);
  const tilt = (e) => {
    const el = mockRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${px * 9}deg`);
    el.style.setProperty("--rx", `${-py * 7}deg`);
  };
  const resetTilt = () => {
    const el = mockRef.current;
    if (!el) return;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  };

  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh" }}>
      <style>{`
        html { scroll-behavior: smooth; }
        .lp a { color:${EMERALD}; text-decoration:none; }
        .lp a:hover { color:${TEAL}; }
        .lp-glines {
          background-image: linear-gradient(to right,${BORDER} 1px,transparent 1px),linear-gradient(to bottom,${BORDER} 1px,transparent 1px);
          background-size: 44px 44px;
          animation: lp-drift 7s linear infinite;
        }
        .lp-mesh {
          background:
            radial-gradient(58% 48% at 12% 8%, rgba(6,145,105,0.10), transparent 62%),
            radial-gradient(52% 46% at 88% 12%, rgba(13,140,130,0.09), transparent 62%),
            radial-gradient(46% 44% at 50% 96%, rgba(6,145,105,0.05), transparent 60%);
        }
        @keyframes lp-drift { 0% { background-position:0 0; } 100% { background-position:44px 44px; } }
        .lp-hero-aurora { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; }
        .lp-hero-aurora::before {
          content:''; position:absolute; inset:-30%;
          background:
            radial-gradient(30% 40% at 20% 28%, rgba(8,154,112,0.22), transparent 60%),
            radial-gradient(28% 36% at 80% 22%, rgba(14,148,136,0.18), transparent 60%),
            radial-gradient(34% 42% at 62% 82%, rgba(8,154,112,0.13), transparent 62%);
          filter: blur(30px);
          animation: lp-aurora 22s ease-in-out infinite alternate;
        }
        @keyframes lp-aurora {
          0% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(-3%,2%,0) scale(1.08); }
          100% { transform: translate3d(3%,-2%,0) scale(1.04); }
        }
        .lp-tilt-wrap { perspective: 1300px; }
        .lp-tilt {
          transform: rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
          transform-style: preserve-3d;
          transition: transform 0.25s cubic-bezier(.16,1,.3,1);
          will-change: transform;
        }
        .lp-blink::after {
          content:''; display:inline-block; width:7px; height:1em; margin-left:3px;
          vertical-align:-2px; background:currentColor; animation: lp-blink 1s steps(2) infinite;
        }
        @keyframes lp-blink { 50% { opacity: 0; } }
        @keyframes lp-fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes lp-popIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
        @keyframes lp-slideL { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes lp-slideR { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes lp-glow { 0%,100% { box-shadow:0 8px 22px -10px rgba(6,145,105,0.28); } 50% { box-shadow:0 12px 34px -8px rgba(13,140,130,0.40); } }
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
        .lp-lift:hover { transform:translateY(-4px); border-color:${EMERALD_HI}; box-shadow:0 18px 38px -20px rgba(13,140,130,0.28); }
        .lp-btn { transition: transform 0.25s cubic-bezier(.16,1,.3,1), box-shadow 0.25s cubic-bezier(.16,1,.3,1), filter 0.25s ease; }
        .lp-btn:hover { transform:translateY(-2px); box-shadow:0 12px 26px -10px rgba(13,140,130,0.42); filter:saturate(1.05); }
        .lp-ghost { transition: border-color 0.25s ease, color 0.25s ease, background 0.25s ease; }
        .lp-ghost:hover { border-color:${EMERALD_HI}; color:${EMERALD}; background:rgba(16,185,129,0.05); }
        .lp-glow { animation: lp-glow 3s ease-in-out infinite; }
        .lp-navlink { position:relative; }
        .lp-navlink::after { content:''; position:absolute; left:0; bottom:-4px; width:0; height:2px; background:${GRAD}; transition:width 0.3s cubic-bezier(.16,1,.3,1); }
        .lp-navlink:hover::after { width:100%; }
        .lp-shimmer { position:relative; overflow:hidden; }
        .lp-shimmer::after { content:''; position:absolute; top:0; left:-150%; width:60%; height:100%; background:linear-gradient(100deg, transparent, rgba(16,185,129,0.10), transparent); animation: lp-shimmerMove 3.5s ease-in-out infinite; }
        .lp-gradtext { background:${GRAD}; -webkit-background-clip:text; background-clip:text; color:transparent; }
        @media (prefers-reduced-motion: reduce) {
          .lp-glines, .lp-blink::after, .lp-fade1, .lp-fade2, .lp-fade3, .lp-fade4,
          .lp-pop, .lp-slide-left, .lp-slide-right, .lp-glow, .lp-shimmer::after,
          .lp-hero-aurora::before {
            animation: none !important;
          }
          .lp-pop, .lp-slide-left, .lp-slide-right { opacity:1; }
          .lp-tilt { transform: none !important; }
        }
      `}</style>

      <div className="lp">
        {/* NAV */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", height: 64, background: "rgba(238,234,226,0.85)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${BORDER}` }}>
          <div
            onClick={onLogoClick}
            title={user ? "Go to dashboard" : "Back to top"}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          >
            <span className="mono lp-gradtext" style={{ fontSize: 16, fontWeight: 700 }}>&gt;_</span>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.02em" }}>ALPHA<span className="lp-gradtext">SCRIBE</span></span>
          </div>
          <div className="mono" style={{ display: "flex", gap: 32, fontSize: 12, color: SLATE }}>
            <a href="#how" className="lp-navlink" style={{ color: SLATE }}>HOW IT WORKS</a>
            <a href="#features" className="lp-navlink" style={{ color: SLATE }}>FEATURES</a>
            <a href="#pricing" className="lp-navlink" style={{ color: SLATE }}>PRICING</a>
            <a href="#faq" className="lp-navlink" style={{ color: SLATE }}>FAQ</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="mono" style={{ fontSize: 11, color: "#9AA3AE" }}>v0.1</span>
            <button onClick={toApp} className="lp-btn" style={{ background: GRAD, color: "#fff", border: "none", padding: "9px 18px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer" }}>TRY FOR FREE →</button>
          </div>
        </div>

        {/* HERO */}
        <div className="lp-mesh" style={{ position: "relative", borderBottom: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div className="lp-hero-aurora" />
          <div className="lp-glines" style={{ padding: "120px 40px 90px", textAlign: "center", position: "relative", zIndex: 1 }}>
            <div className="lp-fade1" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, background: "rgba(246,243,239,0.7)", borderRadius: 999, padding: "6px 14px", marginBottom: 26 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: EMERALD_HI, boxShadow: `0 0 0 4px rgba(16,185,129,0.18)` }} />
              <span className="mono" style={{ color: EMERALD, fontSize: 11, letterSpacing: "0.22em" }}>MULTI-AGENT EQUITY RESEARCH</span>
            </div>
            <h1 className="lp-fade2" style={{ fontSize: 64, lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 auto 24px", maxWidth: 920, color: INK }}>
              Ask a company a question.<br />Get a <span className="lp-gradtext">fact-checked</span> answer.
            </h1>
            <p className="lp-fade3" style={{ fontSize: 17, lineHeight: 1.7, color: SLATE, maxWidth: 640, margin: "0 auto 40px" }}>
              Search any US- or India-listed company and AlphaScribe pulls the latest filing, extracts the financials, gauges management tone, drafts a brief, and verifies every number before you see it.
            </p>
            <div className="lp-fade4" style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 56 }}>
              <button onClick={toApp} className="lp-btn lp-glow" style={{ background: GRAD, color: "#fff", border: "none", padding: "14px 28px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", cursor: "pointer" }}>TRY FOR FREE →</button>
              <Link to="/docs" className="lp-ghost" style={{ background: CARD, color: INK, border: `1px solid ${BORDER}`, padding: "14px 28px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, letterSpacing: "0.03em", cursor: "pointer", textDecoration: "none" }}>READ THE DOCS</Link>
            </div>

            {/* stylized dashboard mock — 3D mouse-tilt */}
            <div className="lp-tilt-wrap lp-fade4" style={{ maxWidth: 920, margin: "0 auto" }} onMouseMove={tilt} onMouseLeave={resetTilt}>
            <div ref={mockRef} className="lp-tilt" style={{ background: CARD, border: `1px solid ${BORDER}`, textAlign: "left", boxShadow: "0 40px 90px -30px rgba(21,33,47,0.28)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, background: "#EFEBE3" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E0655A" }}></div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8B23C" }}></div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: EMERALD_HI }}></div>
                <span className="mono" style={{ marginLeft: 10, color: "#9AA3AE", fontSize: 11 }}>/home &nbsp;generate a research brief</span>
              </div>
              <div style={{ padding: "28px 32px" }}>
                <div className="mono" style={{ border: `1px solid ${BORDER}`, background: "#EFEBE3", padding: "14px 16px", color: SLATE, fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: EMERALD }}>⌕</span> Search a company — e.g. Apple, Microsoft, Tesla<span className="lp-blink"></span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  {["TSLA · 2", "MSFT · 2", "HTHIY · 1", "AAPL · 1"].map((t) => (
                    <span key={t} className="mono" style={{ fontSize: 11, border: `1px solid ${BORDER}`, padding: "6px 10px", color: SLATE }}>{t}</span>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: BORDER, marginTop: 22 }}>
                  {[
                    ["▤", EMERALD, "Quarter Snapshot"],
                    ["↗", GREEN, "Bull Thesis"],
                    ["↘", RED, "Bear / Risks"],
                    ["◈", AMBER, "Financial Deep-Dive"],
                  ].map(([icon, color, label]) => (
                    <div key={label} className="lp-lift" style={{ background: CARD, padding: 16, border: "1px solid transparent" }}>
                      <div style={{ color, fontSize: 16, marginBottom: 8 }}>{icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* TRUST / STATS */}
        <motion.div {...REVEAL} style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: BORDER, borderBottom: `1px solid ${BORDER}` }}>
          {[
            ["7", EMERALD, "LLM PROVIDERS SUPPORTED", true],
            ["100%", GREEN, "CLAIMS VERIFIED VS SOURCE", true],
            ["SEC + NSE/BSE", TEAL, "FILINGS COVERAGE", false],
            ["MIT", AMBER, "OPEN SOURCE LICENSE", false],
          ].map(([big, color, small, shimmer]) => (
            <div key={small} className={`lp-lift${shimmer ? " lp-shimmer" : ""}`} style={{ background: CARD, padding: "36px 40px", textAlign: "center", border: "1px solid transparent" }}>
              <div className="mono" style={{ fontSize: 32, fontWeight: 600, color }}>{big}</div>
              <div className="mono" style={{ fontSize: 11, color: SLATE, letterSpacing: "0.12em", marginTop: 6 }}>{small}</div>
            </div>
          ))}
        </motion.div>

        {/* HOW IT WORKS */}
        <div id="how" style={{ padding: "100px 40px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div className="mono" style={{ color: EMERALD, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14, textAlign: "center" }}>THE PIPELINE</div>
            <h2 style={{ fontSize: 36, fontWeight: 600, textAlign: "center", margin: "0 0 60px", letterSpacing: "-0.01em", color: INK }}>Five agents. One fact-checked brief.</h2>
            <motion.div {...REVEAL} style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 1, background: BORDER }}>
              {[
                ["01", "Retriever", "Hybrid BM25 + dense + cross-encoder re-rank pulls the exact filing passages."],
                ["02", "Extractor", "Pulls financials from the retrieved passages in parallel with tone analysis."],
                ["03", "Tone / Risk", "Gauges management tone and surfaces disclosed risk language."],
                ["04", "Synthesizer", "Writes the brief with inline [1][2] citations back to source."],
                ["05", "Fact-Checker", "Verifies every number against the source — retries the draft if unsupported."],
              ].map(([n, title, body]) => (
                <div key={n} className="lp-lift" style={{ background: CARD, padding: "26px 20px", border: "1px solid transparent" }}>
                  <div className="mono lp-gradtext" style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{n}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: INK }}>{title}</div>
                  <div style={{ fontSize: 12.5, color: SLATE, lineHeight: 1.6 }}>{body}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* LIVE BRIEF EXAMPLE */}
        <div className="lp-mesh" style={{ padding: "100px 40px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 64, alignItems: "center" }}>
            <motion.div {...REVEAL_L}>
              <div className="mono" style={{ color: EMERALD, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14 }}>GROUNDED, CITED, VERIFIED</div>
              <h2 style={{ fontSize: 34, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-0.01em", color: INK }}>Every claim traces back to a source.</h2>
              <p style={{ fontSize: 15, color: SLATE, lineHeight: 1.75, margin: "0 0 28px" }}>
                No hallucinated numbers. Every figure in a brief is checked against the original filing — and flagged for a rewrite if it isn't supported.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="mono" style={{ fontSize: 11, border: `1px solid ${GREEN}`, color: GREEN, background: "rgba(5,150,105,0.06)", padding: "4px 10px" }}>VERIFIED</span>
                <span className="mono" style={{ fontSize: 11, border: `1px solid ${RED}`, color: RED, background: "rgba(220,38,38,0.05)", padding: "4px 10px" }}>FLAGGED</span>
              </div>
            </motion.div>
            <motion.div {...REVEAL_R} style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: "0 30px 70px -30px rgba(21,33,47,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: INK }}>Tesla, Inc. — Q2 2026 Snapshot</span>
                <span className="mono" style={{ fontSize: 10, border: `1px solid ${GREEN}`, color: GREEN, padding: "3px 8px" }}>COMPLETE · VERIFIED</span>
              </div>
              <div style={{ padding: "22px 24px", fontSize: 13.5, lineHeight: 1.85, color: "#33404E" }}>
                Revenue grew to <span className="mono" style={{ color: INK, fontWeight: 600 }}>$27.4B</span> in the quarter <a href="#">[1]</a>, driven by energy storage deployments, which management called "the fastest-growing segment" <a href="#">[2]</a>. Automotive gross margin held at <span className="mono" style={{ color: INK, fontWeight: 600 }}>18.2%</span> <a href="#">[3]</a> despite pricing pressure across the lineup.
              </div>
              <div className="mono" style={{ display: "flex", gap: 16, padding: "14px 24px", borderTop: `1px solid ${BORDER}`, color: SLATE, fontSize: 11 }}>
                <span>[1] 10-Q, p.4</span><span>[2] Earnings call</span><span>[3] 10-Q, p.9</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* FEATURES */}
        <div id="features" style={{ padding: "100px 40px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div className="mono" style={{ color: EMERALD, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14, textAlign: "center" }}>BUILT FOR RESEARCH, NOT DEMOS</div>
            <h2 style={{ fontSize: 36, fontWeight: 600, textAlign: "center", margin: "0 0 60px", letterSpacing: "-0.01em", color: INK }}>Everything a research desk needs.</h2>
            <motion.div {...REVEAL} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: BORDER }}>
              {[
                ["⌗", EMERALD, "Hybrid RAG retrieval", "BM25 keyword search fused with dense embeddings, re-ranked by a cross-encoder for precision."],
                ["✓", GREEN, "Automatic fact-checking", "Unsupported claims are flagged and the draft is retried until every number is grounded."],
                ["◱", AMBER, "Quality scorecard", "RAGAS-style scoring on faithfulness, context precision, and answer relevance for every brief."],
                ["⇄", TEAL, "Any LLM provider", "Gemini, OpenAI, Anthropic, Groq, OpenRouter, DeepSeek, Mistral, or any OpenAI-compatible endpoint."],
                ["▣", RED, "Multiple ingest paths", "Auto-fetch from SEC EDGAR, paste text, load demo filings, or upload earnings-call audio."],
                ["⧉", EMERALD, "Compare & follow up", "Line up reports side by side and ask follow-up questions that build on a prior brief."],
              ].map(([icon, color, title, body]) => (
                <div key={title} className="lp-lift" style={{ background: CARD, padding: 32, border: "1px solid transparent" }}>
                  <div style={{ color, fontSize: 20, marginBottom: 16 }}>{icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: INK }}>{title}</div>
                  <div style={{ fontSize: 13, color: SLATE, lineHeight: 1.7 }}>{body}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* PRICING */}
        <div id="pricing" style={{ padding: "100px 40px", borderBottom: `1px solid ${BORDER}`, background: BAND }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div className="mono" style={{ color: EMERALD, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14, textAlign: "center" }}>PRICING</div>
            <h2 style={{ fontSize: 36, fontWeight: 600, textAlign: "center", margin: "0 0 60px", letterSpacing: "-0.01em", color: INK }}>Bring your own key. Pay the provider, not us.</h2>
            <motion.div {...REVEAL} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: BORDER }}>
              {[
                ["SELF-HOSTED", SLATE, "$0", "Run locally, use free-tier or self-hosted models", ["Gemini / Groq free tier", "Local Ollama / LM Studio", "One-command launcher", "MIT licensed, fully open"], false],
                ["HOSTED", EMERALD, "Usage-based", "We run the pipeline, you bring any provider key", ["Everything in Self-Hosted", "Managed retrieval index", "SSE pipeline streaming", "Priority support"], true],
                ["DESK / TEAM", SLATE, "Contact us", "Coming soon", ["Everything in Hosted", "Shared coverage & history", "Compare across analysts", "SSO on request"], false],
              ].map(([tier, tierColor, price, sub, feats, featured]) => (
                <div key={tier} className="lp-lift" style={{ background: CARD, padding: "36px 30px", border: "1px solid transparent", borderTop: featured ? `2px solid ${EMERALD_HI}` : "1px solid transparent", boxShadow: featured ? "0 24px 50px -26px rgba(20,184,166,0.4)" : "none" }}>
                  <div className="mono" style={{ fontSize: 11, color: tierColor, letterSpacing: "0.12em", marginBottom: 10 }}>{tier}</div>
                  <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 6, color: INK }}>{price}</div>
                  <div style={{ fontSize: 12.5, color: SLATE, marginBottom: 24 }}>{sub}</div>
                  <div className="mono" style={{ fontSize: 12, color: SLATE, lineHeight: 2.1 }}>
                    {feats.map((f, i) => (<span key={f}>{i > 0 && <br />}<span style={{ color: EMERALD }}>✓</span> {f}</span>))}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* FAQ */}
        <div id="faq" style={{ padding: "100px 40px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <div className="mono" style={{ color: EMERALD, fontSize: 11, letterSpacing: "0.28em", marginBottom: 14, textAlign: "center" }}>FAQ</div>
            <h2 style={{ fontSize: 36, fontWeight: 600, textAlign: "center", margin: "0 0 50px", letterSpacing: "-0.01em", color: INK }}>Questions, answered.</h2>
            <motion.div {...REVEAL} style={{ display: "flex", flexDirection: "column" }}>
              {[
                ["Which LLM provider do I need?", "Any one — Gemini, OpenAI, Anthropic, Groq, OpenRouter, DeepSeek, Mistral, or a self-hosted OpenAI-compatible endpoint. Gemini's free tier is the simplest zero-cost start."],
                ["How does the fact-checking actually work?", "A dedicated fact-checker agent compares every numeric claim in the drafted brief against the retrieved source passages, then triggers a retry if a claim isn't grounded."],
                ["Which companies and filings are supported?", "Any US-listed company via SEC EDGAR, plus bundled NSE/BSE-listed tickers. You can also paste text or upload an earnings-call recording."],
                ["Is my API key safe?", "Keys pasted into the app live in your browser only and are sent per-request — they never touch our server beyond that single call."],
                ["Can I run this myself?", "Yes — it's MIT licensed. One command downloads a portable MongoDB, installs dependencies, and starts the app locally."],
              ].map(([q, a], i, arr) => (
                <div key={q} style={{ borderTop: `1px solid ${BORDER}`, borderBottom: i === arr.length - 1 ? `1px solid ${BORDER}` : undefined, padding: "22px 0" }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: INK }}>{q}</div>
                  <div style={{ fontSize: 13.5, color: SLATE, lineHeight: 1.7 }}>{a}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* FINAL CTA */}
        <div className="lp-mesh" style={{ position: "relative", borderBottom: `1px solid ${BORDER}` }}>
          <motion.div {...REVEAL} className="lp-glines" style={{ padding: "110px 40px", textAlign: "center" }}>
            <h2 style={{ fontSize: 40, fontWeight: 600, margin: "0 0 18px", letterSpacing: "-0.01em", color: INK }}>Stop reading 40-page filings.</h2>
            <p style={{ fontSize: 15, color: SLATE, margin: "0 0 36px" }}>Ask the question. Get the cited answer.</p>
            <button onClick={toApp} className="lp-btn lp-glow" style={{ background: GRAD, color: "#fff", border: "none", padding: "15px 32px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", cursor: "pointer" }}>TRY FOR FREE →</button>
          </motion.div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: "48px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20, background: BAND }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mono lp-gradtext" style={{ fontSize: 14, fontWeight: 700 }}>&gt;_</span>
            <span className="mono" style={{ fontSize: 11, color: SLATE }}>ALPHASCRIBE · EQUITY INTEL · MIT LICENSED</span>
          </div>
          <div className="mono" style={{ display: "flex", gap: 28, fontSize: 11, color: SLATE }}>
            <a href="https://github.com/Shivansh-0606/AlphaScribe" target="_blank" rel="noopener noreferrer" style={{ color: SLATE }}>GitHub</a>
            <Link to="/docs" style={{ color: SLATE, cursor: "pointer", textDecoration: "none" }}>Docs</Link>
            <a href="#how" style={{ color: SLATE }}>Pipeline</a>
            <a href="#pricing" style={{ color: SLATE }}>Pricing</a>
          </div>
        </div>
      </div>
    </div>
  );
}
