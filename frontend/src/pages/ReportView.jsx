import { useEffect, useState } from "react";
import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { generateReport, ensureCompany } from "@/lib/api";
import { useJobs } from "@/lib/jobs";
import { useLlm } from "@/lib/llmSettings";
import { WatchlistStar } from "@/lib/watchlist";
import PipelineLog from "@/components/PipelineLog";
import ToneGauge from "@/components/ToneGauge";
import FinancialsTable from "@/components/FinancialsTable";
import ResearchBrief from "@/components/ResearchBrief";
import Scorecard from "@/components/Scorecard";
import { REPORT } from "@/constants/testIds";
import { CaretRight, DownloadSimple, LinkSimple, PaperPlaneRight, ArrowUUpLeft, DotsSixVertical, ArrowClockwise, XCircle, FilePdf } from "@phosphor-icons/react";

export default function ReportView() {
  const { id } = useParams();
  const { jobs, ensureJob, startJob, cancelJob } = useJobs();
  const { payload: llmPayload } = useLlm();

  // The SSE stream lives in the global JobsProvider, so leaving this page does
  // NOT cancel the analysis — it keeps running and shows in the status bar.
  useEffect(() => {
    ensureJob(id);
  }, [id, ensureJob]);

  const job = jobs[id] || {};
  const events = job.events || [];
  const report = job.report || null;
  const running = job.status === "running" || (!job.status && !report);

  const ticker = report?.ticker || events.find((e) => e.node === "pipeline")?.message?.match(/for (\w+)/)?.[1] || "—";
  const query = report?.query || "";
  const { companies = {}, refresh } = useOutletContext() || {};
  const companyName = report?.company_name || companies[ticker];
  const nav = useNavigate();
  const [followup, setFollowup] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshFilings = async () => {
    if (!ticker || ticker === "—") return;
    if (!window.confirm(`Fetch the latest SEC filing for ${companyName || ticker}? This will add a new document to the corpus.`))
      return;
    setRefreshing(true);
    try {
      const r = await ensureCompany(ticker, true);
      if (r.action === "ingested_from_edgar") {
        toast.success(
          `Latest filing (${r.filing_date || "unknown date"}) added — ${r.num_chunks} new chunks. Run a fresh analysis to use it.`,
        );
      } else if (r.action === "ingested_from_bse") {
        toast.success(
          `${r.source} added — ${r.num_chunks} new chunks. Run a fresh analysis to use it.`,
        );
      } else {
        toast.success("Already up to date");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      toast.error(String(msg).slice(0, 300));
    } finally {
      setRefreshing(false);
    }
  };

  const downloadMd = () => {
    if (!report) return;
    const scorecard = report.scorecard || {};
    const header =
      `# ${companyName || ticker} — ${query}\n\n` +
      `_Ticker: ${ticker}  ·  Generated: ${new Date(
        report.created_at || Date.now(),
      ).toISOString()}  ·  ` +
      `Overall quality: ${Math.round((scorecard.overall || 0) * 100)}%  ·  ` +
      `Fact-check: ${report.fact_check_status ? "PASSED" : "FLAGGED"}_\n\n---\n\n`;
    const body = report.draft_report || "";
    const sources = (report.source_documents || [])
      .map(
        (s, i) =>
          `**[${i + 1}] ${s.source}** — chunk ${s.chunk_idx} (score ${(s.score || 0).toFixed(
            2,
          )})`,
      )
      .join("\n");
    const md = `${header}${body}\n\n---\n\n## Sources\n\n${sources}\n`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticker}_${(query || "brief").slice(0, 40).replace(/[^A-Za-z0-9]+/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  const downloadPdf = () => {
    if (!report) return;
    // Build a clean, standalone HTML doc and print it to PDF via the browser —
    // no extra deps, preserves the full brief + sources faithfully.
    const sc = report.scorecard || {};
    const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const briefHtml = esc(report.draft_report || "")
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.*)$/gm, "<li>$1</li>")
      .replace(/\n{2,}/g, "</p><p>");
    const sources = (report.source_documents || [])
      .map((s, i) => `<li>[${i + 1}] ${esc(s.source)} — chunk ${s.chunk_idx}</li>`).join("");
    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup blocked — allow popups to export PDF"); return; }
    win.document.write(`<!doctype html><html><head><title>${esc(companyName || ticker)} — AlphaScribe</title>
      <style>
        body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
        h1{font-size:22px;border-bottom:2px solid #111;padding-bottom:6px} h2{font-size:16px;margin-top:22px}
        h3{font-size:14px} .meta{font-family:monospace;font-size:11px;color:#555;margin:8px 0 20px}
        .badge{display:inline-block;padding:2px 8px;border:1px solid #111;font-family:monospace;font-size:10px}
        ul{padding-left:18px} li{margin:3px 0} hr{border:none;border-top:1px solid #ccc;margin:24px 0}
        @media print{body{margin:0}}
      </style></head><body>
      <h1>${esc(companyName || ticker)} <span style="font-size:13px;color:#666">(${esc(ticker)})</span></h1>
      <div class="meta">Query: ${esc(query)}<br/>Generated: ${new Date(report.created_at || Date.now()).toLocaleString()}
       &nbsp;·&nbsp; Quality: ${Math.round((sc.overall || 0) * 100)}%
       &nbsp;·&nbsp; <span class="badge">${report.fact_check_status ? "FACT-CHECK PASSED" : "FLAGGED"}</span></div>
      <p>${briefHtml}</p>
      <hr/><h2>Sources</h2><ul>${sources}</ul>
      <p class="meta">Generated by AlphaScribe — fact-checked equity research.</p>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const rerun = async () => {
    if (!ticker || ticker === "—") return;
    if (!window.confirm(`Run a fresh analysis for ${companyName || ticker}? (bypasses cache, uses LLM quota)`)) return;
    try {
      const { job_id } = await generateReport({
        ticker, query: query || "Summarize the latest quarter and management outlook.",
        no_cache: true, ...llmPayload(),
      });
      startJob(job_id, { ticker, query });
      refresh?.();
      nav(`/reports/${job_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    }
  };

  const runFollowup = async (e) => {
    e?.preventDefault?.();
    if (!followup.trim() || !ticker) return;
    setDispatching(true);
    try {
      const { job_id } = await generateReport({
        ticker,
        query: followup.trim(),
        context_report_id: id,
        ...llmPayload(),
      });
      startJob(job_id, { ticker, query: followup.trim() });
      toast.success(`Follow-up dispatched for ${companyName || ticker}`);
      setFollowup("");
      refresh?.();
      nav(`/reports/${job_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div data-testid={REPORT.root} className="min-h-screen">
      {/* Command bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="h-14 px-6 flex items-center gap-3">
          <button
            onClick={() => nav("/app")}
            data-testid="back-to-home"
            className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            <ArrowUUpLeft size={12} /> home
          </button>
          <CaretRight size={12} className="text-muted-foreground" />
          {companyName ? (
            <>
              <span className="text-sm text-primary truncate max-w-[280px]">{companyName}</span>
              <span className="mono text-[10px] px-1.5 py-0.5 border border-border text-muted-foreground">
                {ticker}
              </span>
              <WatchlistStar row={{ ticker, name: companyName }} />
            </>
          ) : (
            <span className="mono text-sm text-primary">{ticker}</span>
          )}
          {query && (
            <>
              <CaretRight size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate max-w-2xl">{query}</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            {report && (
              <>
                <button
                  onClick={refreshFilings}
                  disabled={refreshing}
                  data-testid="report-refresh-filings"
                  title="Fetch the latest SEC filing (US companies only)"
                  className="mono text-[11px] uppercase tracking-widest h-8 px-3 border border-border text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ArrowClockwise
                    size={12}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  {refreshing ? "Fetching…" : "Refresh"}
                </button>
                <button
                  onClick={copyLink}
                  data-testid="report-copy-link"
                  className="mono text-[11px] uppercase tracking-widest h-8 px-3 border border-border text-muted-foreground hover:text-primary hover:border-primary inline-flex items-center gap-1"
                >
                  <LinkSimple size={12} /> Share
                </button>
                <button
                  onClick={downloadMd}
                  data-testid="report-download-md"
                  className="mono text-[11px] uppercase tracking-widest h-8 px-3 border border-border text-muted-foreground hover:text-primary hover:border-primary inline-flex items-center gap-1"
                >
                  <DownloadSimple size={12} /> MD
                </button>
                <button
                  onClick={downloadPdf}
                  data-testid="report-download-pdf"
                  className="mono text-[11px] uppercase tracking-widest h-8 px-3 border border-primary text-primary hover:bg-primary hover:text-primary-foreground inline-flex items-center gap-1"
                >
                  <FilePdf size={12} /> PDF
                </button>
                <button
                  onClick={rerun}
                  data-testid="report-rerun"
                  title="Run a fresh analysis (bypass cache)"
                  className="mono text-[11px] uppercase tracking-widest h-8 px-3 border border-border text-muted-foreground hover:text-brand hover:border-brand inline-flex items-center gap-1"
                >
                  <ArrowClockwise size={12} /> Re-run
                </button>
              </>
            )}
            {running && (
              <button
                onClick={() => cancelJob(id)}
                data-testid="report-cancel"
                className="mono text-[11px] uppercase tracking-widest h-8 px-3 border border-bearish text-bearish hover:bg-bearish hover:text-background inline-flex items-center gap-1"
              >
                <XCircle size={12} /> Stop
              </button>
            )}
            <span className="mono text-[10px] uppercase tracking-widest ml-2">
              {running ? (
                <span className="text-brand terminal-cursor">executing</span>
              ) : job.status === "cancelled" ? (
                <span className="text-bearish">cancelled</span>
              ) : report?.fact_check_status ? (
                <span className="text-bullish">complete · verified</span>
              ) : (
                <span className="text-bearish">complete · flagged</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Top row: Pipeline + Tone + Financials + Scorecard — resizable */}
      <div className="hidden lg:block border-b border-border">
        <PanelGroup
          direction="horizontal"
          autoSaveId="alphascribe:report-top"
          className="min-h-[380px]"
        >
          <Panel defaultSize={40} minSize={20}>
            <PipelineLog events={events} running={running} />
          </Panel>
          <PanelResizeHandle className="w-px bg-border data-[resize-handle-state=drag]:bg-primary data-[resize-handle-state=hover]:bg-primary/60 relative">
            <DotsSixVertical size={12} className="text-muted-foreground absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2" />
          </PanelResizeHandle>
          <Panel defaultSize={22} minSize={16}>
            <ToneGauge tone={report?.sentiment_analysis} />
          </Panel>
          <PanelResizeHandle className="w-px bg-border data-[resize-handle-state=drag]:bg-primary data-[resize-handle-state=hover]:bg-primary/60 relative">
            <DotsSixVertical size={12} className="text-muted-foreground absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2" />
          </PanelResizeHandle>
          <Panel defaultSize={22} minSize={16}>
            <FinancialsTable data={report?.extracted_data} />
          </Panel>
          <PanelResizeHandle className="w-px bg-border data-[resize-handle-state=drag]:bg-primary data-[resize-handle-state=hover]:bg-primary/60 relative">
            <DotsSixVertical size={12} className="text-muted-foreground absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2" />
          </PanelResizeHandle>
          <Panel defaultSize={16} minSize={14}>
            <Scorecard scorecard={report?.scorecard} />
          </Panel>
        </PanelGroup>
      </div>
      {/* Mobile stacked fallback */}
      <div className="lg:hidden grid grid-cols-1 gap-px bg-border">
        <div className="bg-background"><PipelineLog events={events} running={running} /></div>
        <div className="bg-background"><ToneGauge tone={report?.sentiment_analysis} /></div>
        <div className="bg-background"><FinancialsTable data={report?.extracted_data} /></div>
        <div className="bg-background"><Scorecard scorecard={report?.scorecard} /></div>
      </div>

      {/* Brief / claims / sources */}
      <div className="p-px bg-border">
        <div className="bg-background">
          <ResearchBrief report={report} />
        </div>
      </div>

      {/* Follow-up */}
      {report && !running && (
        <div className="border-t border-border px-6 md:px-10 py-6">
          <div className="max-w-3xl">
            <div className="label-mono mb-2">Ask a follow-up on {companyName || ticker}</div>
            <form onSubmit={runFollowup} className="flex gap-2">
              <input
                data-testid="followup-input"
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
                placeholder="e.g. What did they say about AI spending?"
                className="flex-1 input-bg border border-border text-primary text-sm px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={dispatching || !followup.trim()}
                data-testid="followup-submit"
                className="mono text-[11px] uppercase tracking-widest h-11 px-5 bg-primary text-primary-foreground disabled:opacity-40 inline-flex items-center gap-2"
              >
                <PaperPlaneRight size={12} weight="fill" />
                {dispatching ? "Dispatching…" : "Ask"}
              </button>
            </form>
            <div className="mono text-[10px] text-muted-foreground mt-2">
              Context-aware — the previous brief is passed to the synthesizer.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
