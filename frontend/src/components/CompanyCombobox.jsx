import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, X, CircleNotch, CheckCircle, Warning } from "@phosphor-icons/react";
import { searchCompanies } from "@/lib/api";

/**
 * CompanyCombobox
 *
 * Search-as-you-type over the full SEC company universe. Reports back the
 * selected `{ticker, name, has_filings}` via onSelect.
 */
export default function CompanyCombobox({
  value,          // { ticker, name, has_filings } | null
  onSelect,
  onClear,
  autoFocus = false,
  testId = "company-search",
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // debounced search
  useEffect(() => {
    if (!q || q === (value?.name || value?.ticker)) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { results: r } = await searchCompanies(q, 8);
        setResults(r || []);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(debounceRef.current);
  }, [q, value]);

  // click outside to close
  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const display = useMemo(() => {
    if (value?.name) return value.name;
    return q;
  }, [q, value]);

  const pick = (row) => {
    onSelect?.(row);
    setQ("");
    setOpen(false);
  };

  const clear = () => {
    setQ("");
    setResults([]);
    onClear?.();
    inputRef.current?.focus();
  };

  const onKey = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-center input-bg border ${
          open ? "border-primary" : "border-border"
        } focus-within:border-primary transition-none`}
      >
        <MagnifyingGlass size={16} className="text-muted-foreground ml-3 shrink-0" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          data-testid={testId}
          value={value ? display : q}
          onChange={(e) => {
            if (value) onClear?.();
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search a company — e.g. Apple, Microsoft, Tesla…"
          className="flex-1 bg-transparent text-primary text-base px-3 py-3 focus:outline-none placeholder:text-muted-foreground"
        />
        {value && (
          <span
            className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 border mr-2 ${
              value.has_filings === false
                ? "border-warning text-warning"
                : "border-bullish text-bullish"
            }`}
            title={
              value.has_filings === false
                ? "No filings yet — you'll be prompted to fetch"
                : "Filings ready"
            }
          >
            {value.ticker}
          </span>
        )}
        {(value || q) && (
          <button
            type="button"
            onClick={clear}
            data-testid={`${testId}-clear`}
            className="text-muted-foreground hover:text-primary mr-2 p-1"
          >
            <X size={14} />
          </button>
        )}
        {loading && (
          <CircleNotch size={14} className="animate-spin text-muted-foreground mr-3" />
        )}
      </div>

      {open && (q.length > 0 || results.length > 0) && (
        <div
          data-testid={`${testId}-listbox`}
          className="absolute left-0 right-0 top-full mt-1 z-30 bg-surface border border-border max-h-80 overflow-y-auto shadow-lg"
        >
          {results.length === 0 && !loading && (
            <div className="px-4 py-3 mono text-xs text-muted-foreground">
              {q ? "No matches" : "Start typing a company name…"}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.ticker}
              onClick={() => pick(r)}
              data-testid={`company-option-${r.ticker}`}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-4 py-2 flex items-center gap-3 border-b border-border/60 last:border-b-0 ${
                i === active ? "bg-surface-hover" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-primary truncate">{r.name}</div>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <span>{r.ticker}</span>
                  {r.exchange && (
                    <span
                      className={`px-1 py-0.5 border text-[9px] ${
                        r.exchange === "IN"
                          ? "border-warning text-warning"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {r.exchange === "IN" ? "NSE/BSE" : "NYSE/NASDAQ"}
                    </span>
                  )}
                </div>
              </div>
              {r.has_filings ? (
                <span className="mono text-[10px] uppercase text-bullish inline-flex items-center gap-1">
                  <CheckCircle size={10} weight="fill" /> filings
                </span>
              ) : r.exchange === "IN" ? (
                <span className="mono text-[10px] uppercase text-warning inline-flex items-center gap-1">
                  <Warning size={10} weight="fill" /> paste/upload
                </span>
              ) : (
                <span className="mono text-[10px] uppercase text-warning inline-flex items-center gap-1">
                  <Warning size={10} weight="fill" /> auto-fetch
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
