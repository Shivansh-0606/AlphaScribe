import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
            <Routes>
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
          </JobsProvider>
          </LlmProvider>
          </AuthProvider>
        </BrowserRouter>
      </div>
  );
}

export default App;
