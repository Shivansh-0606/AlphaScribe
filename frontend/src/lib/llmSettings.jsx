import { createContext, useContext, useState, useCallback } from "react";

/**
 * Bring-your-own LLM key. Stored in localStorage (this browser only, never
 * committed to the server beyond the single request that uses it). Lets anyone
 * who clones the repo run the app with their own free key — no .env edit needed.
 */
const KEY = "alphascribe:llm";
const LlmCtx = createContext(null);

export const PROVIDERS = [
  { id: "gemini", label: "Google Gemini", keyUrl: "https://aistudio.google.com/apikey", hint: "Free tier available" },
  { id: "groq", label: "Groq (Llama)", keyUrl: "https://console.groq.com/keys", hint: "Free, very fast" },
  { id: "openai", label: "OpenAI (GPT-4o)", keyUrl: "https://platform.openai.com/api-keys", hint: "Paid" },
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function LlmProvider({ children }) {
  const [cfg, setCfg] = useState(load); // {provider, api_key}

  const save = useCallback((next) => {
    setCfg(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }, []);

  const clear = useCallback(() => {
    setCfg({});
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);

  // Fields to merge into a generateReport() payload.
  const payload = () =>
    cfg.api_key ? { llm_provider: cfg.provider, llm_api_key: cfg.api_key } : {};

  return (
    <LlmCtx.Provider value={{ cfg, save, clear, payload }}>
      {children}
    </LlmCtx.Provider>
  );
}

export const useLlm = () =>
  useContext(LlmCtx) || { cfg: {}, save: () => {}, clear: () => {}, payload: () => ({}) };
