import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({ baseURL: API, timeout: 60000 });

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
export const health = () => http.get("/health").then((r) => r.data);

/** Subscribe to SSE for a job. Returns a close() function. */
export const streamJob = (jobId, onEvent, onEnd) => {
  const url = `${API}/reports/${jobId}/stream`;
  const es = new EventSource(url);
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
    es.close();
    onEnd?.();
  };
  return () => es.close();
};
