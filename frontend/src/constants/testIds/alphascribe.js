// Central testIds registry (see other files in this dir for patterns).
export const APP = {
  root: "app-root",
  sidebar: "app-sidebar",
  sidebarNewReport: "sidebar-new-report",
  sidebarDashboard: "sidebar-dashboard",
  sidebarIngest: "sidebar-ingest",
  sidebarCompare: "sidebar-compare",
  sidebarSettings: "sidebar-settings",
  historyItem: (id) => `history-item-${id}`,
};

// The report composer at /app ("New Report"). Kept the original id strings so
// existing selectors keep working — only the export name changed when the
// dashboard became its own route.
export const NEW_REPORT = {
  root: "dashboard-root",
  tickerInput: "ticker-input",
  queryInput: "query-input",
  submitButton: "generate-report-button",
  seedSamplesButton: "seed-samples-button",
  tickerChip: (t) => `ticker-chip-${t}`,
};

// The dashboard route (/dashboard) — the signed-in home, and where the
// first-run onboarding banner now lives (it follows the landing page).
export const DASHBOARD = {
  root: "dashboard-overview-root",
  stat: (id) => `dashboard-stat-${id}`,
  reportRow: (id) => `dashboard-report-${id}`,
  watchlistItem: (t) => `dashboard-watchlist-${t}`,
  quickAction: (id) => `dashboard-quick-${id}`,
  onboardingBanner: "onboarding-banner",
  onboardingSetKey: "onboarding-set-key",
  onboardingSkip: "onboarding-skip",
};

export const REPORT = {
  root: "report-root",
  pipelineLog: "pipeline-log",
  markdown: "markdown-content",
  factCheckBadge: "fact-check-badge",
  toneGauge: "tone-gauge",
  financialsTable: "financials-table",
  sourcesPanel: "sources-panel",
  sourceCard: (n) => `source-card-${n}`,
  citationLink: (n) => `citation-link-${n}`,
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

export const AUTH = {
  loginRoot: "login-root",
  signupRoot: "signup-root",
  emailField: "auth-email",
  passwordField: "auth-password",
  rememberField: "auth-remember",
  submitButton: "auth-submit",
  sidebarUser: "sidebar-auth-user",
  sidebarLogout: "sidebar-logout",
  sidebarLogin: "sidebar-login",
  forgotPasswordLink: "auth-forgot-password-link",
  forgotPasswordRoot: "forgot-password-root",
  otpField: "auth-otp",
  newPasswordField: "auth-new-password",
  requestOtpSubmit: "auth-request-otp-submit",
  resetPasswordSubmit: "auth-reset-password-submit",
};

// The /settings route (formerly /account). Original id strings kept.
export const SETTINGS = {
  root: "account-root",
  currentPasswordField: "account-current-password",
  newPasswordField: "account-new-password",
  changePasswordSubmit: "account-change-password-submit",
  logoutEverywhereButton: "account-logout-everywhere",
  deleteConfirmField: "account-delete-confirm",
  deleteAccountButton: "account-delete-button",
  llmConfigureButton: "settings-llm-configure",
  signOutButton: "settings-sign-out",
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
