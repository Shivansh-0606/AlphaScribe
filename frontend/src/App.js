import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import { JobsProvider } from "@/lib/jobs";
import { LlmProvider } from "@/lib/llmSettings";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Docs from "@/pages/Docs";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import NewReport from "@/pages/NewReport";
import Dashboard from "@/pages/Dashboard";
import ReportView from "@/pages/ReportView";
import Ingest from "@/pages/Ingest";
import Compare from "@/pages/Compare";
import Settings from "@/pages/Settings";

function App() {
  return (
      <div className="App bg-background text-foreground min-h-screen">
        <Toaster
          theme="light"
          position="top-right"
          toastOptions={{
            style: {
              background: "hsl(var(--surface))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 0,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12,
            },
          }}
        />
        <BrowserRouter>
          <AuthProvider>
          <LlmProvider>
          <JobsProvider>
            <AnimatedRoutes />
          </JobsProvider>
          </LlmProvider>
          </AuthProvider>
        </BrowserRouter>
      </div>
  );
}

// Public/marketing pages fade on route change. Every signed-in route collapses
// to one stable key ("app-shell") so navigating inside the app does NOT re-fade
// the whole shell — the sidebar and ambient background stay put, and the main
// content fades on its own (handled by AppLayout's Outlet AnimatePresence).
const APP_PREFIXES = ["/app", "/dashboard", "/ingest", "/compare", "/reports", "/settings", "/account"];

function AnimatedRoutes() {
  const location = useLocation();
  const inApp = APP_PREFIXES.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/"),
  );
  const transitionKey = inApp ? "app-shell" : location.pathname;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/app" element={<NewReport />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ingest" element={<Ingest />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/reports/:id" element={<ReportView />} />
            <Route path="/settings" element={<Settings />} />
            {/* /account was the old settings route */}
            <Route path="/account" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default App;
