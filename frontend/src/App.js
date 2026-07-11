import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { JobsProvider } from "@/lib/jobs";
import { LlmProvider } from "@/lib/llmSettings";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Docs from "@/pages/Docs";
import Dashboard from "@/pages/Dashboard";
import ReportView from "@/pages/ReportView";
import Ingest from "@/pages/Ingest";
import Compare from "@/pages/Compare";

function App() {
  return (
      <div className="App bg-background text-foreground min-h-screen">
        <Toaster
          theme="dark"
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
          <LlmProvider>
          <JobsProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/docs" element={<Docs />} />
              <Route element={<AppLayout />}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/ingest" element={<Ingest />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/reports/:id" element={<ReportView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </JobsProvider>
          </LlmProvider>
        </BrowserRouter>
      </div>
  );
}

export default App;
