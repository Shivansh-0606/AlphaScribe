import { createContext, useContext, useState, useCallback } from "react";

/**
 * Bring-your-own LLM key. Stored in localStorage (this browser only, never
 * committed to the server beyond the single request that uses it). Lets anyone
 * who clones the repo run the app with their own key — no .env edit needed.
 *
 * "custom" targets ANY OpenAI-compatible endpoint (aipipe, OpenRouter,
 * Together, a local LLM, ...) via a base URL + model name.
 */
const KEY = "alphascribe:llm";
const LlmCtx = createContext(null);

export const PROVIDERS = [
  { id: "gemini", label: "Google Gemini", keyUrl: "https://aistudio.google.com/apikey", hint: "Free tier", custom: false },
  { id: "groq", label: "Groq (Llama)", keyUrl: "https://console.groq.com/keys", hint: "Free, fast", custom: false },
  { id: "openai", label: "OpenAI", keyUrl: "https://platform.openai.com/api-keys", hint: "Paid", custom: false },
  { id: "custom", label: "Custom (OpenAI-compatible)", keyUrl: "", hint: "aipipe, OpenRouter, local…", custom: true },
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function LlmProvider({ children }) {
  const [cfg, setCfg] = useState(load); // {provider, api_key, base_url, model}

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
    cfg.api_key
      ? {
          llm_provider: cfg.provider,
          llm_api_key: cfg.api_key,
          ...(cfg.base_url ? { llm_base_url: cfg.base_url } : {}),
          ...(cfg.model ? { llm_model: cfg.model } : {}),
        }
      : {};

  return (
    <LlmCtx.Provider value={{ cfg, save, clear, payload }}>
      {children}
    </LlmCtx.Provider>
  );
}

export const useLlm = () =>
  useContext(LlmCtx) || { cfg: {}, save: () => {}, clear: () => {}, payload: () => ({}) };
