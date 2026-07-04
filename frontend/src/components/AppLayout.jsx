import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteReport, listReports, listTickers, listCompanies, health } from "@/lib/api";
import { APP } from "@/constants/testIds";
import { Terminal, FileText, Upload, ChartLine, Scales, Trash } from "@phosphor-icons/react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_CLS = ({ isActive }) =>
  `flex items-center gap-2 px-4 h-10 text-xs mono uppercase tracking-widest border-l-2 ${
    isActive
      ? "border-primary text-primary bg-surface"
      : "border-transparent text-muted-foreground hover:text-primary hover:bg-surface"
  }`;

export default function AppLayout() {
  const [reports, setReports] = useState([]);
  const [tickers, setTickers] = useState([]);
  const [companies, setCompanies] = useState({});
  const [retr, setRetr] = useState({ embedder: "not_loaded", reranker: "not_loaded" });
  const nav = useNavigate();

  const refresh = async () => {
    try {
      const [r, t, c, h] = await Promise.all([
        listReports(), listTickers(), listCompanies(), health()
      ]);
      setReports(r);
      setTickers(t);
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
        className="w-64 shrink-0 border-r border-border flex flex-col sticky top-0 h-screen"
      >
        <div className="h-14 flex items-center px-4 border-b border-border">
          <Terminal size={18} weight="bold" className="text-primary mr-2" />
          <div className="flex-1">
            <div className="mono text-sm font-semibold tracking-tight">
              ALPHA<span className="text-brand">SCRIBE</span>
            </div>
            <div className="label-mono !text-[9px] !tracking-[0.25em]">
              equity intel · v0.1
            </div>
          </div>
        </div>

        <nav className="py-3 divider-y flex flex-col">
          <NavLink to="/" end className={NAV_CLS} data-testid={APP.sidebarNewReport}>
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
          <div className="label-mono mb-2">Coverage</div>
          <div className="flex flex-wrap gap-1">
            {tickers.length === 0 ? (
              <span className="mono text-xs text-muted-foreground">— empty —</span>
            ) : (
              tickers.map((t) => (
                <span
                  key={t}
                  title={companies[t] || t}
                  className="mono text-[10px] px-1.5 py-0.5 border border-border text-primary"
                >
                  {t}
                </span>
              ))
            )}
          </div>
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
        <div className="px-4 py-2 border-t border-border flex items-center justify-between">
          <span className="label-mono !text-[9px]">Theme</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <Outlet context={{ refresh, companies }} />
      </main>
    </div>
  );
}
