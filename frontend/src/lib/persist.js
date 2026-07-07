import { useEffect, useState } from "react";

/**
 * Like useState, but persists to sessionStorage under `key`. Survives route
 * changes (tab switches) so a half-filled Ingest form or a Compare selection is
 * not wiped when the user navigates away and back. Cleared when the browser tab
 * closes.
 */
export function usePersistedState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [key, val]);
  return [val, setVal];
}
