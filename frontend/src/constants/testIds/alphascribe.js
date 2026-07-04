// Central testIds registry (see other files in this dir for patterns).
export const APP = {
  root: "app-root",
  sidebar: "app-sidebar",
  sidebarNewReport: "sidebar-new-report",
  sidebarIngest: "sidebar-ingest",
  sidebarCompare: "sidebar-compare",
  historyItem: (id) => `history-item-${id}`,
};

export const DASHBOARD = {
  root: "dashboard-root",
  tickerInput: "ticker-input",
  queryInput: "query-input",
  submitButton: "generate-report-button",
  seedSamplesButton: "seed-samples-button",
  tickerChip: (t) => `ticker-chip-${t}`,
};

export const REPORT = {
  root: "report-root",
  pipelineLog: "pipeline-log",
  markdown: "markdown-content",
  factCheckBadge: "fact-check-badge",
  toneGauge: "tone-gauge",
  financialsTable: "financials-table",
  sourcesPanel: "sources-panel",
  claimsPanel: "claims-panel",
  claimRow: (i) => `claim-row-${i}`,
  scorecard: "quality-scorecard",
};

export const COMPARE = {
  root: "compare-root",
  addRow: (id) => `compare-toggle-${id}`,
  runButton: "compare-run",
  clearButton: "compare-clear",
  column: (id) => `compare-column-${id}`,
};

export const INGEST = {
  root: "ingest-root",
  textForm: "ingest-text-form",
  tickerField: "ingest-ticker",
  sourceField: "ingest-source",
  textField: "ingest-text",
  submitText: "ingest-submit-text",
  edgarTicker: "ingest-edgar-ticker",
  edgarForm: "ingest-edgar-form",
  edgarSubmit: "ingest-edgar-submit",
  samplesButton: "ingest-samples-button",
};
