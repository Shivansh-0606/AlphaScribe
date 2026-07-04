import { REPORT } from "@/constants/testIds";

const NUMERIC_FIELDS = [
  ["revenue", "Revenue"],
  ["revenue_yoy", "YoY Growth"],
  ["eps", "Diluted EPS"],
  ["net_income", "Net Income"],
  ["operating_margin", "Op. Margin"],
  ["free_cash_flow", "Free Cash Flow"],
];

export default function FinancialsTable({ data }) {
  const empty =
    !data ||
    Object.values(data || {}).every((v) => v == null || v === "");
  const guidance = data?.guidance;

  return (
    <div data-testid={REPORT.financialsTable} className="cell h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="label-mono">Structured Financials</div>
        <div className="mono text-[10px] text-muted-foreground">extractor</div>
      </div>

      {empty ? (
        <div className="p-4 mono text-xs text-muted-foreground">
          No structured data extracted.
        </div>
      ) : (
        <>
          <table className="w-full mono text-xs tabular-nums">
            <tbody>
              {NUMERIC_FIELDS.map(([key, label]) => (
                <tr key={key} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-2 label-mono !text-xs !tracking-[0.15em] w-1/2">
                    {label}
                  </td>
                  <td className="px-4 py-2 text-right text-primary break-words">
                    {data?.[key] || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Guidance is often long-form text — render as full-width block below */}
          {guidance && (
            <div className="px-4 py-3 border-t border-border/60 flex-1">
              <div className="label-mono mb-2">Guidance</div>
              <p
                data-testid="financials-guidance"
                className="text-xs text-primary/90 leading-relaxed whitespace-pre-wrap break-words"
              >
                {guidance}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
