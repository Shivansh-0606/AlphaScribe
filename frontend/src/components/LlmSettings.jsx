import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Gear, X, Check, ArrowSquareOut } from "@phosphor-icons/react";
import { useLlm, PROVIDERS } from "@/lib/llmSettings";
import { useAuth } from "@/lib/auth";


// Quick client-side heads-up only — NOT the security boundary. The backend's
// SSRF guard (agents/llm.py assert_public_url) is authoritative and re-checks
// via DNS resolution; this just saves the user a round-trip for obvious cases.
function looksPrivate(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      h === "localhost" || h === "0.0.0.0" || h === "::1" ||
      /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^169\.254\./.test(h) ||
      h.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/**
 * Modal (only) to set a bring-your-own LLM provider + API key. It renders
 * nothing until `openSettings()` is called on the LlmProvider context — the
 * triggers now live on /settings and in the first-run banner, so the sidebar
 * stays a pure navigation surface.
 */
export default function LlmSettings() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  // Custom (bring-your-own endpoint) is admin-only — see server.py
  // /reports/generate, which enforces this server-side regardless of what the
  // UI shows. Hiding it here is just so non-admins never hit that 403.
  const visibleProviders = PROVIDERS.filter((p) => p.id !== "custom" || isAdmin);

  const { cfg, save, clear, settingsOpen: open, closeSettings } = useLlm();
  const [provider, setProvider] = useState(
    cfg.provider === "custom" && !isAdmin ? "gemini" : cfg.provider || "gemini"
  );
  const [apiKey, setApiKey] = useState(cfg.api_key || "");
  const [baseUrl, setBaseUrl] = useState(cfg.base_url || "");
  const [model, setModel] = useState(cfg.model || "");

  const selected = PROVIDERS.find((p) => p.id === provider);
  const configured = !!cfg.api_key;
  const isCustom = provider === "custom" && isAdmin;

  const onSave = () => {
    if (!apiKey.trim()) {
      toast.error("Enter an API key");
      return;
    }
    if (isCustom && !baseUrl.trim()) {
      toast.error("Custom provider needs a base URL");
      return;
    }
    if (isCustom && looksPrivate(baseUrl.trim())) {
      // Not blocked here — the backend is authoritative. It allows this only
      // if the server operator opted in (LLM_ALLOW_PRIVATE_BASE_URL=true);
      // otherwise report generation will fail with an explanation.
      toast.warning(
        "That's a local/private address — this only works if the server you're "
        + "connecting to has LLM_ALLOW_PRIVATE_BASE_URL enabled (e.g. your own "
        + "local AlphaScribe instance)."
      );
    }
    if (isCustom && !model.trim()) {
      toast.error("Custom provider needs a model name");
      return;
    }
    save({
      provider,
      api_key: apiKey.trim(),
      base_url: isCustom ? baseUrl.trim() : "",
      model: isCustom ? model.trim() : "",
    });
    toast.success(`Using your ${selected?.label} key`);
    closeSettings();
  };

  const onClear = () => {
    clear();
    setApiKey(""); setBaseUrl(""); setModel("");
    toast.success("Key cleared — using server default");
  };

  return (
    <>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div
            className="w-full max-w-md border border-border shadow-2xl bg-[hsl(var(--background))]"
          >
            <div className="h-12 px-4 flex items-center border-b border-border bg-[hsl(var(--surface))]">
              <Gear size={15} className="text-primary mr-2" />
              <span className="mono text-xs uppercase tracking-widest text-primary">LLM Provider &amp; Key</span>
              <button onClick={closeSettings} className="ml-auto text-muted-foreground hover:text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4 bg-[hsl(var(--background))] max-h-[80vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use your own API key so the app runs on your quota. Stored only in
                this browser and sent solely with your analysis requests — never
                saved on the server.
              </p>

              <div>
                <div className="label-mono mb-2">Provider</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {visibleProviders.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`flex items-center gap-2 px-3 py-2 border text-left ${
                        provider === p.id ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {provider === p.id ? <Check size={13} className="text-bullish" /> : <span className="w-[13px]" />}
                      <span className="text-sm">{p.label}</span>
                      <span className="mono text-[10px] text-muted-foreground ml-auto">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isCustom && (
                <>
                  <div>
                    <div className="label-mono mb-2">Base URL</div>
                    <input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://aipipe.org/openai/v1"
                      className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:border-primary"
                    />
                    <div className="mono text-[10px] text-muted-foreground mt-1">
                      OpenAI-compatible endpoint (must end in /v1). The server
                      (not your browser) calls this URL, so localhost/private
                      addresses only work if the server opted in via
                      LLM_ALLOW_PRIVATE_BASE_URL.
                    </div>
                  </div>
                  <div>
                    <div className="label-mono mb-2">Model</div>
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="gpt-4o-mini"
                      className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="label-mono">API Key</div>
                  {selected?.keyUrl && (
                    <a
                      href={selected.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mono text-[10px] text-brand hover:underline inline-flex items-center gap-1"
                    >
                      get a key <ArrowSquareOut size={10} />
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="paste key here"
                  data-testid="llm-settings-key"
                  className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onSave}
                  data-testid="llm-settings-save"
                  className="flex-1 mono text-[11px] uppercase tracking-widest h-10 bg-primary text-primary-foreground"
                >
                  Save
                </button>
                {configured && (
                  <button
                    onClick={onClear}
                    className="mono text-[11px] uppercase tracking-widest h-10 px-4 border border-border text-muted-foreground hover:text-bearish hover:border-bearish"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
