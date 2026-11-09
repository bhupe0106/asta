import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowUp,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  GraduationCap,
  ListChecks,
  MessageSquare,
  PenLine,
  Server,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, EXPERIENCES, greeting, relativeTime } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { Badge, EmptyState, SectionHeader, Skeleton, StatusDot } from "@/components/common/ui";
import { Emblem } from "@/components/brand/Emblem";
import { ParticleField } from "@/components/grimoire/ParticleField";

const EXPERIENCE_ICONS = {
  learn: GraduationCap,
  work: BriefcaseBusiness,
  create: PenLine,
  companion: Sparkles,
} as const;

const PROMPTS = [
  "Explain how transformers work, in plain language",
  "Build a 7-day study plan for calculus",
  "Summarise a document I attach",
  "Draft a product launch email",
];

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [prompt, setPrompt] = useState("");

  const conversations = useQuery({ queryKey: ["conversations"], queryFn: () => api.conversations() });
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const models = useQuery({ queryKey: ["models"], queryFn: api.models, refetchInterval: 60_000 });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities });

  const firstName = user?.display_name?.split(" ")[0] ?? "traveler";
  const ollama = models.data?.providers.find((provider) => provider.key === "ollama");
  const demo = models.data?.providers.find((provider) => provider.key === "demo");
  const demoOnly = capabilities.data?.features.model_connected === false;

  const activeTasks = (tasks.data ?? []).filter((task) =>
    ["planned", "running", "waiting_approval"].includes(task.status),
  );
  const availableAgents = (agents.data ?? []).filter((agent) => agent.status === "available");

  function begin(experience = "companion", text?: string) {
    const value = (text ?? prompt).trim();
    if (value) sessionStorage.setItem("asta.draft", value);
    navigate(`/chat?experience=${experience}`);
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="panel grimoire-corners relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
        <ParticleField />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 opacity-[0.07] sm:opacity-[0.09]"
        >
          <Emblem size={380} />
        </div>
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">
              <Sparkles size={11} /> Intelligence grimoire
            </Badge>
            <Badge tone="neutral">Free plan</Badge>
            {demoOnly && (
              <Badge tone="warning">
                <TriangleAlert size={11} /> Demo composer
              </Badge>
            )}
          </div>
          <h1 className="mt-5 font-display text-3xl leading-tight text-balance text-parchment sm:text-4xl">
            {greeting()}, {firstName}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ash">
            {t("dashboard.tagline")} Ask for understanding, a plan, an analysis or a finished piece of work — the
            Brain will choose the right specialists and show you what it did.
          </p>

          <form
            className="mt-7"
            onSubmit={(event) => {
              event.preventDefault();
              begin();
            }}
          >
            <div className="rounded-xl border border-line bg-coal/80 p-2 shadow-grimoire transition-colors focus-within:border-gold/35">
              <label htmlFor="dashboard-prompt" className="sr-only">
                Ask ASTA
              </label>
              <textarea
                id="dashboard-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    begin();
                  }
                }}
                rows={2}
                placeholder={t("dashboard.composerPlaceholder")}
                className="w-full resize-none bg-transparent px-3 py-2 text-[0.95rem] leading-relaxed text-parchment placeholder:text-ash/55 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <span className="text-[0.62rem] text-ash/50">
                  Nothing is sent until you begin · Files can be attached inside the conversation
                </span>
                <button type="submit" className="btn-primary !rounded-full !p-2.5" aria-label="Begin conversation">
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PROMPTS.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => begin("companion", suggestion)}
                className="rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-[0.7rem] text-ash transition-colors hover:border-gold/30 hover:text-parchment"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Experiences */}
      <section>
        <SectionHeader
          eyebrow="Four experiences"
          title={t("dashboard.quickAccess")}
          description="One shared intelligence, coordinated by the Brain. Each experience tunes the context, not the identity."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXPERIENCES.map((experience) => {
            const Icon = EXPERIENCE_ICONS[experience.key];
            return (
              <Link
                key={experience.key}
                to={`/${experience.key}`}
                className="panel-interactive group relative flex flex-col overflow-hidden p-4"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px opacity-60"
                  style={{ background: `linear-gradient(90deg, transparent, ${experience.accent}, transparent)` }}
                />
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: `${experience.accent}44`,
                      background: `${experience.accent}12`,
                      color: experience.accent,
                    }}
                  >
                    <Icon size={18} />
                  </span>
                  <ArrowRight size={15} className="text-ash/40 transition-transform group-hover:translate-x-0.5 group-hover:text-parchment" />
                </div>
                <h3 className="mt-3 font-display text-base text-parchment">ASTA {experience.name}</h3>
                <p className="mt-1 text-[0.72rem] uppercase tracking-[0.14em] text-ash/60">{experience.tagline}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ash">{experience.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Status grid */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
              <BrainCircuit size={15} className="text-gold" /> {t("dashboard.agents")}
            </h2>
            <Link to="/agents" className="text-[0.65rem] text-ash hover:text-parchment">
              {t("dashboard.viewAll")}
            </Link>
          </div>
          <p className="mt-1 text-xs text-ash">
            {agents.isLoading ? "Reading the registry…" : `${availableAgents.length} of ${agents.data?.length ?? 12} specialists available`}
          </p>
          <div className="mt-3 space-y-1.5">
            {agents.isLoading && [1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-6 w-full" />)}
            {(agents.data ?? []).slice(0, 5).map((agent) => (
              <div key={agent.id} className="flex items-center justify-between gap-2 rounded-md border border-line/60 px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-2 text-xs text-parchment/90">
                  <StatusDot status={agent.status} />
                  <span className="truncate">{agent.name.replace("ASTA ", "")}</span>
                </span>
                <span className="text-[0.6rem] uppercase tracking-wider text-ash/50">{agent.role}</span>
              </div>
            ))}
            {!agents.isLoading && (
              <Link to="/agents" className="mt-1 flex items-center justify-center gap-1 rounded-md border border-dashed border-line py-1.5 text-[0.65rem] text-ash hover:border-gold/30 hover:text-parchment">
                + {(agents.data?.length ?? 12) - 5} more specialists
              </Link>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
              <ListChecks size={15} className="text-gold" /> {t("dashboard.tasks")}
            </h2>
            <Link to="/tasks" className="text-[0.65rem] text-ash hover:text-parchment">
              {t("dashboard.viewAll")}
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Active", value: activeTasks.length, icon: Clock3 },
              { label: "Awaiting", value: (tasks.data ?? []).filter((task) => task.status === "waiting_approval").length, icon: TriangleAlert },
              { label: "Done", value: (tasks.data ?? []).filter((task) => task.status === "completed").length, icon: CheckCircle2 },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-line/60 bg-white/[0.015] px-2 py-2.5">
                <stat.icon size={13} className="mx-auto mb-1 text-ash/60" />
                <p className="font-display text-lg text-parchment">{stat.value}</p>
                <p className="text-[0.58rem] uppercase tracking-wider text-ash/60">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {activeTasks.slice(0, 3).map((task) => (
              <Link key={task.id} to="/tasks" className="block rounded-md border border-line/60 px-2.5 py-1.5 hover:border-gold/25">
                <p className="truncate text-xs text-parchment/90">{task.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[0.6rem] text-ash/60">
                  <StatusDot status={task.status} /> {task.status.replace("_", " ")}
                </p>
              </Link>
            ))}
            {!tasks.isLoading && activeTasks.length === 0 && (
              <p className="py-3 text-center text-[0.68rem] text-ash/60">
                No active tasks. Ask ASTA to plan something complex.
              </p>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
              <Server size={15} className="text-gold" /> {t("dashboard.model")}
            </h2>
            <Link to="/settings" className="text-[0.65rem] text-ash hover:text-parchment">
              Configure
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {(models.data?.providers ?? []).map((provider) => (
              <div key={provider.key} className="rounded-lg border border-line/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs text-parchment/90">
                    <StatusDot status={provider.healthy ? "available" : "failed"} />
                    {provider.display_name}
                  </span>
                  <Badge tone={provider.healthy ? "success" : "danger"} className="!py-0.5 !text-[0.56rem]">
                    {provider.healthy ? "online" : "offline"}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.62rem] leading-relaxed text-ash/70">{provider.detail}</p>
              </div>
            ))}
            {models.isLoading && <Skeleton className="h-16 w-full" />}
          </div>
          <p className="mt-3 text-[0.62rem] leading-relaxed text-ash/60">
            Local-first. Start Ollama and pull a model for full reasoning. Demo responses are always labelled.
          </p>
        </div>
      </section>

      {/* Recent conversations */}
      <section>
        <SectionHeader
          eyebrow="Library"
          title={t("dashboard.recent")}
          description="Your grimoire keeps every conversation attached to your account."
          action={
            <Link to="/search" className="btn-ghost !py-1.5 text-xs">
              Search all
            </Link>
          }
        />
        <div className="panel mt-4 divide-y divide-line/60 overflow-hidden">
          {conversations.isLoading && (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-10 w-full" />
              ))}
            </div>
          )}
          {(conversations.data ?? []).slice(0, 6).map((conversation) => (
            <Link
              key={conversation.id}
              to={`/chat/${conversation.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025]"
            >
              <MessageSquare size={15} className="text-ash/50" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-parchment/90">{conversation.title}</p>
                <p className="mt-0.5 text-[0.62rem] uppercase tracking-wider text-ash/50">
                  {conversation.experience} · {relativeTime(conversation.updated_at)}
                </p>
              </div>
              <ArrowRight size={14} className="text-ash/30" />
            </Link>
          ))}
          {!conversations.isLoading && (conversations.data ?? []).length === 0 && (
            <EmptyState
              icon={<MessageSquare size={20} />}
              title="The first page is blank"
              description="Begin a conversation and ASTA will remember it here."
              action={
                <button className="btn-primary" onClick={() => begin()}>
                  <Sparkles size={15} /> Begin
                </button>
              }
            />
          )}
        </div>
      </section>

      {demoOnly && (
        <p className={cn("flex items-center justify-center gap-2 text-center text-[0.65rem] text-ash/50")}>
          <TriangleAlert size={12} className="text-gold/60" />
          Demo composer active — connect Ollama for genuine model reasoning. No generated fact is invented in demo mode.
        </p>
      )}
    </div>
  );
}
