import { useState } from "react";
import { toast } from "sonner";
import { Gear, X, Check, ArrowSquareOut } from "@phosphor-icons/react";
import { useLlm, PROVIDERS } from "@/lib/llmSettings";

/** Sidebar button + modal to set a bring-your-own LLM provider + API key. */
export default function LlmSettings() {
  const { cfg, save, clear } = useLlm();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(cfg.provider || "gemini");
  const [apiKey, setApiKey] = useState(cfg.api_key || "");

  const active = PROVIDERS.find((p) => p.id === (cfg.provider || "gemini"));
  const configured = !!cfg.api_key;

  const onSave = () => {
    if (!apiKey.trim()) {
      toast.error("Enter an API key");
      return;
    }
    save({ provider, api_key: apiKey.trim() });
    toast.success(`Using your ${PROVIDERS.find((p) => p.id === provider)?.label} key`);
    setOpen(false);
  };

  const onClear = () => {
    clear();
    setApiKey("");
    toast.success("Key cleared — using server default");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="llm-settings-open"
        className="w-full flex items-center gap-2 px-4 h-10 text-xs mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-surface border-l-2 border-transparent"
        title="Set your own LLM API key"
      >
        <Gear size={14} /> LLM Key
        <span className={`ml-auto text-[9px] ${configured ? "text-bullish" : "text-muted-foreground"}`}>
          {configured ? active?.label?.split(" ")[0] : "default"}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-background border border-border w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 px-4 flex items-center border-b border-border">
              <Gear size={15} className="text-primary mr-2" />
              <span className="mono text-xs uppercase tracking-widest text-primary">LLM Provider & Key</span>
              <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use your own API key so the app runs on your quota. Stored only in
                this browser (localStorage) and sent solely with your analysis
                requests — never saved on the server.
              </p>

              <div>
                <div className="label-mono mb-2">Provider</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {PROVIDERS.map((p) => (
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="label-mono">API Key</div>
                  <a
                    href={PROVIDERS.find((p) => p.id === provider)?.keyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-[10px] text-brand hover:underline inline-flex items-center gap-1"
                  >
                    get a key <ArrowSquareOut size={10} />
                  </a>
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
        </div>
      )}
    </>
  );
}
