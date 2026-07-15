import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText, Star, CheckCircle, WarningCircle, ChartLine, Scales, Upload,
  X, Lightning, Buildings, ArrowRight, Clock, Key,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth";
import { useLlm } from "@/lib/llmSettings";
import { useWatchlist } from "@/lib/watchlist";
import { listReports, listCompanies } from "@/lib/api";
import { DASHBOARD } from "@/constants/testIds";

// Shown once per browser (mirrors the LLM key's own localStorage-only,
// per-browser scope — no server-side flag). Lives here because /dashboard is
// now the post-login landing page; the key remains the original one so anyone
// who already dismissed it on /app is not nagged again.
const ONBOARDING_SEEN_KEY = "alphascribe:seen_onboarding";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay } },
});

/**
 * The signed-in home. Module set follows what equity-research tools converge on
 * (Koyfin / AlphaSense / Simply Wall St): a snapshot strip, the user's own work
 * (reports), what they're tracking (watchlist), coverage, and quick actions.
 * Deliberately NOT a widget/customisation system — nothing here is speculative.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const { cfg: llmCfg, openSettings } = useLlm();
  const { watchlist, remove } = useWatchlist();
  const nav = useNavigate();
  const [reports, setReports] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !llmCfg.api_key && localStorage.getItem(ONBOARDING_SEEN_KEY) !== "1",
  );

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    setShowOnboarding(false);
  };

  useEffect(() => {
    Promise.all([listReports(), listCompanies()])
      .then(([r, c]) => {
        setReports(r.filter((x) => !x.is_sample));
        setCompanies(c || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const verified = reports.filter((r) => r.fact_check_status).length;
  const avgQuality = reports.length
    ? Math.round(
        (reports.reduce((s, r) => s + (r.scorecard?.overall ?? 0), 0) / reports.length) * 100,
      )
    : 0;
  const covered = Object.keys(companies).length;

  return (
    <div data-testid={DASHBOARD.root} className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="h-14 px-6 flex items-center gap-3">
          <span className="mono text-[10px] text-muted-foreground uppercase tracking-widest">
            /dashboard
          </span>
          <span className="mono text-xs text-brand">your research at a glance</span>
          <span className="mono text-[11px] text-muted-foreground ml-auto truncate">
            {user?.email}
          </span>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-px bg-border">
        {/* First-run nudge to set a BYO LLM key. Non-blocking: the dashboard is
            fully usable whether it is actioned, skipped, or ignored. */}
        {showOnboarding && !llmCfg.api_key && (
          <div
            data-testid={DASHBOARD.onboardingBanner}
            className="border border-primary/40 bg-surface px-4 py-3 flex items-center gap-3"
          >
            <Key size={16} className="text-primary shrink-0" />
            <div className="flex-1 text-xs text-muted-foreground leading-relaxed">
              <span className="text-primary">Step 1:</span> add your own LLM API
              key so reports run on your quota, not the shared one.{" "}
              <span className="text-primary">Step 2:</span> start a new report.
            </div>
            <button
              onClick={() => { openSettings(); dismissOnboarding(); }}
              data-testid={DASHBOARD.onboardingSetKey}
              className="mono text-[11px] uppercase tracking-widest h-8 px-3 bg-primary text-primary-foreground shrink-0"
            >
              Set my key
            </button>
            <button
              onClick={dismissOnboarding}
              data-testid={DASHBOARD.onboardingSkip}
              className="mono text-[11px] uppercase tracking-widest h-8 px-3 text-muted-foreground hover:text-primary shrink-0"
            >
              Skip
            </button>
          </div>
        )}

        {/* Snapshot strip */}
        <motion.div {...fadeUp(0)} className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          <Stat id="reports" icon={FileText} label="Reports" value={reports.length} />
          <Stat id="verified" icon={CheckCircle} label="Fact-checked" value={verified} tone="text-bullish" />
          <Stat
            id="quality" icon={Lightning} label="Avg quality"
            value={reports.length ? `${avgQuality}%` : "—"}
            tone={avgQuality >= 70 ? "text-bullish" : avgQuality > 0 ? "text-warning" : "text-muted-foreground"}
          />
          <Stat id="watchlist" icon={Star} label="Watchlist" value={watchlist.length} tone="text-warning" />
        </motion.div>

        <motion.div {...fadeUp(0.08)} className="grid grid-cols-1 xl:grid-cols-3 gap-px bg-border">
          {/* My Reports — the densest data gets the most room */}
          <section className="cell xl:col-span-2 p-0 flex flex-col">
            <Head icon={FileText} title="My Reports" count={reports.length}>
              <button
                onClick={() => nav("/app")}
                className="mono text-[10px] uppercase tracking-widest text-brand hover:text-primary inline-flex items-center gap-1"
              >
                New <ArrowRight size={11} />
              </button>
            </Head>

            {loading ? (
              <Muted>Loading…</Muted>
            ) : reports.length === 0 ? (
              <Muted>
                No reports yet —{" "}
                <button
                  onClick={() => nav("/app")}
                  className="text-brand hover:text-primary underline underline-offset-2"
                >
                  generate your first analysis
                </button>
                .
              </Muted>
            ) : (
              <>
                <div className="grid grid-cols-[80px_1fr_100px_60px_100px] items-center gap-3 px-5 py-2 label-mono !text-[10px] border-t border-border/50">
                  <span>Ticker</span>
                  <span>Question</span>
                  <span>Date</span>
                  <span className="text-right">Quality</span>
                  <span className="text-right">Status</span>
                </div>
                <ul className="divider-y">
                  {reports.map((r) => {
                    const pct = Math.round((r.scorecard?.overall ?? 0) * 100);
                    const ok = !!r.fact_check_status;
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => nav(`/reports/${r.id}`)}
                          data-testid={DASHBOARD.reportRow(r.id)}
                          className="w-full grid grid-cols-[80px_1fr_100px_60px_100px] items-center gap-3 px-5 py-2.5 text-left hover:bg-surface-hover"
                        >
                          <span className="mono text-xs text-primary">{r.ticker}</span>
                          <span className="text-xs text-muted-foreground truncate">{r.query}</span>
                          <span className="mono text-[11px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                          <span className={`mono text-xs text-right tabular-nums ${ok ? "text-bullish" : "text-bearish"}`}>
                            {pct}%
                          </span>
                          <span className="text-right">
                            <span
                              className={`label-mono !text-[9px] inline-flex items-center gap-1 px-1.5 py-0.5 border ${
                                ok ? "border-bullish text-bullish" : "border-bearish text-bearish"
                              }`}
                            >
                              {ok ? <CheckCircle size={10} weight="fill" /> : <WarningCircle size={10} weight="fill" />}
                              {ok ? "Verified" : "Unverified"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          {/* Right rail */}
          <div className="flex flex-col gap-px bg-border">
            <section className="cell p-0">
              <Head icon={Star} title="Watchlist" count={watchlist.length} tone="text-warning" />
              {watchlist.length === 0 ? (
                <Muted>Star a company on any report to pin it here.</Muted>
              ) : (
                <ul className="divider-y">
                  {watchlist.map((w) => (
                    <li key={w.ticker} className="group flex items-center">
                      <button
                        onClick={() =>
                          nav("/app", { state: { pickTicker: w.ticker, pickName: w.name } })
                        }
                        data-testid={DASHBOARD.watchlistItem(w.ticker)}
                        title={`New report on ${w.name || w.ticker}`}
                        className="flex-1 min-w-0 text-left px-5 py-2.5 hover:bg-surface-hover"
                      >
                        <div className="text-xs text-primary truncate">{w.name || w.ticker}</div>
                        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {w.ticker}
                        </div>
                      </button>
                      <button
                        onClick={() => remove(w.ticker)}
                        title="Remove from watchlist"
                        className="px-4 self-stretch text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-bearish"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="cell p-0">
              <Head icon={Lightning} title="Quick Actions" />
              <div className="divider-y">
                <Quick id="new-report" icon={ChartLine} label="New Report" hint="Ask a company a question" onClick={() => nav("/app")} />
                <Quick id="compare" icon={Scales} label="Compare" hint="Put reports side by side" onClick={() => nav("/compare")} />
                <Quick id="ingest" icon={Upload} label="Ingest Filing" hint="Add a filing or transcript" onClick={() => nav("/ingest")} />
              </div>
            </section>

            <section className="cell p-0 flex-1">
              <Head icon={Buildings} title="Coverage" count={covered} />
              {covered === 0 ? (
                <Muted>No companies ingested yet.</Muted>
              ) : (
                <div className="px-5 pb-5 pt-1 flex flex-wrap gap-1">
                  {Object.entries(companies).slice(0, 24).map(([ticker, name]) => (
                    <button
                      key={ticker}
                      onClick={() => nav("/app", { state: { pickTicker: ticker, pickName: name } })}
                      title={name}
                      className="mono text-[10px] px-2 py-1 border border-border text-muted-foreground hover:text-primary hover:border-primary"
                    >
                      {ticker}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </motion.div>

        {/* Recent activity — the last few briefs, newest first */}
        {reports.length > 0 && (
          <motion.section {...fadeUp(0.16)} className="cell p-0">
            <Head icon={Clock} title="Recent Activity" />
            <ul className="divider-y">
              {reports.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => nav(`/reports/${r.id}`)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-surface-hover"
                  >
                    <span className={`shrink-0 ${r.fact_check_status ? "text-bullish" : "text-bearish"}`}>
                      {r.fact_check_status ? <CheckCircle size={13} weight="fill" /> : <WarningCircle size={13} weight="fill" />}
                    </span>
                    <span className="mono text-xs text-primary shrink-0">{r.ticker}</span>
                    <span className="text-xs text-muted-foreground truncate flex-1">{r.query}</span>
                    <span className="mono text-[10px] text-muted-foreground shrink-0">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}
      </div>
    </div>
  );
}

function Stat({ id, icon: Icon, label, value, tone = "text-primary" }) {
  return (
    <div data-testid={DASHBOARD.stat(id)} className="cell p-4 flex items-center gap-3">
      <Icon size={16} className={tone} />
      <div className="min-w-0">
        <div className={`mono text-lg tabular-nums leading-none ${tone}`}>{value}</div>
        <div className="label-mono mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function Head({ icon: Icon, title, count, tone = "text-muted-foreground", children }) {
  return (
    <div className="p-5 pb-3.5 flex items-center justify-between gap-2">
      <div className="label-mono flex items-center gap-1.5">
        <Icon size={13} className={tone} /> {title}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {count !== undefined && (
          <span className="mono text-[11px] text-muted-foreground tabular-nums">{count}</span>
        )}
      </div>
    </div>
  );
}

function Quick({ id, icon: Icon, label, hint, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={DASHBOARD.quickAction(id)}
      className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-surface-hover"
    >
      <Icon size={14} className="text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-primary">{label}</div>
        <div className="mono text-[10px] text-muted-foreground truncate">{hint}</div>
      </div>
    </button>
  );
}

function Muted({ children }) {
  return (
    <p className="mono text-[11px] text-muted-foreground px-5 pb-5 pt-1 leading-relaxed">
      {children}
    </p>
  );
}
