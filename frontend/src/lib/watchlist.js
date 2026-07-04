import { Star } from "@phosphor-icons/react";
import { useEffect, useState, useCallback } from "react";

const KEY = "alphascribe:watchlist:v1";

export function readWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function useWatchlist() {
  const [list, setList] = useState(() => readWatchlist());

  const persist = useCallback((next) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setList(next);
  }, []);

  const isWatched = useCallback(
    (ticker) => list.some((r) => r.ticker === ticker.toUpperCase()),
    [list],
  );

  const toggle = useCallback(
    (row) => {
      const tk = row.ticker.toUpperCase();
      const next = list.some((r) => r.ticker === tk)
        ? list.filter((r) => r.ticker !== tk)
        : [{ ticker: tk, name: row.name }, ...list].slice(0, 20);
      persist(next);
    },
    [list, persist],
  );

  return { watchlist: list, toggle, isWatched };
}

export function WatchlistStar({ row, size = 14 }) {
  const { toggle, isWatched } = useWatchlist();
  const on = isWatched(row.ticker);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(row);
      }}
      data-testid={`watchlist-toggle-${row.ticker}`}
      title={on ? "Remove from watchlist" : "Add to watchlist"}
      className="p-1 text-muted-foreground hover:text-warning transition-none"
    >
      <Star size={size} weight={on ? "fill" : "regular"} className={on ? "text-warning" : ""} />
    </button>
  );
}
