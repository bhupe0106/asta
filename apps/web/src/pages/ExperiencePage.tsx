import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  GraduationCap,
  ImageOff,
  Info,
  Lock,
  PenLine,
  ShieldCheck,
  Sparkles,
  VideoOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, EXPERIENCES } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { Badge, SectionHeader, StatusDot } from "@/components/common/ui";
import { Emblem } from "@/components/brand/Emblem";
import { ParticleField } from "@/components/grimoire/ParticleField";

const ICONS = {
  learn: GraduationCap,
  work: BriefcaseBusiness,
  create: PenLine,
  companion: Sparkles,
} as const;

const DETAILS: Record<
  string,
  {
    headline: string;
    intro: string;
    capabilities: string[];
    agents: Array<{ id: string; name: string; note: string }>;
    safeguards: string[];
    limitations: string[];
  }
> = {
  learn: {
    headline: "Understanding, not answer-copying",
    intro:
      "Scholar adapts each explanation to your level, checks prerequisites and asks you to reason before revealing the next step. Progress is not sold as a gamified trap — it is simply remembered in your conversations.",
    capabilities: [
      "Step-by-step explanations with worked examples",
      "Adaptive difficulty for child, teen and adult accounts",
      "Practice questions and study plans",
      "Concept clarification across mathematics, science, language and programming",
      "Document study: attach notes, textbooks or worksheets",
    ],
    agents: [
      { id: "scholar", name: "ASTA Scholar", note: "Pedagogy, difficulty and practice" },
      { id: "researcher", name: "ASTA Researcher", note: "Sourced evidence when configured" },
      { id: "memory", name: "ASTA Memory", note: "Only approved learning preferences" },
    ],
    safeguards: [
      "Child accounts require guardian consent and an independent safety review before release.",
      "The tutor guides reasoning instead of producing homework answers.",
      "No manipulative streaks, pressure loops or targeted advertising.",
    ],
    limitations: [
      "Subject depth depends on the connected model. The demo composer gives a study scaffold, not explanations.",
      "Web citations require a configured search provider.",
    ],
  },
  work: {
    headline: "Evidence before conclusions",
    intro:
      "ASTA Work reads documents, profiles spreadsheets, drafts reports and builds dependency-aware plans. Personal and organisational workspaces are separated at the data layer, not by prompt instructions.",
    capabilities: [
      "PDF, DOCX, XLSX, CSV, PPTX and Markdown analysis",
      "Real local descriptive statistics on tabular files",
      "Report, email and presentation drafting",
      "Project planning with inspectable steps and approvals",
      "Knowledge-base retrieval scoped to your account",
    ],
    agents: [
      { id: "analyst", name: "ASTA Analyst", note: "Local statistics and data validation" },
      { id: "researcher", name: "ASTA Researcher", note: "Evidence and source comparison" },
      { id: "planner", name: "ASTA Planner", note: "Dependency-aware task plans" },
      { id: "operator", name: "ASTA Operator", note: "Approval-gated actions only" },
    ],
    safeguards: [
      "Every knowledge read is filtered by owner and workspace.",
      "Consequential actions require explicit approval and an audit record.",
      "No external integration is connected by default; nothing is sent on your behalf.",
    ],
    limitations: [
      "Organisation invitations and shared workspaces are not enabled in this release.",
      "Email/calendar/project integrations need server-side OAuth credentials.",
    ],
  },
  create: {
    headline: "Original work, honest tooling",
    intro:
      "Creator defines audience, tone and structure before drafting. It will not imitate a living artist or reproduce copyrighted characters. Image and video generation appear only when a provider is configured.",
    capabilities: [
      "Writing, storytelling and content planning",
      "Audience and tone analysis",
      "Presentation outlines and marketing structure",
      "Creative critique and editing passes",
      "Code-assisted websites and application scaffolding via ASTA Coder",
    ],
    agents: [
      { id: "creator", name: "ASTA Creator", note: "Brief, draft direction and critique" },
      { id: "coder", name: "ASTA Coder", note: "Web and application scaffolding" },
      { id: "guardian", name: "ASTA Guardian", note: "Rights and content boundaries" },
    ],
    safeguards: [
      "Original phrasing; no copyrighted character names, lyrics or artwork reproduction.",
      "Clear labelling whenever output comes from an external generation provider.",
    ],
    limitations: [
      "Image generation is not configured — no provider is connected.",
      "Video generation is not configured — no provider is connected.",
      "Generated assets are never presented as if a provider produced them unless it did.",
    ],
  },
  companion: {
    headline: "A companion that knows it is AI",
    intro:
      "Companion is the everyday voice of ASTA: conversation, organisation, planning and explanations. It will say it is an AI, and it only remembers what you approve.",
    capabilities: [
      "Everyday conversation and explainers",
      "Task planning and weekly organisation",
      "Voice conversation in your browser",
      "Personal knowledge and approved memory",
      "Goal tracking through conversations and tasks",
    ],
    agents: [
      { id: "brain", name: "ASTA Brain", note: "Conversation and coordination" },
      { id: "voice", name: "ASTA Voice", note: "Browser speech input and output" },
      { id: "memory", name: "ASTA Memory", note: "Inspectable, editable memory" },
    ],
    safeguards: [
      "ASTA never claims to be human or sentient.",
      "Microphone access is requested by your browser only when you press the button.",
      "Raw audio is not stored on the server.",
    ],
    limitations: [
      "Reminders and calendar sync require an external integration.",
      "Voice availability depends on the voices installed on your device.",
    ],
  },
};

export function ExperiencePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const experienceKey = location.pathname.replace("/", "") || "companion";
  const experience = EXPERIENCES.find((item) => item.key === experienceKey) ?? EXPERIENCES[3];
  const detail = DETAILS[experience.key];
  const Icon = ICONS[experience.key as keyof typeof ICONS] ?? Sparkles;
  const [prompt, setPrompt] = useState("");
  const user = useAuthStore((state) => state.user);

  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities });
  const availableAgentIds = new Set((agents.data ?? []).filter((agent) => agent.status === "available").map((a) => a.id));

  function start(text?: string) {
    const value = (text ?? prompt).trim();
    if (value) sessionStorage.setItem("asta.draft", value);
    navigate(`/chat?experience=${experience.key}`);
  }

  const showCreationLimits = experience.key === "create";

  return (
    <div className="space-y-8">
      <section className="panel grimoire-corners relative overflow-hidden px-5 py-9 sm:px-9">
        <ParticleField />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 opacity-[0.06]">
          <Emblem size={340} />
        </div>
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl border"
              style={{ borderColor: `${experience.accent}55`, background: `${experience.accent}14`, color: experience.accent }}
            >
              <Icon size={21} />
            </span>
            <div>
              <p className="eyebrow">One intelligence · {experience.tagline}</p>
              <h1 className="font-display text-2xl text-parchment sm:text-3xl">ASTA {experience.name}</h1>
            </div>
          </div>
          <h2 className="mt-6 font-display text-xl text-balance text-parchment/95 sm:text-2xl">{detail.headline}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ash">{detail.intro}</p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") start();
              }}
              placeholder={`Start with ASTA ${experience.name}…`}
              className="input flex-1 !py-2.5"
              aria-label={`Start a conversation in ASTA ${experience.name}`}
            />
            <button className="btn-primary" onClick={() => start()}>
              Begin <ArrowRight size={15} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {experience.prompts.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => start(suggestion)}
                className="rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-[0.7rem] text-ash hover:border-gold/30 hover:text-parchment"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-4">
          <SectionHeader eyebrow="In this experience" title="What ASTA can genuinely do" />
          <div className="panel divide-y divide-line/60">
            {detail.capabilities.map((capability) => (
              <div key={capability} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10">
                  <Check size={11} className="text-success" />
                </span>
                <p className="text-sm text-parchment/85">{capability}</p>
              </div>
            ))}
          </div>

          <div className="panel p-4">
            <h3 className="flex items-center gap-2 font-display text-sm text-parchment">
              <ShieldCheck size={15} className="text-gold" /> Guardrails that actually run
            </h3>
            <ul className="mt-3 space-y-2">
              {detail.safeguards.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-ash">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gold/60" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-4">
            <h3 className="flex items-center gap-2 font-display text-sm text-parchment">
              <Info size={15} className="text-gold" /> Honest limitations
            </h3>
            <ul className="mt-3 space-y-2">
              {detail.limitations.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-ash">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-danger/60" /> {item}
                </li>
              ))}
            </ul>
            {showCreationLimits && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="danger">
                  <ImageOff size={11} /> Image provider not configured
                </Badge>
                <Badge tone="danger">
                  <VideoOff size={11} /> Video provider not configured
                </Badge>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h3 className="font-display text-sm text-parchment">Specialists involved</h3>
            <p className="mt-1 text-xs text-ash">The Brain chooses based on intent. You can inspect every step.</p>
            <div className="mt-3 space-y-2">
              {detail.agents.map((agent) => (
                <div key={agent.id} className="rounded-lg border border-line/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs text-parchment/90">
                      <StatusDot status={availableAgentIds.has(agent.id) ? "available" : "unavailable"} />
                      {agent.name}
                    </span>
                    <Badge tone={availableAgentIds.has(agent.id) ? "success" : "neutral"} className="!py-0.5 !text-[0.55rem]">
                      {availableAgentIds.has(agent.id) ? "ready" : agent.id === "brain" ? "coordinator" : "unavailable"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[0.66rem] text-ash/70">{agent.note}</p>
                </div>
              ))}
            </div>
            <Link to="/agents" className="mt-3 inline-flex items-center gap-1 text-[0.7rem] text-gold hover:text-parchment">
              Open the agent workspace <ArrowRight size={12} />
            </Link>
          </div>

          <div className="panel p-4">
            <h3 className="flex items-center gap-2 font-display text-sm text-parchment">
              <Lock size={14} className="text-gold" /> Privacy posture
            </h3>
            <ul className="mt-2.5 space-y-2 text-[0.7rem] leading-relaxed text-ash">
              <li>Conversations are attached to {user?.is_guest ? "this guest session" : "your account"}.</li>
              <li>Memory is opt-in, inspectable, editable and deletable.</li>
              <li>Uploaded files are parsed locally by the API and never sent to a third party.</li>
              <li>Provider secrets stay on the server; the browser never sees API keys.</li>
            </ul>
          </div>

          <div className="panel p-4">
            <h3 className="font-display text-sm text-parchment">Currently available</h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {capabilities.data &&
                Object.entries(capabilities.data.features).map(([key, value]) => (
                  <Badge key={key} tone={value === true ? "success" : value === false ? "neutral" : "gold"} className="!text-[0.58rem]">
                    {key.replaceAll("_", " ")}: {String(value)}
                  </Badge>
                ))}
            </div>
          </div>

          <div className="panel border-gold/20 bg-gold/[0.04] p-4">
            <p className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.18em] text-gold/80">
              <BookOpenCheck size={12} /> The magic is real
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ash">
              Everything marked available is backed by a real API call, database record or local computation. Anything
              requiring an external provider is labelled as such.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
