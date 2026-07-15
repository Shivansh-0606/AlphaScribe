import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
if (!BACKEND_URL) {
  // Fall back to same-origin "/api" (valid when served behind one proxy).
  // In this repo's split dev setup (frontend :3001, backend :8001) the var is
  // required — warn so a missing .env doesn't silently 404 every call as the
  // old `undefined/api` did.
  console.warn("REACT_APP_BACKEND_URL is not set; using same-origin /api");
}
export const API = `${BACKEND_URL}/api`;

// Phase 4 login wall: every tool endpoint requires the session cookie, so
// credentials ride on the shared instance rather than per-call.
export const http = axios.create({ baseURL: API, timeout: 60000, withCredentials: true });

export const registerUser = (email, password) =>
  http.post("/auth/register", { email, password }).then((r) => r.data);
export const loginUser = (email, password, remember) =>
  http.post("/auth/login", { email, password, remember }).then((r) => r.data);
export const logoutUser = () => http.post("/auth/logout").then((r) => r.data);
export const getMe = () => http.get("/auth/me").then((r) => r.data);
export const changePassword = (current_password, new_password) =>
  http.post("/auth/password", { current_password, new_password }).then((r) => r.data);
export const logoutAllSessions = () => http.post("/auth/logout-all").then((r) => r.data);
export const deleteAccount = (email) =>
  http.delete("/auth/me", { data: { email } }).then((r) => r.data);
export const forgotPassword = (email) =>
  http.post("/auth/forgot-password", { email }).then((r) => r.data);
export const resetPassword = (email, otp, new_password) =>
  http.post("/auth/reset-password", { email, otp, new_password }).then((r) => r.data);

export const listTickers = () => http.get("/tickers").then((r) => r.data.tickers);
export const listCompanies = () => http.get("/companies").then((r) => r.data.companies);
export const listFilings = (ticker) =>
  http.get("/filings", { params: ticker ? { ticker } : {} }).then((r) => r.data.filings);
export const listReports = (ticker) =>
  http.get("/reports", { params: ticker ? { ticker } : {} }).then((r) => r.data.reports);
export const deleteReport = (id) => http.delete(`/reports/${id}`).then((r) => r.data);
export const trendingCompanies = () =>
  http.get("/companies/trending").then((r) => r.data.trending);
export const getReport = (id) => http.get(`/reports/${id}`).then((r) => r.data);
export const generateReport = (payload) =>
  http.post("/reports/generate", payload).then((r) => r.data);
export const cancelReport = (jobId) =>
  http.post(`/reports/${jobId}/cancel`).then((r) => r.data);
export const compareReports = (report_ids) =>
  http.post("/reports/compare", { report_ids }).then((r) => r.data.reports);
export const ingestText = (payload) => http.post("/ingest/text", payload).then((r) => r.data);
export const ingestEdgar = (payload) => http.post("/ingest/edgar", payload).then((r) => r.data);
export const ingestSamples = () => http.post("/ingest/samples").then((r) => r.data);
export const searchCompanies = (q, limit = 8) =>
  http.get("/companies/search", { params: { q, limit } }).then((r) => r.data);
export const ensureCompany = (ticker, refresh = false) =>
  http.post("/companies/ensure", { ticker, refresh }).then((r) => r.data);
export const ingestAudio = ({ file, ticker, source, company_name, language }) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("ticker", ticker);
  if (source) fd.append("source", source);
  if (company_name) fd.append("company_name", company_name);
  if (language) fd.append("language", language);
  return http.post("/ingest/audio", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 180000,
  }).then((r) => r.data);
};
export const ingestPdf = ({ file, ticker, source, company_name }) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("ticker", ticker);
  if (source) fd.append("source", source);
  if (company_name) fd.append("company_name", company_name);
  return http.post("/ingest/pdf", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 180000,
  }).then((r) => r.data);
};
export const health = () => http.get("/health").then((r) => r.data);

/** Subscribe to SSE for a job. Returns a close() function. */
export const streamJob = (jobId, onEvent, onEnd) => {
  const url = `${API}/reports/${jobId}/stream`;
  // /stream is gated behind the login wall — EventSource needs an explicit
  // opt-in to send the cross-origin session cookie (unlike axios/fetch, it
  // doesn't default to same-site-only without this flag either way).
  const es = new EventSource(url, { withCredentials: true });
  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      onEvent(data);
    } catch (e) {
      // ignore keepalive/parse errors
    }
  };
  es.addEventListener("end", () => {
    es.close();
    onEnd?.();
  });
  es.onerror = () => {
    // EventSource auto-reconnects on transient blips (readyState CONNECTING).
    // Only give up when the browser has permanently closed the stream, so a
    // brief network hiccup mid-report isn't reported as a failed job.
    if (es.readyState === EventSource.CLOSED) {
      es.close();
      onEnd?.();
    }
  };
  return () => es.close();
};
