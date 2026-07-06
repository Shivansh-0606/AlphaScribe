import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme";
import { JobsProvider } from "@/lib/jobs";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ReportView from "@/pages/ReportView";
import Ingest from "@/pages/Ingest";
import Compare from "@/pages/Compare";

function App() {
  return (
    <ThemeProvider>
      <div className="App bg-background text-foreground min-h-screen">
        <Toaster
          theme="system"
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
          <JobsProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/ingest" element={<Ingest />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/reports/:id" element={<ReportView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </JobsProvider>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;
