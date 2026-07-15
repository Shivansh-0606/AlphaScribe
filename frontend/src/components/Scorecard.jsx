import { REPORT } from "@/constants/testIds";

const BAR = ({ label, value, testId }) => {
  const pct = Math.round((value ?? 0) * 100);
  const color = pct >= 80 ? "#059669" : pct >= 60 ? "#D97706" : "#DC2626";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="label-mono">{label}</span>
        <span
          data-testid={testId}
          className="mono text-xs tabular-nums text-primary"
          style={{ color }}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 input-bg border border-border relative">
        <div
          className="absolute top-0 bottom-0 left-0 transition-none"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

export default function Scorecard({ scorecard }) {
  if (!scorecard) return null;
  const overallPct = Math.round((scorecard.overall ?? 0) * 100);

  return (
    <div data-testid={REPORT.scorecard} className="cell p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="label-mono">Quality Scorecard</div>
        <span className="mono text-lg tabular-nums text-primary">{overallPct}%</span>
      </div>
      <div className="space-y-3">
        <BAR
          label="Faithfulness"
          value={scorecard.faithfulness}
          testId="score-faithfulness"
        />
        <BAR
          label="Context Precision"
          value={scorecard.context_precision}
          testId="score-context-precision"
        />
        <BAR
          label="Answer Relevance"
          value={scorecard.answer_relevance}
          testId="score-answer-relevance"
        />
      </div>
      <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3 mono text-[11px]">
        <div>
          <div className="label-mono">Claims verified</div>
          <div className="text-primary tabular-nums">
            {scorecard.n_supported}/{scorecard.n_claims}
          </div>
        </div>
        <div>
          <div className="label-mono">Sources cited</div>
          <div className="text-primary tabular-nums">
            {scorecard.cited_sources?.length ?? 0}
          </div>
        </div>
      </div>
    </div>
  );
}
