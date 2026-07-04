import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { REPORT } from "@/constants/testIds";
import { FileText, CheckCircle, Warning } from "@phosphor-icons/react";

export default function ResearchBrief({ report }) {
  const [tab, setTab] = useState("brief");
  const factOk = report?.fact_check_status;
  const claims = report?.verified_claims || [];
  const errors = report?.validation_errors || [];
  const sources = report?.source_documents || [];

  return (
    <div className="cell">
      <div className="border-b border-border flex items-center justify-between">
        <div className="flex">
          {[
            ["brief", "Research Brief"],
            ["claims", `Claims (${claims.length})`],
            ["sources", `Sources (${sources.length})`],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              data-testid={`tab-${id}`}
              className={`h-10 px-4 mono text-[11px] uppercase tracking-widest border-b-2 ${
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="px-4">
          <span
            data-testid={REPORT.factCheckBadge}
            className={`mono text-[10px] uppercase px-2 py-1 border inline-flex items-center gap-1 ${
              factOk ? "border-bullish text-bullish" : "border-bearish text-bearish"
            }`}
          >
            {factOk ? <CheckCircle size={12} /> : <Warning size={12} />}
            {factOk ? "Fact-Check Passed" : "Claims Flagged"}
            {report?.retry_count > 0 && (
              <span className="text-muted-foreground ml-1">· {report.retry_count} retry</span>
            )}
          </span>
        </div>
      </div>

      {tab === "brief" && (
        <div
          data-testid={REPORT.markdown}
          className="p-6 prose dark:prose-invert max-w-none prose-headings:font-sans prose-headings:tracking-tight prose-p:text-sm prose-p:leading-relaxed prose-p:text-primary/90 prose-strong:text-primary prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:text-brand prose-li:text-sm"
        >
          {report?.draft_report ? (
            <ReactMarkdown>{report.draft_report}</ReactMarkdown>
          ) : (
            <div className="mono text-xs text-muted-foreground">No draft generated.</div>
          )}
          {errors?.length > 0 && (
            <div className="mt-6 p-4 border border-bearish/60 bg-bearish/5">
              <div className="label-mono !text-bearish mb-2">Unresolved Fact-Check Issues</div>
              <ul className="mono text-xs space-y-1">
                {errors.map((e, i) => (
                  <li key={i} className="text-bearish/90">- {e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "claims" && (
        <div data-testid={REPORT.claimsPanel} className="divide-y divide-border">
          {claims.length === 0 && (
            <div className="p-6 mono text-xs text-muted-foreground">
              No numeric claims were verified for this report.
            </div>
          )}
          {claims.map((c, i) => (
            <div
              key={i}
              data-testid={REPORT.claimRow(i)}
              className="p-4 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4"
            >
              <div className="shrink-0">
                <span
                  className={`mono text-[10px] uppercase px-1.5 py-0.5 border ${
                    c.supported
                      ? "border-bullish text-bullish"
                      : "border-bearish text-bearish"
                  }`}
                >
                  {c.supported ? "✓ Verified" : "⚠ Flagged"}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-sm text-primary mb-1">{c.claim}</div>
                {c.evidence && (
                  <div className="mono text-xs text-muted-foreground border-l-2 border-border pl-3">
                    “{c.evidence}”
                  </div>
                )}
                {!c.supported && c.reason && (
                  <div className="mono text-xs text-bearish/90 mt-1">— {c.reason}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "sources" && (
        <div data-testid={REPORT.sourcesPanel} className="divide-y divide-border">
          {sources.length === 0 && (
            <div className="p-6 mono text-xs text-muted-foreground">No sources.</div>
          )}
          {sources.map((s, i) => (
            <div key={i} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText size={12} className="text-muted-foreground" />
                  <span className="mono text-xs text-primary">
                    [{i + 1}] {s.source}
                  </span>
                  <span className="label-mono !text-[9px]">chunk {s.chunk_idx}</span>
                </div>
                <span className="mono text-[10px] text-muted-foreground">
                  score {Number(s.score || 0).toFixed(2)}
                </span>
              </div>
              <div className="mono text-xs text-primary/80 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto border border-border/60 p-3 input-bg">
                {s.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
