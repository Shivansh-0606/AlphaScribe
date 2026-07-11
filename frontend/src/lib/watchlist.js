import { Star } from "@phosphor-icons/react";
import { useCallback, useSyncExternalStore } from "react";

const KEY = "alphascribe:watchlist:v1";

// Single shared store so every useWatchlist() consumer (sidebar, report star,
// dashboard) stays in sync live — starring anywhere updates everywhere with no
// refresh. useSyncExternalStore subscribes each component to the same source.
const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

let current = read();

function write(next) {
  current = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  // keep other tabs in sync too
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      current = read();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function readWatchlist() {
  return current;
}

export function useWatchlist() {
  const list = useSyncExternalStore(subscribe, readWatchlist);

  const isWatched = useCallback(
    (ticker) => current.some((r) => r.ticker === ticker.toUpperCase()),
    [],
  );

  const toggle = useCallback((row) => {
    const tk = row.ticker.toUpperCase();
    const next = current.some((r) => r.ticker === tk)
      ? current.filter((r) => r.ticker !== tk)
      : [{ ticker: tk, name: row.name }, ...current].slice(0, 20);
    write(next);
  }, []);

  const remove = useCallback((ticker) => {
    write(current.filter((r) => r.ticker !== ticker.toUpperCase()));
  }, []);

  return { watchlist: list, toggle, isWatched, remove };
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
