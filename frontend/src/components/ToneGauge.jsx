import { REPORT } from "@/constants/testIds";

export default function ToneGauge({ tone }) {
  const sentiment = tone?.sentiment || "Neutral";
  const conf = Math.max(0, Math.min(1, tone?.confidence ?? 0));
  const bullish = sentiment === "Bullish";
  const bearish = sentiment === "Bearish";
  const color = bullish ? "#059669" : bearish ? "#DC2626" : "#5C6774";
  const pct = Math.round(conf * 100);
  // Bar direction: bullish grows right, bearish grows left, neutral centered
  let leftPct = 50;
  let width = 4;
  if (bullish) {
    leftPct = 50;
    width = (pct / 2);
  } else if (bearish) {
    width = (pct / 2);
    leftPct = 50 - width;
  } else {
    leftPct = 48;
    width = 4;
  }

  return (
    <div data-testid={REPORT.toneGauge} className="cell p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="label-mono">Management Tone</div>
        <span
          className="mono text-xs uppercase px-1.5 py-0.5 border"
          style={{ color, borderColor: color }}
        >
          {sentiment}
        </span>
      </div>

      <div className="relative h-3 input-bg border border-border">
        {/* center marker */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
        <div
          className="absolute top-0 bottom-0 transition-none"
          style={{
            left: `${leftPct}%`,
            width: `${width}%`,
            background: color,
          }}
        />
        {/* labels */}
      </div>
      <div className="flex justify-between mono text-[10px] text-muted-foreground mt-1">
        <span>BEAR</span>
        <span>NEUTRAL</span>
        <span>BULL</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="label-mono mb-1">Confidence</div>
          <div className="mono text-lg tabular-nums text-primary">{pct}%</div>
        </div>
        <div>
          <div className="label-mono mb-1">Signal</div>
          <div className="mono text-sm" style={{ color }}>
            {bullish ? "▲ POSITIVE" : bearish ? "▼ NEGATIVE" : "◆ NEUTRAL"}
          </div>
        </div>
      </div>

      {tone?.summary && (
        <div className="mt-3 pt-3 border-t border-border text-xs leading-relaxed text-primary/90">
          {tone.summary}
        </div>
      )}
    </div>
  );
}
