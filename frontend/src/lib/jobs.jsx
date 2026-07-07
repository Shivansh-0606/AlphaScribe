import { createContext, useCallback, useContext, useRef, useState } from "react";
import { streamJob, getReport, cancelReport } from "@/lib/api";

/**
 * Global job store. Owns the SSE connections ABOVE the router, so a running
 * analysis keeps streaming (and always lands in History) even when the user
 * navigates to another tab. A status bar reads from here to show live progress
 * anywhere in the app.
 */
const JobsCtx = createContext(null);
export const useJobs = () => useContext(JobsCtx) || { jobs: {}, ensureJob: () => {}, startJob: () => {}, cancelJob: () => {} };

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState({}); // id -> {id,status,events,report,ticker,query,lastNode}
  const closers = useRef({});           // id -> EventSource close fn

  const patch = useCallback((id, upd) => {
    setJobs((prev) => {
      const cur = prev[id] || { id, events: [] };
      const next = typeof upd === "function" ? upd(cur) : upd;
      return { ...prev, [id]: { ...cur, ...next } };
    });
  }, []);

  const attach = useCallback((id) => {
    if (closers.current[id]) return; // already streaming
    closers.current[id] = streamJob(
      id,
      (ev) => {
        if (ev.node === "final" && ev.report) {
          patch(id, () => ({
            report: ev.report, status: "completed",
            ticker: ev.report.ticker, query: ev.report.query,
          }));
          return;
        }
        patch(id, (j) => ({
          status: "running",
          events: [...(j.events || []), ev],
          lastNode: ev.node || j.lastNode,
          ticker: j.ticker || ev.message?.match(/for (\w+)/)?.[1],
        }));
      },
      () => {
        delete closers.current[id];
        // finalize — pull the snapshot in case the final frame was missed
        getReport(id)
          .then((d) => {
            if (d.report) {
              patch(id, () => ({
                report: d.report, status: "completed",
                ticker: d.report.ticker, query: d.report.query,
              }));
            } else {
              patch(id, (j) => ({ status: j.report ? "completed" : "failed" }));
            }
          })
          .catch(() => patch(id, (j) => ({ status: j.report ? "completed" : "failed" })));
      },
    );
  }, [patch]);

  // Idempotent: make sure a job is tracked + streaming (used by ReportView).
  const ensureJob = useCallback((id) => {
    getReport(id)
      .then((d) => {
        if (d.status === "completed" && d.report) {
          patch(id, () => ({
            report: d.report, status: "completed",
            events: d.report.events || [], ticker: d.report.ticker, query: d.report.query,
          }));
        } else {
          patch(id, (j) => ({ status: "running", events: d.events || j.events || [] }));
          attach(id);
        }
      })
      .catch(() => attach(id));
  }, [attach, patch]);

  // Called right when a report is dispatched, so the status bar shows instantly.
  const startJob = useCallback((id, meta = {}) => {
    patch(id, () => ({ status: "running", events: [], ...meta }));
    attach(id);
  }, [attach, patch]);

  const cancelJob = useCallback((id) => {
    closers.current[id]?.();          // close SSE
    delete closers.current[id];
    patch(id, () => ({ status: "cancelled" }));
    cancelReport(id).catch(() => {}); // tell backend to stop the task
  }, [patch]);

  return (
    <JobsCtx.Provider value={{ jobs, ensureJob, startJob, cancelJob }}>
      {children}
    </JobsCtx.Provider>
  );
}
