import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { ingestAudio, ingestEdgar, ingestSamples, ingestText, listFilings } from "@/lib/api";
import { INGEST } from "@/constants/testIds";
import { Upload, Database, Globe, Microphone, Waveform } from "@phosphor-icons/react";

const TABS = [
  { id: "text", label: "Paste Text" },
  { id: "audio", label: "Upload Audio" },
  { id: "edgar", label: "SEC EDGAR" },
  { id: "samples", label: "Sample Corpus" },
];

export default function Ingest() {
  const [tab, setTab] = useState("text");
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [edgarTicker, setEdgarTicker] = useState("");
  const [edgarForm, setEdgarForm] = useState("10-Q");
  const [audioTicker, setAudioTicker] = useState("");
  const [audioCompany, setAudioCompany] = useState("");
  const [audioSource, setAudioSource] = useState("Earnings Call");
  const [audioLang, setAudioLang] = useState("en");
  const [audioFile, setAudioFile] = useState(null);
  const [filings, setFilings] = useState([]);
  const [loading, setLoading] = useState(null);
  const [audioPreview, setAudioPreview] = useState("");
  const fileRef = useRef(null);
  const { refresh } = useOutletContext() || {};

  const load = async () => {
    const rows = await listFilings();
    setFilings(rows);
  };
  useEffect(() => {
    load();
  }, []);

  const doText = async (e) => {
    e.preventDefault();
    if (!ticker || !source || !text.trim()) return;
    setLoading("text");
    try {
      const r = await ingestText({
        ticker: ticker.toUpperCase(),
        source,
        text,
        company_name: companyName || undefined,
      });
      toast.success(`Ingested ${r.num_chunks} chunks for ${r.company_name || r.ticker}`);
      setText(""); setSource(""); setCompanyName("");
      await load(); refresh?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(null);
    }
  };

  const doEdgar = async (e) => {
    e.preventDefault();
    if (!edgarTicker) return;
    setLoading("edgar");
    try {
      const r = await ingestEdgar({ ticker: edgarTicker.toUpperCase(), form_type: edgarForm });
      toast.success(`Fetched ${r.source} — ${r.num_chunks} chunks (${r.company_name || r.ticker})`);
      await load(); refresh?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message);
    } finally {
      setLoading(null);
    }
  };

  const doSamples = async () => {
    setLoading("samples");
    try {
      const r = await ingestSamples();
      toast.success(
        r.ingested.length
          ? `Ingested ${r.ingested.length} sample filings`
          : "Samples already loaded",
      );
      await load(); refresh?.();
    } catch {
      toast.error("Seed failed");
    } finally {
      setLoading(null);
    }
  };

  const doAudio = async (e) => {
    e.preventDefault();
    if (!audioFile || !audioTicker) {
      toast.error("Ticker and audio file are required");
      return;
    }
    setLoading("audio");
    setAudioPreview("");
    try {
      const r = await ingestAudio({
        file: audioFile,
        ticker: audioTicker.toUpperCase(),
        source: audioSource || "Audio Transcript",
        company_name: audioCompany || undefined,
        language: audioLang,
      });
      toast.success(`Transcribed ${r.transcript_chars} chars → ${r.num_chunks} chunks`);
      setAudioPreview(r.transcript_preview || "");
      setAudioFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load(); refresh?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      toast.error(String(msg).slice(0, 200));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div data-testid={INGEST.root} className="min-h-screen">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="h-14 px-6 flex items-center gap-3">
          <span className="mono text-[10px] text-muted-foreground uppercase tracking-widest">
            /ingest
          </span>
          <span className="mono text-xs text-primary/70">upload filings to the corpus</span>
        </div>
        <div className="px-6 flex divider-x border-t border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`ingest-tab-${t.id}`}
              className={`h-10 px-4 mono text-[11px] uppercase tracking-widest border-b-2 ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-px bg-border">
        {/* Left: active form */}
        <div className="bg-background p-6">
          {tab === "text" && (
            <form
              data-testid={INGEST.textForm}
              onSubmit={doText}
              className="max-w-3xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <Upload size={16} className="text-primary" />
                <div>
                  <div className="text-sm text-primary">Paste filing text</div>
                  <div className="label-mono mt-0.5">10-K · 10-Q · press release · notes</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="label-mono block mb-1">Ticker</label>
                  <input
                    data-testid={INGEST.tickerField}
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full input-bg border border-border text-primary mono px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                  />
                </div>
                <div>
                  <label className="label-mono block mb-1">Company name</label>
                  <input
                    data-testid="ingest-company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Apple Inc."
                    className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="label-mono block mb-1">Source label</label>
                  <input
                    data-testid={INGEST.sourceField}
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="10-Q FY24 Q3"
                    className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <label className="label-mono block mb-1">Text</label>
              <textarea
                data-testid={INGEST.textField}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                placeholder="Paste the filing text here…"
                className="w-full input-bg border border-border text-primary mono text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                data-testid={INGEST.submitText}
                disabled={loading === "text"}
                className="mt-3 mono text-xs uppercase tracking-widest h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2"
              >
                <Upload size={14} />
                {loading === "text" ? "Ingesting…" : "Ingest text"}
              </button>
            </form>
          )}

          {tab === "audio" && (
            <form
              data-testid="ingest-audio-form"
              onSubmit={doAudio}
              className="max-w-3xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <Microphone size={16} className="text-primary" />
                <div>
                  <div className="text-sm text-primary">Transcribe an earnings call</div>
                  <div className="label-mono mt-0.5">
                    OpenAI Whisper · mp3 · wav · m4a · max 25MB
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="label-mono block mb-1">Ticker</label>
                  <input
                    data-testid="ingest-audio-ticker"
                    value={audioTicker}
                    onChange={(e) => setAudioTicker(e.target.value.toUpperCase())}
                    placeholder="TSLA"
                    className="w-full input-bg border border-border text-primary mono px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                  />
                </div>
                <div>
                  <label className="label-mono block mb-1">Company name</label>
                  <input
                    value={audioCompany}
                    onChange={(e) => setAudioCompany(e.target.value)}
                    placeholder="Tesla, Inc."
                    className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="label-mono block mb-1">Source label</label>
                  <input
                    value={audioSource}
                    onChange={(e) => setAudioSource(e.target.value)}
                    placeholder="Earnings Call Q3-24"
                    className="w-full input-bg border border-border text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <label className="label-mono block mb-1">Audio file</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
                    data-testid="ingest-audio-file"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    className="w-full input-bg border border-border text-primary mono text-xs px-3 py-2 file:mr-3 file:mono file:text-[10px] file:uppercase file:tracking-widest file:bg-surface file:text-primary file:border-0 file:px-3 file:py-1"
                  />
                </div>
                <div>
                  <label className="label-mono block mb-1">Language</label>
                  <select
                    value={audioLang}
                    onChange={(e) => setAudioLang(e.target.value)}
                    className="input-bg border border-border text-primary mono text-xs px-3 h-9 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
              </div>

              {audioFile && (
                <div className="mt-3 mono text-[11px] text-muted-foreground flex items-center gap-2">
                  <Waveform size={12} />
                  <span className="text-primary">{audioFile.name}</span>
                  <span>· {(audioFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}

              <button
                type="submit"
                data-testid="ingest-audio-submit"
                disabled={loading === "audio" || !audioFile || !audioTicker}
                className="mt-4 mono text-xs uppercase tracking-widest h-10 px-4 bg-brand text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
              >
                <Microphone size={14} />
                {loading === "audio" ? "Transcribing…" : "Transcribe & ingest"}
              </button>

              {audioPreview && (
                <div className="mt-6">
                  <div className="label-mono mb-2">Transcript preview</div>
                  <div className="cell p-3 mono text-xs text-primary/80 leading-relaxed max-h-64 overflow-y-auto">
                    {audioPreview}
                    {audioPreview.length >= 400 && (
                      <span className="text-muted-foreground"> …</span>
                    )}
                  </div>
                </div>
              )}
            </form>
          )}

          {tab === "edgar" && (
            <form data-testid={INGEST.edgarForm} onSubmit={doEdgar} className="max-w-3xl">
              <div className="flex items-center gap-2 mb-4">
                <Globe size={16} className="text-primary" />
                <div>
                  <div className="text-sm text-primary">Fetch from SEC EDGAR</div>
                  <div className="label-mono mt-0.5">latest filing for a US-listed company</div>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-3">
                <input
                  data-testid={INGEST.edgarTicker}
                  value={edgarTicker}
                  onChange={(e) => setEdgarTicker(e.target.value.toUpperCase())}
                  placeholder="Ticker (e.g. TSLA)"
                  className="input-bg border border-border text-primary mono px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={edgarForm}
                  onChange={(e) => setEdgarForm(e.target.value)}
                  className="input-bg border border-border text-primary mono text-xs px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="10-Q">10-Q</option>
                  <option value="10-K">10-K</option>
                  <option value="8-K">8-K</option>
                </select>
                <button
                  type="submit"
                  data-testid={INGEST.edgarSubmit}
                  disabled={loading === "edgar"}
                  className="mono text-xs uppercase tracking-widest h-10 px-4 border border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
                >
                  {loading === "edgar" ? "Fetching…" : "Fetch"}
                </button>
              </div>
              <div className="mt-2 mono text-[10px] text-muted-foreground">
                Uses public SEC.gov endpoints · may be rate-limited from this container.
              </div>
            </form>
          )}

          {tab === "samples" && (
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-4">
                <Database size={16} className="text-primary" />
                <div>
                  <div className="text-sm text-primary">Bundled sample corpus</div>
                  <div className="label-mono mt-0.5">
                    Apple Inc. · Microsoft Corp. · NVIDIA Corp.
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground max-w-xl mb-4 leading-relaxed">
                Pre-vetted excerpts from recent 10-Q filings and earnings calls, ready
                for a first pass through the pipeline. Idempotent — safe to click again.
              </p>
              <button
                onClick={doSamples}
                data-testid={INGEST.samplesButton}
                disabled={loading === "samples"}
                className="mono text-xs uppercase tracking-widest h-10 px-4 bg-brand text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
              >
                <Database size={14} />
                {loading === "samples" ? "Seeding…" : "Seed sample corpus"}
              </button>
            </div>
          )}
        </div>

        {/* Right: corpus list */}
        <div className="bg-background p-6">
          <div className="label-mono mb-2 flex items-center justify-between">
            <span>Ingested corpus</span>
            <span className="mono !normal-case text-muted-foreground">{filings.length}</span>
          </div>
          <div className="cell max-h-[calc(100vh-180px)] overflow-y-auto">
            <table className="w-full mono text-xs tabular-nums">
              <thead>
                <tr className="text-left sticky top-0 bg-surface">
                  <th className="px-3 py-2 label-mono !text-[10px]">Company</th>
                  <th className="px-3 py-2 label-mono !text-[10px]">Source</th>
                  <th className="px-3 py-2 label-mono !text-[10px] text-right">Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filings.map((f) => (
                  <tr key={f.doc_id}>
                    <td className="px-3 py-2">
                      <div className="text-primary truncate max-w-[160px]">
                        {f.company_name || f.ticker}
                      </div>
                      <div className="mono text-[9px] text-muted-foreground">{f.ticker}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">
                      {f.source}
                    </td>
                    <td className="px-3 py-2 text-right text-primary">{f.num_chunks}</td>
                  </tr>
                ))}
                {filings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-muted-foreground">
                      No filings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
