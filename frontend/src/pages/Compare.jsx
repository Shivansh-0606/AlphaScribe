import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { listReports, compareReports } from "@/lib/api";
import { usePersistedState } from "@/lib/persist";
import { COMPARE } from "@/constants/testIds";
import { Scales, CheckSquare, Square, CheckCircle, Warning, Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";

const FIN_FIELDS = [
  ["revenue", "Revenue"],
  ["revenue_yoy", "YoY"],
  ["eps", "EPS"],
  ["net_income", "Net Income"],
  ["operating_margin", "Op. Margin"],
  ["free_cash_flow", "FCF"],
  ["guidance", "Guidance"],
];

const pct = (v) => Math.round((v ?? 0) * 100);

function QualityChart({ loaded, companies }) {
  const data = loaded.map((r) => ({
    name: (r.company_name || companies[r.ticker] || r.ticker).slice(0, 16),
    Overall: pct(r.scorecard?.overall),
    Faithfulness: pct(r.scorecard?.faithfulness),
    Precision: pct(r.scorecard?.context_precision),
    Relevance: pct(r.scorecard?.answer_relevance),
    Confidence: Math.round((r.sentiment_analysis?.confidence ?? 0) * 100),
  }));
  const COLORS = {
    Overall: "#059669", Faithfulness: "#2563EB", Precision: "#D97706",
    Relevance: "#EA580C", Confidence: "#7C3AED",
  };
  return (
    <div className="border-t border-border p-6">
      <div className="label-mono mb-3">Quality & confidence comparison (%)</div>
      <div className="cell p-4" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))",
                borderRadius: 0, fontSize: 12, fontFamily: "IBM Plex Mono, monospace",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {Object.entries(COLORS).map(([k, c]) => (
              <Bar key={k} dataKey={k} fill={c} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Compare() {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = usePersistedState("compare:selected", []);   // list of ids
  const [loaded, setLoaded] = usePersistedState("compare:loaded", []);
  const [loading, setLoading] = useState(false);
  const [qualityFilter, setQualityFilter] = usePersistedState("compare:qfilter", false);
  const [search, setSearch] = usePersistedState("compare:search", "");
  const { companies = {} } = useOutletContext() || {};
  const chartRef = useRef(null);

  useEffect(() => {
    listReports().then(setReports).catch(() => {});
  }, []);

  // Smoothly bring the graph into view once it has rendered.
  const scrollToChart = () => {
    // Two rAFs so Recharts has committed layout before we measure/scroll.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      ),
    );
  };

  const maxReached = selected.length >= 4;

  const toggle = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        toast.error("Max 4 reports");
        return prev;
      }
      return [...prev, id];
    });
  };

  const runCompare = async () => {
    if (selected.length < 2) {
      toast.error("Select at least 2 reports");
      return;
    }
    setLoading(true);
    try {
      const rows = await compareReports(selected);
      setLoaded(rows);
      if (rows.length >= 2) scrollToChart();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setSelected([]);
    setLoaded([]);
  };

  const grouped = useMemo(() => {
    const s = search.trim().toLowerCase();
    let filtered = qualityFilter
      ? reports.filter((r) => (r.scorecard?.overall ?? 0) >= 0.8)
      : reports;
    if (s) {
      filtered = filtered.filter((r) => {
        const name = (r.company_name || companies[r.ticker] || r.ticker).toLowerCase();
        const tk = (r.ticker || "").toLowerCase();
        const q = (r.query || "").toLowerCase();
        return name.includes(s) || tk.includes(s) || q.includes(s);
      });
    }
    const map = new Map();
    filtered.forEach((r) => {
      if (!map.has(r.ticker)) map.set(r.ticker, []);
      map.get(r.ticker).push(r);
    });
    return Array.from(map.entries()).sort();
  }, [reports, qualityFilter, search, companies]);

  return (
    <div data-testid={COMPARE.root} className="min-h-screen">
      {/* Command bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="h-14 px-6 flex items-center gap-3">
          <Scales size={16} className="text-primary" />
          <span className="mono text-[10px] text-muted-foreground uppercase tracking-widest">
            /compare
          </span>
          <span className="mono text-xs text-brand">
            side-by-side portfolio view
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setQualityFilter((v) => !v)}
              data-testid="compare-quality-filter"
              title="Only show reports with overall score ≥ 80%"
              className={`mono text-[11px] uppercase tracking-widest px-3 h-8 border inline-flex items-center gap-1 ${
                qualityFilter
                  ? "border-bullish text-bullish"
                  : "border-border text-muted-foreground hover:text-primary hover:border-primary"
              }`}
            >
              <Funnel size={12} weight={qualityFilter ? "fill" : "regular"} />
              Grade ≥ 80%
            </button>
            <span className="mono text-[10px] text-muted-foreground">
              {selected.length}/4 selected
            </span>
            <button
              onClick={clear}
              data-testid={COMPARE.clearButton}
              className="mono text-[11px] uppercase tracking-widest px-3 h-8 border border-border text-muted-foreground hover:text-primary hover:border-primary"
            >
              Clear
            </button>
            <button
              onClick={runCompare}
              disabled={loading || selected.length < 2}
              data-testid={COMPARE.runButton}
              className="mono text-[11px] uppercase tracking-widest px-3 h-8 bg-primary text-primary-foreground disabled:opacity-40"
            >
              {loading ? "Loading…" : "Compare"}
            </button>
          </div>
        </div>
      </div>

      {/* Picker */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="label-mono">Pick 2 – 4 reports</div>
        </div>

        {/* Search bar */}
        <div className="mb-4 max-w-xl">
          <div
            className={`flex items-center border ${
              search ? "border-primary" : "border-border"
            } input-bg focus-within:border-primary`}
          >
            <MagnifyingGlass size={14} className="text-muted-foreground ml-3 shrink-0" />
            <input
              data-testid="compare-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, ticker, or question…"
              className="flex-1 bg-transparent text-primary text-sm px-3 py-2 focus:outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                data-testid="compare-search-clear"
                className="text-muted-foreground hover:text-primary mr-2 p-1"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="cell p-6 mono text-xs text-muted-foreground">
            No reports yet. Generate a few first from the New Report page.
          </div>
        ) : grouped.length === 0 ? (
          <div className="cell p-6 mono text-xs text-muted-foreground">
            No reports match "{search}"{qualityFilter ? " with Grade ≥ 80%" : ""}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {grouped.flatMap(([tk, list]) =>
              list.map((r) => {
                const isSelected = selected.includes(r.id);
                const disabled = !isSelected && maxReached;
                const name = r.company_name || companies[tk] || tk;
                return (
                  <button
                    key={r.id}
                    onClick={() => !disabled && toggle(r.id)}
                    data-testid={COMPARE.addRow(r.id)}
                    disabled={disabled}
                    aria-disabled={disabled}
                    className={`bg-surface p-4 text-left flex gap-3 transition-none ${
                      isSelected ? "outline outline-1 outline-primary" : ""
                    } ${
                      disabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-surface-hover cursor-pointer"
                    }`}
                  >
                    <div className="mt-0.5">
                      {isSelected ? (
                        <CheckSquare size={16} weight="fill" className="text-primary" />
                      ) : (
                        <Square size={16} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-primary truncate">{name}</span>
                        <span
                          className={`mono text-[10px] uppercase shrink-0 ${
                            r.fact_check_status ? "text-bullish" : "text-bearish"
                          }`}
                        >
                          {r.fact_check_status ? "✓" : "⚠"} {pct(r.scorecard?.overall)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="mono text-[10px] text-muted-foreground">{tk}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {r.query}
                      </div>
                      <div className="mono text-[10px] text-muted-foreground mt-1">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                  </button>
                );
              }),
            )}
          </div>
        )}
      </div>

      {/* Quality comparison chart */}
      <div ref={chartRef} className="scroll-mt-16">
        {loaded.length >= 2 && <QualityChart loaded={loaded} companies={companies} />}
      </div>

      {/* Result columns */}
      {loaded.length >= 2 && (
        <div className="border-t border-border">
          <div className="grid gap-px bg-border" style={{ gridTemplateColumns: `repeat(${loaded.length}, minmax(0,1fr))` }}>
            {loaded.map((r) => (
              <div
                key={r.id}
                data-testid={COMPARE.column(r.id)}
                className="bg-background p-5"
              >
                {/* Header */}
                <div className="mb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-lg text-primary truncate">
                      {r.company_name || companies[r.ticker] || r.ticker}
                    </div>
                    <span
                      className={`mono text-[10px] uppercase px-1.5 py-0.5 border shrink-0 inline-flex items-center gap-1 ${
                        r.fact_check_status ? "border-bullish text-bullish" : "border-bearish text-bearish"
                      }`}
                    >
                      {r.fact_check_status ? <CheckCircle size={10} /> : <Warning size={10} />}
                      {r.fact_check_status ? "Verified" : "Flagged"}
                    </span>
                  </div>
                  <div className="mono text-[10px] tracking-widest uppercase text-muted-foreground mt-0.5">
                    {r.ticker}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-4">{r.query}</div>

                {/* Tone */}
                <div className="cell p-3 mb-3">
                  <div className="label-mono mb-1">Tone</div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`mono text-sm ${
                        r.sentiment_analysis?.sentiment === "Bullish"
                          ? "text-bullish"
                          : r.sentiment_analysis?.sentiment === "Bearish"
                          ? "text-bearish"
                          : "text-muted-foreground"
                      }`}
                    >
                      {r.sentiment_analysis?.sentiment || "—"}
                    </span>
                    <span className="mono text-xs tabular-nums text-primary">
                      {Math.round((r.sentiment_analysis?.confidence ?? 0) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Financials */}
                <div className="cell mb-3">
                  <div className="px-3 py-2 border-b border-border label-mono">Financials</div>
                  <table className="w-full mono text-xs tabular-nums">
                    <tbody>
                      {FIN_FIELDS.map(([k, l]) => (
                        <tr key={k} className="border-b border-border/60 last:border-b-0">
                          <td className="px-3 py-1.5 label-mono !text-[10px] !tracking-[0.15em]">
                            {l}
                          </td>
                          <td className="px-3 py-1.5 text-right text-primary">
                            {r.extracted_data?.[k] || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Scorecard */}
                <div className="cell p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="label-mono">Quality</div>
                    <span className="mono text-xs tabular-nums text-primary">
                      {pct(r.scorecard?.overall)}%
                    </span>
                  </div>
                  <div className="space-y-1.5 mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Faithfulness</span>
                      <span className="text-primary tabular-nums">
                        {pct(r.scorecard?.faithfulness)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ctx. precision</span>
                      <span className="text-primary tabular-nums">
                        {pct(r.scorecard?.context_precision)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ans. relevance</span>
                      <span className="text-primary tabular-nums">
                        {pct(r.scorecard?.answer_relevance)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top risks */}
                <div className="cell p-3 mb-3">
                  <div className="label-mono mb-2">Top risks</div>
                  <ul className="text-xs space-y-1 text-primary/90">
                    {(r.sentiment_analysis?.key_risks || []).slice(0, 3).map((x, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-bearish mono">▸</span>
                        <span>{x}</span>
                      </li>
                    ))}
                    {(!r.sentiment_analysis?.key_risks?.length) && (
                      <li className="mono text-[11px] text-muted-foreground">—</li>
                    )}
                  </ul>
                </div>

                {/* Brief preview */}
                <div className="cell p-3">
                  <div className="label-mono mb-2">Brief (excerpt)</div>
                  <div className="prose dark:prose-invert max-w-none prose-headings:text-primary prose-headings:text-sm prose-p:text-xs prose-p:leading-relaxed prose-p:text-primary/90 prose-strong:text-primary prose-a:text-brand prose-li:text-xs prose-li:text-primary/90 prose-code:text-brand max-h-64 overflow-y-auto">
                    <ReactMarkdown>
                      {(r.draft_report || "").slice(0, 800)}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
