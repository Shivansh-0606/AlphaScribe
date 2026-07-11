import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  ensureCompany,
  generateReport,
  ingestSamples,
  listReports,
  listTickers,
} from "@/lib/api";
import { DASHBOARD } from "@/constants/testIds";
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

const PRESETS = [
  {
    id: "snapshot",
    icon: ChartBar,
    label: "Quarter Snapshot",
    hint: "Summarize the latest quarter and management outlook.",
    accent: "#4A6CFF",
  },
  {
    id: "bull",
    icon: TrendUp,
    label: "Bull Thesis",
    hint: "What are the strongest bull-case drivers management is highlighting?",
    accent: "#00E676",
  },
  {
    id: "bear",
    icon: TrendDown,
    label: "Bear / Risks",
    hint: "What are the biggest risks and headwinds disclosed?",
    accent: "#FF3366",
  },
  {
    id: "financials",
    icon: ShieldWarning,
    label: "Financial Deep-Dive",
    hint: "Break down segment performance, margins, and cash flow.",
    accent: "#FFCC00",
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
        const input = document.querySelector(`[data-testid="${DASHBOARD.tickerInput}"]`);
        input?.focus();
      } else if (e.key === "/" && document.activeElement === document.body) {
        e.preventDefault();
        const input = document.querySelector(`[data-testid="${DASHBOARD.tickerInput}"]`);
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
    <div data-testid={DASHBOARD.root} className="min-h-screen flex flex-col">
      {/* Slim top bar — centered */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
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

      {/* Centered composer — the report itself generates on /reports/:id */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[720px] text-center">
          {/* Search */}
          <div className="text-left mb-6">
            <div className="label-mono mb-2">Search reports</div>
            <CompanyCombobox
              value={selected}
              onSelect={setSelected}
              onClear={() => setSelected(null)}
              autoFocus
              testId={DASHBOARD.tickerInput}
            />
            <div className="mt-1.5 mono text-[10px] text-muted-foreground text-right flex items-center justify-end gap-1">
              <Command size={10} />
              press <span className="text-primary">⌘K</span> or <span className="text-primary">/</span> to jump here from anywhere
            </div>
          </div>

          {/* Preset tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border mb-6">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              const active = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => pickPreset(p)}
                  data-testid={`preset-${p.id}`}
                  className={`p-4 text-left bg-surface hover:bg-surface-hover transition-none ${
                    active ? "outline outline-1 outline-primary" : ""
                  }`}
                  style={active ? { borderTop: `2px solid ${p.accent}` } : {}}
                >
                  <Icon size={18} weight={active ? "fill" : "regular"} style={{ color: active ? p.accent : "#888" }} />
                  <div className="text-sm text-primary mt-2">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                    {p.hint}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Question box */}
          <div className="text-left">
            <label className="label-mono block mb-2">Your question</label>
            <textarea
              data-testid={DASHBOARD.queryInput}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActivePreset(null);
              }}
              rows={2}
              placeholder="e.g. What did management say about margins?"
              className="w-full input-bg border border-border text-primary text-sm px-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

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
              data-testid={DASHBOARD.submitButton}
              className="mono text-xs uppercase tracking-widest h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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

          {/* Seed helper */}
          {reportCount === 0 && (
            <div className="mt-8 mono text-[11px] text-muted-foreground">
              First time here?{" "}
              <button
                onClick={seed}
                data-testid={DASHBOARD.seedSamplesButton}
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
