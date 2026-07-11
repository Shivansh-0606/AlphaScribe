import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteReport, listReports, listCompanies, health } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { useWatchlist } from "@/lib/watchlist";
import { APP } from "@/constants/testIds";
import { Terminal, FileText, Upload, ChartLine, Scales, Trash, CircleNotch, XCircle, Star, X } from "@phosphor-icons/react";
import LlmSettings from "@/components/LlmSettings";

const NAV_CLS = ({ isActive }) =>
  `flex items-center gap-2 px-4 h-10 text-xs mono uppercase tracking-widest border-l-2 ${
    isActive
      ? "border-primary text-primary bg-surface"
      : "border-transparent text-muted-foreground hover:text-primary hover:bg-surface"
  }`;

export default function AppLayout() {
  const [reports, setReports] = useState([]);
  const [companies, setCompanies] = useState({});
  const [retr, setRetr] = useState({ embedder: "not_loaded", reranker: "not_loaded" });
  const { watchlist, remove } = useWatchlist();
  const nav = useNavigate();

  const refresh = async () => {
    try {
      const [r, c, h] = await Promise.all([
        listReports(), listCompanies(), health()
      ]);
      setReports(r);
      setCompanies(c || {});
      setRetr(h.retrieval || {});
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 8000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div data-testid={APP.root} className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        data-testid={APP.sidebar}
        className="w-64 shrink-0 border-r border-border flex flex-col fixed top-0 left-0 h-screen z-30"
      >
        <NavLink
          to="/"
          title="Go to landing page"
          className="h-14 flex items-center px-4 border-b border-border hover:bg-surface transition-none"
        >
          <Terminal size={18} weight="bold" className="text-primary mr-2" />
          <div className="flex-1">
            <div className="mono text-sm font-semibold tracking-tight">
              ALPHA<span className="text-brand">SCRIBE</span>
            </div>
            <div className="label-mono !text-[9px] !tracking-[0.25em]">
              equity intel · v0.1
            </div>
          </div>
        </NavLink>

        <nav className="py-3 divider-y flex flex-col">
          <NavLink to="/app" end className={NAV_CLS} data-testid={APP.sidebarNewReport}>
            <ChartLine size={14} /> New Report
          </NavLink>
          <NavLink to="/compare" className={NAV_CLS} data-testid={APP.sidebarCompare}>
            <Scales size={14} /> Compare
          </NavLink>
          <NavLink to="/ingest" className={NAV_CLS} data-testid={APP.sidebarIngest}>
            <Upload size={14} /> Ingest Filing
          </NavLink>
        </nav>

        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Star size={14} weight="fill" className="text-warning" />
            <span className="label-mono !text-[11px]">Watchlist</span>
            <span className="mono text-[10px] text-muted-foreground ml-auto">
              {watchlist.length}
            </span>
          </div>
          {watchlist.length === 0 ? (
            <p className="mono text-[10px] text-muted-foreground leading-relaxed">
              Star a company on any report to pin it here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-52 overflow-y-auto">
              {watchlist.map((w) => (
                <li
                  key={w.ticker}
                  className="group flex items-center gap-1 border border-border hover:border-primary transition-none"
                >
                  <button
                    onClick={() =>
                      nav("/app", { state: { pickTicker: w.ticker, pickName: w.name } })
                    }
                    data-testid={`watchlist-item-${w.ticker}`}
                    title={`New report on ${w.name || w.ticker}`}
                    className="flex-1 min-w-0 text-left px-2.5 py-2 hover:bg-surface transition-none"
                  >
                    <div className="text-xs text-primary truncate">{w.name || w.ticker}</div>
                    <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {w.ticker}
                    </div>
                  </button>
                  <button
                    onClick={() => remove(w.ticker)}
                    data-testid={`watchlist-remove-${w.ticker}`}
                    title="Remove from watchlist"
                    className="p-1.5 mr-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-bearish transition-none"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border">
          <div className="px-4 pt-3 pb-2 label-mono flex items-center justify-between">
            <span>History</span>
            <span className="mono !normal-case text-muted-foreground">
              {reports.length}
            </span>
          </div>
          <ul className="divider-y">
            {reports.map((r) => {
              const name = r.company_name || companies[r.ticker] || r.ticker;
              const pct = Math.round((r.scorecard?.overall ?? 0) * 100);
              const onDelete = async (e) => {
                e.stopPropagation();
                if (!window.confirm(`Delete this report for ${name}?`)) return;
                try {
                  await deleteReport(r.id);
                  toast.success("Report deleted");
                  refresh();
                } catch {
                  toast.error("Delete failed");
                }
              };
              return (
                <li key={r.id} className="group relative">
                  <button
                    data-testid={APP.historyItem(r.id)}
                    onClick={() => nav(`/reports/${r.id}`)}
                    className="w-full text-left px-4 py-2 hover:bg-surface transition-none pr-8"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-primary truncate">{name}</span>
                      <span
                        className={`mono text-[10px] shrink-0 ${
                          r.fact_check_status ? "text-bullish" : "text-bearish"
                        }`}
                      >
                        {r.fact_check_status ? "✓" : "⚠"} {pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="mono text-[10px] text-muted-foreground">{r.ticker}</span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {r.query}
                      </span>
                    </div>
                    <div className="mono text-[10px] text-muted-foreground mt-0.5">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </button>
                  <button
                    onClick={onDelete}
                    data-testid={`history-delete-${r.id}`}
                    title="Delete report"
                    className="absolute top-2 right-2 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-bearish transition-none"
                  >
                    <Trash size={12} />
                  </button>
                </li>
              );
            })}
            {reports.length === 0 && (
              <li className="px-4 py-3 text-xs text-muted-foreground mono">
                No reports yet.
              </li>
            )}
          </ul>
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center gap-2">
          <FileText size={12} className="text-muted-foreground" />
          <span className="label-mono !text-[9px] flex-1">Retrieval</span>
          <span
            className={`mono text-[9px] tracking-widest uppercase ${
              retr.embedder === "ready" ? "text-bullish" : "text-muted-foreground"
            }`}
          >
            {retr.embedder === "ready" ? "DENSE" : "—"}
          </span>
          <span
            className={`mono text-[9px] tracking-widest uppercase ${
              retr.reranker === "ready" ? "text-bullish" : "text-muted-foreground"
            }`}
          >
            {retr.reranker === "ready" ? "RERANK" : "—"}
          </span>
        </div>
        <div className="border-t border-border">
          <LlmSettings />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 ml-64">
        <ActivityBar />
        <Outlet context={{ refresh, companies }} />
      </main>
    </div>
  );
}

// Global live-status strip: shows any in-flight analyses on every page, with
// the current pipeline stage, and links back to the report.
const NODE_LABEL = {
  pipeline: "starting", retriever: "retrieving", extractor: "extracting financials",
  tone: "analyzing tone", synthesizer: "writing brief", fact_checker: "fact-checking",
};

function ActivityBar() {
  const { jobs, cancelJob } = useJobs();
  const nav = useNavigate();
  const active = Object.values(jobs).filter((j) => j.status === "running");
  if (active.length === 0) return null;
  return (
    <div className="sticky top-0 z-20 bg-surface border-b border-primary/40">
      {active.map((j) => (
        <div key={j.id} className="w-full flex items-center gap-2 px-6 h-9 hover:bg-background/40">
          <CircleNotch size={13} className="text-brand animate-spin shrink-0" />
          <button onClick={() => nav(`/reports/${j.id}`)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <span className="mono text-[11px] text-primary">{j.ticker || "…"}</span>
            <span className="mono text-[10px] uppercase tracking-widest text-brand">
              {NODE_LABEL[j.lastNode] || "analyzing"}
            </span>
            <span className="text-[11px] text-muted-foreground truncate hidden md:inline">
              {j.query}
            </span>
          </button>
          <button
            onClick={() => cancelJob(j.id)}
            title="Stop this analysis"
            className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-bearish inline-flex items-center gap-1 shrink-0"
          >
            <XCircle size={13} /> stop
          </button>
        </div>
      ))}
    </div>
  );
}
