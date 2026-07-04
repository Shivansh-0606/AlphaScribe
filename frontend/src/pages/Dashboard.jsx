import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import {
  ensureCompany,
  generateReport,
  ingestSamples,
  listReports,
  listTickers,
  trendingCompanies,
} from "@/lib/api";
import { DASHBOARD } from "@/constants/testIds";
import CompanyCombobox from "@/components/CompanyCombobox";
import { useWatchlist } from "@/lib/watchlist";
import {
  Play,
  Sparkle,
  ArrowRight,
  ChartBar,
  ShieldWarning,
  TrendUp,
  TrendDown,
  Star,
  Clock,
  Buildings,
  DownloadSimple,
  Fire,
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
  const [trending, setTrending] = useState([]);
  const searchRef = useRef(null);
  const nav = useNavigate();
  const { refresh, companies = {} } = useOutletContext() || {};
  const { watchlist } = useWatchlist();

  useEffect(() => {
    Promise.all([listReports(), listTickers(), trendingCompanies()])
      .then(([r, t, tr]) => {
        setReportCount(r.length);
        setTickers(t);
        setTrending(tr || []);
      })
      .catch(() => {});
  }, []);

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
      const { job_id } = await generateReport({
        ticker: selected.ticker,
        query: query.trim(),
      });
      toast.success(`Analyzing ${selected.name}…`);
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
    <div data-testid={DASHBOARD.root} className="min-h-screen">
      {/* Slim top bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="h-14 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="mono text-[10px] text-muted-foreground uppercase tracking-widest">
              /home
            </span>
            <span className="mono text-xs text-primary/70">generate a research brief</span>
          </div>
          <div className="flex items-center gap-4 mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span><span className="text-primary tabular-nums">{tickers.length}</span> companies</span>
            <span><span className="text-primary tabular-nums">{reportCount}</span> reports</span>
            <span><span className="text-bullish">●</span> LLM online</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="px-6 md:px-12 pt-14 pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="label-mono mb-4">Multi-agent equity research</div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl tracking-tight font-medium mb-4">
            Ask a company a question.
            <br />
            Get a <span className="text-brand">fact-checked</span> answer.
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
            Search any US-listed company, pick a question, and AlphaScribe pulls
            the latest SEC filing, extracts financials, gauges management tone,
            drafts a brief, and verifies every number before you see it.
          </p>

          {/* Search */}
          <div className="max-w-2xl mx-auto text-left mb-3">
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

          {/* Trending chips */}
          {trending.length > 0 && (
            <div className="max-w-2xl mx-auto text-left mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Fire size={12} className="text-warning" />
                <span className="label-mono">Trending now</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trending.map((t) => (
                  <button
                    key={t.ticker}
                    onClick={() =>
                      setSelected({
                        ticker: t.ticker,
                        name: t.name,
                        has_filings: tickers.includes(t.ticker),
                      })
                    }
                    data-testid={`trending-${t.ticker}`}
                    className="px-3 py-1.5 border border-border hover:border-primary text-left"
                    title={t.count ? `${t.count} reports` : "Popular pick"}
                  >
                    <div className="text-xs text-primary">{t.name}</div>
                    <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      {t.ticker}
                      {t.count > 0 && (
                        <span className="text-brand">· {t.count}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preset tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border max-w-3xl mx-auto mb-6">
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
          <div className="max-w-2xl mx-auto text-left">
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
          <div className="max-w-2xl mx-auto mt-4 flex items-center justify-between gap-3">
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

      {/* Watchlist + Coverage strip */}
      {(watchlist.length > 0 || tickers.length > 0) && (
        <div className="border-t border-border px-6 md:px-12 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} weight="fill" className="text-warning" />
                <span className="label-mono">Watchlist</span>
              </div>
              {watchlist.length === 0 ? (
                <p className="mono text-[11px] text-muted-foreground">
                  Star companies in search or on the report page to pin them here.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {watchlist.map((w) => (
                    <button
                      key={w.ticker}
                      onClick={() => setSelected({ ...w, has_filings: tickers.includes(w.ticker) })}
                      data-testid={`watchlist-item-${w.ticker}`}
                      className="px-3 py-1.5 border border-border hover:border-primary text-left"
                    >
                      <div className="text-xs text-primary">{w.name}</div>
                      <div className="mono text-[9px] uppercase text-muted-foreground">
                        {w.ticker}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Buildings size={14} className="text-brand" />
                <span className="label-mono">Coverage</span>
                <span className="mono text-[10px] text-muted-foreground">
                  {tickers.length} ingested
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tickers.length === 0 && (
                  <span className="mono text-[11px] text-muted-foreground">— empty —</span>
                )}
                {tickers.map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setSelected({
                        ticker: t,
                        name: companies[t] || t,
                        has_filings: true,
                      })
                    }
                    data-testid={DASHBOARD.tickerChip(t)}
                    className={`px-3 py-1.5 border text-left leading-tight ${
                      selected?.ticker === t
                        ? "border-primary bg-surface"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    <div className="text-xs text-primary">{companies[t] || t}</div>
                    <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {t}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline overview */}
      <div className="border-t border-border px-6 md:px-12 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="label-mono mb-4">How it works</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-border">
            {[
              ["1", "Retriever", "Hybrid BM25 + dense + rerank"],
              ["2", "Extractor", "Structured financials (Pydantic)"],
              ["3", "Tone & Risk", "Bullish / Bearish + risk factors"],
              ["4", "Synthesizer", "Cited Markdown brief (gpt-4o)"],
              ["5", "Fact-Checker", "Verify every claim · retry loop"],
            ].map(([n, title, desc]) => (
              <div key={n} className="bg-surface p-4">
                <div className="mono text-[10px] text-brand mb-1">NODE {n}</div>
                <div className="text-sm text-primary mb-1">{title}</div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 md:px-12 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between mono text-[10px] text-muted-foreground">
          <div className="flex items-center gap-4">
            <Clock size={12} />
            <span>Reports typically finish in 30–50s</span>
          </div>
          <div className="flex items-center gap-4">
            <DownloadSimple size={12} />
            <span>Every brief is downloadable as Markdown</span>
          </div>
        </div>
      </div>
    </div>
  );
}
