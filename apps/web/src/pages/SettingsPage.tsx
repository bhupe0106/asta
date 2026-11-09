import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accessibility,
  AlertTriangle,
  Brain,
  Check,
  Clock3,
  Download,
  Globe2,
  Info,
  Languages,
  Mic,
  Monitor,
  Server,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";
import i18n, { applyDocumentLanguage } from "@/i18n";
import { api, type Preferences } from "@/lib/api";
import { cn, downloadJson } from "@/lib/utils";
import { useSpeech } from "@/hooks/useSpeech";
import { Badge, SectionHeader, Skeleton, Spinner, StatusDot, Toggle } from "@/components/common/ui";
import { useUIStore } from "@/stores/ui";

const TEXT_SCALES = [
  { value: "90", label: "90%" },
  { value: "100", label: "100%" },
  { value: "112", label: "112%" },
  { value: "125", label: "125%" },
] as const;

const INTERFACE_LANGUAGES = new Set(["en", "ta", "hi", "es", "ar", "fr"]);

function Panel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="panel p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.02] text-gold">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-sm text-parchment">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ash">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useUIStore((s) => s.toast);
  const speech = useSpeech();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);

  const preferences = useQuery({ queryKey: ["preferences"], queryFn: api.preferences });
  const languages = useQuery({ queryKey: ["languages"], queryFn: api.languages, staleTime: Infinity });
  const models = useQuery({ queryKey: ["models"], queryFn: api.models, refetchInterval: 60_000 });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities, staleTime: 60_000 });

  const update = useMutation({
    mutationFn: (payload: Partial<Preferences>) => api.updatePreferences(payload),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(["preferences"], updated);
      setSavedAt(Date.now());
      if (variables.app_language) {
        void i18n.changeLanguage(variables.app_language);
        applyDocumentLanguage(variables.app_language);
      }
    },
    onError: (err: Error) => toast("Could not save preference", { description: err.message, tone: "error" }),
  });

  function save(payload: Partial<Preferences>) {
    update.mutate(payload);
  }

  const prefs = preferences.data;
  const languageList = languages.data?.languages ?? [];
  const responseLanguages = useMemo(() => languageList, [languageList]);
  const interfaceLanguages = languageList.filter((language) => INTERFACE_LANGUAGES.has(language.code));

  const demoOnly = capabilities.data?.features.model_connected === false;
  const provider = models.data?.providers ?? [];

  async function exportMemory() {
    try {
      const data = await api.exportMemory();
      downloadJson(data, `asta-memory-${new Date().toISOString().slice(0, 10)}.json`);
      toast("Memory exported", { tone: "success" });
    } catch (err) {
      toast("Export failed", { description: (err as Error).message, tone: "error" });
    }
  }

  function testVoice() {
    if (!prefs) return;
    setTesting(true);
    speech.speak("This is how ASTA will read a response aloud.", {
      language: prefs.response_language === "auto" ? "en" : prefs.response_language,
      voiceName: prefs.voice_name,
      rate: prefs.voice_rate,
      pitch: prefs.voice_pitch,
      onEnd: () => setTesting(false),
    });
    window.setTimeout(() => setTesting(false), 6000);
  }

  if (preferences.isLoading || !prefs) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Your grimoire, your rules"
        title="Settings"
        description="Preferences are stored on the server and applied to every signed-in device. Changes save automatically."
        action={
          <span className="flex items-center gap-1.5 text-[0.65rem] text-ash" aria-live="polite">
            {update.isPending ? (
              <>
                <Spinner size={12} /> Saving…
              </>
            ) : savedAt ? (
              <>
                <Check size={12} className="text-success" /> Saved
              </>
            ) : (
              <>
                <Clock3 size={12} /> Auto-save on
              </>
            )}
          </span>
        }
      />

      {demoOnly && (
        <div className="flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/[0.05] px-3 py-2.5 text-xs text-gold">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            No language model is connected. Responses use the labelled demo composer. Start Ollama and set{" "}
            <code className="font-mono">ASTA_OLLAMA_MODEL</code> on the server for genuine reasoning — model names are never
            chosen in the browser.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={<Accessibility size={15} />}
          title="Appearance & accessibility"
          description="Motion, contrast and text size apply immediately across the interface."
        >
          <Toggle
            checked={prefs.reduced_motion}
            onChange={(value) => save({ reduced_motion: value })}
            label="Reduce motion"
            description="Disables rune animations, particle drift and page transitions."
          />
          <div className="rune-divider my-2" />
          <Toggle
            checked={prefs.high_contrast}
            onChange={(value) => save({ high_contrast: value })}
            label="High contrast"
            description="Raises text and border contrast while keeping the grimoire palette."
          />
          <div className="rune-divider my-2" />
          <div className="py-3">
            <p className="text-sm text-parchment">Text size</p>
            <p className="mt-0.5 text-xs text-ash">Scales the entire interface without breaking the layout.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TEXT_SCALES.map((scale) => (
                <button
                  key={scale.value}
                  onClick={() => save({ text_scale: scale.value })}
                  aria-pressed={prefs.text_scale === scale.value}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[0.68rem] transition-colors",
                    prefs.text_scale === scale.value
                      ? "border-gold/40 bg-gold/10 text-gold"
                      : "border-line text-ash hover:text-parchment",
                  )}
                >
                  {scale.label}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          icon={<Languages size={15} />}
          title="Language"
          description="Interface and response language are separate, so you can read in one language and ask in another."
        >
          <label htmlFor="app-language" className="eyebrow">
            Interface language
          </label>
          <select
            id="app-language"
            value={prefs.app_language}
            onChange={(event) => save({ app_language: event.target.value })}
            className="input mt-1.5"
          >
            {interfaceLanguages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
                {language.code === "en" ? " (fully verified)" : " (partial translation)"}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[0.62rem] leading-relaxed text-ash/60">
            Translations are being rolled out. Missing strings fall back to English rather than showing machine noise.
          </p>

          <label htmlFor="response-language" className="eyebrow mt-4 block">
            AI response language
          </label>
          <select
            id="response-language"
            value={prefs.response_language}
            onChange={(event) => save({ response_language: event.target.value })}
            className="input mt-1.5"
          >
            <option value="auto">Match my language</option>
            {responseLanguages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
                {language.rtl ? " · right-to-left" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1.5 flex items-center gap-1.5 text-[0.62rem] text-ash/60">
            <Globe2 size={11} /> Right-to-left layout is applied for Arabic, Hebrew, Farsi and Urdu.
          </p>
        </Panel>

        <Panel
          icon={<Volume2 size={15} />}
          title="Voice"
          description="Speech runs entirely in your browser. Audio is never uploaded or stored on the server."
        >
          <Toggle
            checked={prefs.voice_enabled}
            onChange={(value) => save({ voice_enabled: value })}
            label="Read responses aloud"
            description="Uses your operating system's installed voices. Nothing plays until a response arrives."
          />
          <div className="rune-divider my-2" />
          <div className="py-3">
            <label htmlFor="voice-name" className="text-sm text-parchment">
              Preferred voice
            </label>
            <select
              id="voice-name"
              value={prefs.voice_name}
              onChange={(event) => save({ voice_name: event.target.value })}
              className="input mt-1.5"
              disabled={!speech.synthesisSupported}
            >
              <option value="">Automatic (prefer a male voice)</option>
              {speech.voices.map((voice) => (
                <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                  {voice.name} · {voice.lang}
                </option>
              ))}
            </select>
            {!speech.synthesisSupported && (
              <p className="mt-1.5 text-[0.62rem] text-danger">This browser does not expose speech synthesis.</p>
            )}
            {speech.synthesisSupported && speech.voices.length === 0 && (
              <p className="mt-1.5 text-[0.62rem] text-ash/60">No system voices are available yet.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="voice-rate" className="flex items-center justify-between text-[0.7rem] text-ash">
                Rate <span className="font-mono text-parchment">{prefs.voice_rate.toFixed(2)}×</span>
              </label>
              <input
                id="voice-rate"
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={prefs.voice_rate}
                onChange={(event) => save({ voice_rate: Number(event.target.value) })}
                className="mt-1 w-full accent-[#b52c43]"
              />
            </div>
            <div>
              <label htmlFor="voice-pitch" className="flex items-center justify-between text-[0.7rem] text-ash">
                Pitch <span className="font-mono text-parchment">{prefs.voice_pitch.toFixed(2)}</span>
              </label>
              <input
                id="voice-pitch"
                type="range"
                min={0.6}
                max={1.4}
                step={0.05}
                value={prefs.voice_pitch}
                onChange={(event) => save({ voice_pitch: Number(event.target.value) })}
                className="mt-1 w-full accent-[#b52c43]"
              />
            </div>
          </div>
          <button className="btn-ghost mt-4 !py-1.5 text-xs" onClick={testVoice} disabled={testing || !speech.synthesisSupported}>
            {testing ? <Spinner size={12} /> : <Mic size={12} />} Test voice
          </button>
        </Panel>

        <Panel
          icon={<Brain size={15} />}
          title="Memory & learning"
          description="Memory is opt-in, approval-gated and editable from the Memory page."
        >
          <Toggle
            checked={prefs.memory_enabled}
            onChange={(value) => save({ memory_enabled: value })}
            label="Allow approved memory"
            description="When off, ASTA stops recalling memory entirely. Existing entries remain until deleted."
          />
          <div className="mt-3 rounded-lg border border-line/60 bg-white/[0.015] p-3">
            <p className="flex items-center gap-1.5 text-[0.7rem] text-parchment">
              <ShieldCheck size={12} className="text-gold" /> What is remembered
            </p>
            <p className="mt-1 text-[0.66rem] leading-relaxed text-ash">
              Only entries you create or explicitly approve. Proposed memories wait in a pending state. The Brain never
              silently writes a memory during a turn.
            </p>
          </div>
          <button className="btn-ghost mt-3 !py-1.5 text-xs" onClick={exportMemory}>
            <Download size={12} /> Export memory as JSON
          </button>
        </Panel>

        <Panel
          icon={<Server size={15} />}
          title="Intelligence provider"
          description="Provider status is read from the server. Keys and model names never reach this browser."
        >
          <div className="space-y-2">
            {provider.map((item) => (
              <div key={item.key} className="rounded-lg border border-line/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs text-parchment/90">
                    <StatusDot status={item.healthy ? "available" : "failed"} />
                    {item.display_name}
                  </span>
                  <Badge tone={item.healthy ? "success" : "neutral"} className="!py-0.5 !text-[0.55rem]">
                    {item.healthy ? "ready" : "offline"}
                  </Badge>
                </div>
                <p className="mt-1 text-[0.64rem] leading-relaxed text-ash">{item.detail}</p>
                {item.model && <p className="mt-1 font-mono text-[0.6rem] text-ash/60">model: {item.model}</p>}
              </div>
            ))}
            {provider.length === 0 && <p className="text-xs text-ash">No providers reported.</p>}
          </div>
          <p className="mt-3 text-[0.62rem] leading-relaxed text-ash/60">
            {models.data?.note ?? "Provider configuration is server-side."} Fallback to demo:{" "}
            {models.data?.demo_fallback_enabled ? "enabled and labelled" : "disabled"}.
          </p>
        </Panel>

        <Panel
          icon={<Monitor size={15} />}
          title="Privacy & data"
          description="Your conversations, documents and memory belong to your account only."
        >
          <div className="space-y-2.5 text-[0.7rem] leading-relaxed text-ash">
            <p className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-success" />
              Uploaded files are parsed on this server and never sent to a third-party model provider by default.
            </p>
            <p className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-success" />
              Web research is disabled unless a SearXNG-compatible provider is configured; citations are marked verified
              or unverified.
            </p>
            <p className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-success" />
              Deleting a conversation hides it immediately and detaches it from your sidebar. Per-message retention
              controls and bulk history retention are not enabled in this release.
            </p>
            <p className="flex items-start gap-2">
              <Info size={12} className="mt-0.5 shrink-0 text-gold" />
              Rate limits are enforced per account. This single-instance deployment uses in-memory counters; a Redis-backed
              limiter is the documented upgrade path.
            </p>
          </div>
          <a href="/profile" className="btn-ghost mt-4 !py-1.5 text-xs">
            <ShieldCheck size={12} /> Account & deletion controls
          </a>
        </Panel>
      </div>

      <section className="panel p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
            <Sparkles size={14} className="text-gold" /> About this build
          </h2>
          <Badge tone="gold">v{capabilities.data?.version ?? "0.1.0"}</Badge>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ash">
          ASTA is an AI system. It is not human, not sentient and not a substitute for professional medical, legal or
          financial advice. Outputs can be wrong — verify anything that matters.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(capabilities.data?.limitations ?? []).map((limitation) => (
            <p key={limitation} className="flex items-start gap-2 text-[0.68rem] leading-relaxed text-ash">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger/70" /> {limitation}
            </p>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(capabilities.data?.features ?? {}).map(([key, value]) => (
            <Badge key={key} tone={value === true ? "success" : value === false ? "neutral" : "gold"} className="!text-[0.56rem]">
              {key.replaceAll("_", " ")}: {String(value)}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}
