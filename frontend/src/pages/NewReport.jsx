import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ensureCompany,
  generateReport,
  ingestSamples,
  listReports,
  listTickers,
} from "@/lib/api";
import { NEW_REPORT } from "@/constants/testIds";
import { useJobs } from "@/lib/jobs";
import { useLlm } from "@/lib/llmSettings";
import CompanyCombobox from "@/components/CompanyCombobox";
import {
  Play,
  Sparkle,
  ArrowRight,
  ChartBar,
  ShieldWarning,
  TrendUp,
  TrendDown,
  DownloadSimple,
  Command,
} from "@phosphor-icons/react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay } },
});

// Clickable starters that fill the question box — give the page something to
// do beyond the empty composer and hint at what a good question looks like.
const EXAMPLES = [
  "How did gross margin trend this quarter, and why?",
  "What are the three biggest disclosed risks?",
  "Summarize any changes to full-year guidance.",
  "Break down revenue growth by segment.",
  "What did management say about demand?",
  "How is free cash flow developing?",
];

const PRESETS = [
  {
    id: "snapshot",
    icon: ChartBar,
    label: "Quarter Snapshot",
    hint: "Summarize the latest quarter and management outlook.",
    accent: "#2563EB",
  },
  {
    id: "bull",
    icon: TrendUp,
    label: "Bull Thesis",
    hint: "What are the strongest bull-case drivers management is highlighting?",
    accent: "#059669",
  },
  {
    id: "bear",
    icon: TrendDown,
    label: "Bear / Risks",
    hint: "What are the biggest risks and headwinds disclosed?",
    accent: "#DC2626",
  },
  {
    id: "financials",
    icon: ShieldWarning,
    label: "Financial Deep-Dive",
    hint: "Break down segment performance, margins, and cash flow.",
    accent: "#D97706",
  },
];

export default function Dashboard() {
  const [selected, setSelected] = useState(null); // {ticker, name, has_filings}
  const [query, setQuery] = useState(PRESETS[0].hint);
  const [activePreset, setActivePreset] = useState("snapshot");
  const [submitting, setSubmitting] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [tickers, setTickers] = useState([]);
  const searchRef = useRef(null);
  const nav = useNavigate();
  const location = useLocation();
  const { startJob } = useJobs();
  const { payload: llmPayload } = useLlm();
  const { refresh } = useOutletContext() || {};

  useEffect(() => {
    Promise.all([listReports(), listTickers()])
      .then(([r, t]) => {
        setReportCount(r.length);
        setTickers(t);
      })
      .catch(() => {});
  }, []);

  // Preselect a company when arriving from a Watchlist item (sidebar → New
  // Report). Re-runs once tickers load so has_filings is accurate.
  useEffect(() => {
    const st = location.state;
    if (st?.pickTicker) {
      setSelected({
        ticker: st.pickTicker,
        name: st.pickName || st.pickTicker,
        has_filings: tickers.includes(st.pickTicker),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, tickers]);

  // Cmd/Ctrl+K to focus search from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.querySelector(`[data-testid="${NEW_REPORT.tickerInput}"]`);
        input?.focus();
      } else if (e.key === "/" && document.activeElement === document.body) {
        e.preventDefault();
        const input = document.querySelector(`[data-testid="${NEW_REPORT.tickerInput}"]`);
        input?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pickPreset = (p) => {
    setActivePreset(p.id);
    setQuery(p.hint);
  };

  const runOrEnsure = async () => {
    if (!selected) {
      toast.error("Pick a company first");
      return;
    }
    if (!query.trim()) {
      toast.error("Add a question");
      return;
    }
    if (selected.exchange === "IN" && selected.has_filings === false) {
      toast.error(
        "NSE/BSE auto-fetch isn't supported — please ingest a filing first",
      );
      nav("/ingest");
      return;
    }

    // if this company has no filings ingested, fetch from EDGAR first
    if (selected.has_filings === false) {
      setEnsuring(true);
      try {
        const r = await ensureCompany(selected.ticker);
        if (r.action === "ingested_from_edgar") {
          toast.success(
            `Fetched ${r.source} from SEC — ${r.num_chunks} chunks (${
              r.filing_date || "date unknown"
            })`,
          );
        } else if (r.action === "ingested_from_bse") {
          toast.success(`Fetched ${r.source} from BSE — ${r.num_chunks} chunks`);
        }
        setSelected({ ...selected, has_filings: true });
      } catch (err) {
        const detail = err?.response?.data?.detail || err.message;
        toast.error(String(detail).slice(0, 300));
        setEnsuring(false);
        return;
      } finally {
        setEnsuring(false);
      }
    }

    setSubmitting(true);
    try {
      const { job_id, cached } = await generateReport({
        ticker: selected.ticker,
        query: query.trim(),
        ...llmPayload(),
      });
      if (cached) {
        toast.success(`Cached report for ${selected.name} — open it or use Re-run for fresh`);
      } else {
        startJob(job_id, { ticker: selected.ticker, query: query.trim() });
        toast.success(`Analyzing ${selected.name}…`);
      }
      refresh?.();
      nav(`/reports/${job_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const r = await ingestSamples();
      toast.success(
        r.ingested.length
          ? `Loaded ${r.ingested.length} sample filings`
          : "Sample corpus already loaded",
      );
      const [nr, t] = await Promise.all([listReports(), listTickers()]);
      setReportCount(nr.length);
      setTickers(t);
      refresh?.();
    } catch {
      toast.error("Seeding failed");
    } finally {
      setSeeding(false);
    }
  };

  const busy = submitting || ensuring;

  return (
    <div data-testid={NEW_REPORT.root} className="min-h-screen flex flex-col">
      {/* Slim top bar — centered */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="h-14 px-6 flex items-center justify-center gap-6 flex-wrap">
          <span className="mono text-[10px] text-muted-foreground uppercase tracking-widest">
            /home
          </span>
          <span className="mono text-xs text-primary/70">generate a research brief</span>
          <div className="flex items-center gap-4 mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span><span className="text-primary tabular-nums">{tickers.length}</span> companies</span>
            <span><span className="text-primary tabular-nums">{reportCount}</span> reports</span>
            <span><span className="text-bullish">●</span> LLM online</span>
          </div>
        </div>
      </div>

      {/* Composer — the report itself generates on /reports/:id */}
      <div className="flex-1 px-6 py-10 md:py-14">
        <div className="w-full max-w-[760px] mx-auto">
          {/* Composer card */}
          <motion.div
            {...fadeUp(0.08)}
            className="cell p-5 md:p-7 text-left shadow-[0_18px_50px_-28px_rgba(21,33,47,0.35)]"
          >
            {/* Search */}
            <div className="mb-5">
              <div className="label-mono mb-2 flex items-center justify-between">
                <span>Company</span>
                <span className="flex items-center gap-1 !normal-case tracking-normal text-muted-foreground/80">
                  <Command size={10} /> ⌘K or /
                </span>
              </div>
              <CompanyCombobox
                value={selected}
                onSelect={setSelected}
                onClear={() => setSelected(null)}
                autoFocus
                testId={NEW_REPORT.tickerInput}
              />
            </div>

            {/* Preset tiles */}
            <div className="label-mono mb-2">Angle</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border mb-5">
              {PRESETS.map((p) => {
                const Icon = p.icon;
                const active = activePreset === p.id;
                return (
                  <motion.button
                    key={p.id}
                    onClick={() => pickPreset(p)}
                    data-testid={`preset-${p.id}`}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                    className={`p-4 text-left bg-surface hover:bg-surface-hover ${
                      active ? "outline outline-1 outline-primary" : ""
                    }`}
                    style={active ? { borderTop: `2px solid ${p.accent}` } : {}}
                  >
                    <Icon size={18} weight={active ? "fill" : "regular"} style={{ color: active ? p.accent : "#5C6774" }} />
                    <div className="text-sm text-primary mt-2">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                      {p.hint}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Question box */}
            <label className="label-mono block mb-2">Your question</label>
            <textarea
              data-testid={NEW_REPORT.queryInput}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActivePreset(null);
              }}
              rows={2}
              placeholder="e.g. What did management say about margins?"
              className="w-full input-bg border border-border text-primary text-sm px-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />

            {/* CTA */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="mono text-[10px] text-muted-foreground text-left">
                {selected ? (
                  selected.exchange === "IN" && selected.has_filings === false ? (
                    <>
                      <span className="text-warning">◆</span>{" "}
                      <span className="text-primary">{selected.ticker}</span> is
                      on NSE/BSE — auto-fetch isn't supported. Head to{" "}
                      <button
                        type="button"
                        onClick={() => nav("/ingest")}
                        className="text-brand underline underline-offset-2"
                      >
                        Ingest
                      </button>{" "}
                      to paste a result / upload an earnings call first.
                    </>
                  ) : selected.has_filings === false ? (
                    <>
                      <span className="text-warning">◆</span> No filings yet —
                      we'll fetch the latest 10-Q from SEC before analyzing.
                    </>
                  ) : (
                    <>
                      <span className="text-bullish">●</span> Corpus ready for{" "}
                      <span className="text-primary">{selected.ticker}</span>.
                    </>
                  )
                ) : (
                  <>Type at least 2 characters to search.</>
                )}
              </div>
              <button
                onClick={runOrEnsure}
                disabled={busy || !selected || !query.trim()}
                data-testid={NEW_REPORT.submitButton}
                className="mono text-xs uppercase tracking-widest h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              >
                {busy ? (
                  <>
                    <Sparkle size={14} className="animate-pulse" />
                    {ensuring ? "Fetching filing…" : "Dispatching"}
                  </>
                ) : (
                  <>
                    <Play size={14} weight="fill" />
                    Analyze
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* Example questions — clickable starters */}
          <motion.div {...fadeUp(0.14)} className="mt-7">
            <div className="label-mono mb-2.5 text-center">Try an example</div>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setQuery(ex);
                    setActivePreset(null);
                  }}
                  className="mono text-[11px] text-muted-foreground border border-border bg-surface/50 px-3 py-1.5 hover:text-primary hover:border-primary"
                >
                  {ex}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Seed helper */}
          {reportCount === 0 && (
            <div className="mt-6 text-center mono text-[11px] text-muted-foreground">
              First time here?{" "}
              <button
                onClick={seed}
                data-testid={NEW_REPORT.seedSamplesButton}
                disabled={seeding}
                className="text-brand underline underline-offset-2 hover:text-primary"
              >
                {seeding ? "Loading samples…" : "Load a sample corpus (Apple, Microsoft, NVIDIA)"}
              </button>{" "}
              to try it in 10 seconds.
            </div>
          )}
        </div>
      </div>

      {/* Footer — centered */}
      <div className="border-t border-border px-6 md:px-12 py-5">
        <div className="mono text-[10px] text-muted-foreground flex flex-wrap items-center justify-center gap-6">
          <span>Showing {reportCount} reports</span>
          <span className="flex items-center gap-1">
            <DownloadSimple size={12} /> Every brief is downloadable as Markdown &amp; PDF
          </span>
        </div>
      </div>
    </div>
  );
}
