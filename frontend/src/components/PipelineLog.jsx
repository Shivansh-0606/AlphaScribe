import { CheckCircle, Warning, Spinner, XCircle, ArrowClockwise, Circle } from "@phosphor-icons/react";
import { REPORT } from "@/constants/testIds";

const STATUS_ICON = {
  start: <Spinner size={14} className="animate-spin text-brand" />,
  ok: <CheckCircle size={14} weight="fill" className="text-bullish" />,
  warn: <Warning size={14} weight="fill" className="text-warning" />,
  error: <XCircle size={14} weight="fill" className="text-bearish" />,
};

const NODE_LABEL = {
  pipeline: "PIPELINE",
  retriever: "RETRIEVER",
  extractor: "EXTRACTOR",
  tone: "TONE / RISK",
  synthesizer: "SYNTHESIZER",
  fact_checker: "FACT-CHECKER",
  final: "FINAL",
};

export default function PipelineLog({ events, running }) {
  const seen = new Set();
  const uniq = events.filter((e) => {
    // Stable, content-based key so a frame replayed on reconnect (snapshot seed
    // + re-streamed SSE) dedups. Math.random() here defeated dedup for any
    // event missing a `ts`.
    const k = `${e.node}-${e.status || ""}-${e.ts || ""}-${e.message || ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <div
      data-testid={REPORT.pipelineLog}
      className="cell p-4 h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="label-mono">Agent Pipeline</div>
        <div className="mono text-[10px] text-muted-foreground">
          {running ? (
            <span className="text-brand terminal-cursor">running</span>
          ) : (
            <span>{uniq.length} events</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 mono text-xs">
        {uniq.length === 0 && (
          <div className="text-muted-foreground">
            <span className="text-primary">$</span> waiting for graph.astream...
            <span className="terminal-cursor" />
          </div>
        )}
        {uniq.map((e, i) => (
          <div key={i} className="flex items-start gap-2 animate-ticker-in">
            <div className="mt-0.5 shrink-0">
              {STATUS_ICON[e.status] || <Circle size={10} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-primary uppercase tracking-widest text-[10px]">
                  {NODE_LABEL[e.node] || e.node}
                </span>
                {e.ts && (
                  <span className="text-muted-foreground text-[10px]">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="text-muted-foreground break-words">
                {e.message}
                {typeof e.flagged === "number" && (
                  <span className="ml-2 text-warning">
                    [flagged: {e.flagged}/{e.total}]
                  </span>
                )}
              </div>
            </div>
            {e.node === "synthesizer" && e.message?.includes("retry") && (
              <ArrowClockwise size={12} className="text-warning shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
