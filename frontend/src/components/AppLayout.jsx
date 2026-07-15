import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { deleteReport, listReports, listCompanies } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { useWatchlist } from "@/lib/watchlist";
import { useAuth } from "@/lib/auth";
import AmbientBackground from "@/components/AmbientBackground";
import { APP, AUTH } from "@/constants/testIds";
import { Terminal, Upload, ChartLine, Scales, Trash, CircleNotch, XCircle, Star, X, SignIn, SquaresFour, Gear } from "@phosphor-icons/react";
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
  const { watchlist, remove } = useWatchlist();
  const { user } = useAuth();
  const nav = useNavigate();

  const refresh = async () => {
    try {
      const [r, c] = await Promise.all([listReports(), listCompanies()]);
      setReports(r);
      setCompanies(c || {});
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
    <div data-testid={APP.root} className="min-h-screen flex">
      <AmbientBackground />
      {/* Sidebar */}
      <aside
        data-testid={APP.sidebar}
        className="w-64 shrink-0 border-r border-border flex flex-col fixed top-0 left-0 h-screen z-30 bg-surface/65 backdrop-blur-xl"
      >
        <NavLink
          to="/dashboard"
          title="Go to dashboard"
          className="h-14 flex items-center px-4 border-b border-border hover:bg-surface"
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
          <NavLink to="/dashboard" className={NAV_CLS} data-testid={APP.sidebarDashboard}>
            <SquaresFour size={14} /> Dashboard
          </NavLink>
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
              <AnimatePresence initial={false}>
                {watchlist.map((w, i) => (
                  <motion.li
                    key={w.ticker}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: i * 0.03 } }}
                    exit={{ opacity: 0, x: 8 }}
                    className="group flex items-center gap-1 border border-border hover:border-primary"
                  >
                    <button
                      onClick={() =>
                        nav("/app", { state: { pickTicker: w.ticker, pickName: w.name } })
                      }
                      data-testid={`watchlist-item-${w.ticker}`}
                      title={`New report on ${w.name || w.ticker}`}
                      className="flex-1 min-w-0 text-left px-2.5 py-2 hover:bg-surface"
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
                      className="p-1.5 mr-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-bearish"
                    >
                      <X size={12} />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
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
            <AnimatePresence initial={false}>
              {reports.map((r, i) => {
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
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.02 } }}
                    exit={{ opacity: 0, y: 6 }}
                    className="group relative"
                  >
                    <button
                      data-testid={APP.historyItem(r.id)}
                      onClick={() => nav(`/reports/${r.id}`)}
                      className="w-full text-left px-4 py-2 hover:bg-surface pr-8"
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
                      className="absolute top-2 right-2 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-bearish"
                    >
                      <Trash size={12} />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
            {reports.length === 0 && (
              <li className="px-4 py-3 text-xs text-muted-foreground mono">
                No reports yet.
              </li>
            )}
          </ul>
        </div>

        {/* Settings replaces the old email + LLM-key + retrieval rows: the
            sidebar is navigation, and everything account-shaped lives on
            /settings. LlmSettings is mounted here for its modal only. */}
        <div className="border-t border-border">
          {user ? (
            <NavLink to="/settings" className={NAV_CLS} data-testid={APP.sidebarSettings}>
              <Gear size={14} /> Settings
            </NavLink>
          ) : (
            <button
              onClick={() => nav("/login")}
              data-testid={AUTH.sidebarLogin}
              className="w-full flex items-center gap-2 px-4 h-10 mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-surface"
            >
              <SignIn size={12} /> Sign in
            </button>
          )}
        </div>
        <LlmSettings />
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 ml-64 relative z-10">
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
