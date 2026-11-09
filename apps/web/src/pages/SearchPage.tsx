import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpenText,
  Bot,
  BrainCircuit,
  FileText,
  LibraryBig,
  ListChecks,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, experienceLabel, relativeTime } from "@/lib/utils";
import { experienceNav, footerNav, primaryNav } from "@/lib/nav";
import { Badge, SectionHeader, Skeleton } from "@/components/common/ui";

export function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const active = deferred.length >= 2;

  const conversations = useQuery({ queryKey: ["conversations"], queryFn: () => api.conversations(), staleTime: 20_000 });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks, staleTime: 20_000 });
  const memory = useQuery({ queryKey: ["memory"], queryFn: api.memories, staleTime: 20_000 });
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents, staleTime: 60_000 });
  const knowledge = useQuery({
    queryKey: ["search-knowledge", deferred],
    queryFn: () => api.searchKnowledge(deferred, 6),
    enabled: active,
    staleTime: 30_000,
  });

  const lower = deferred.toLowerCase();

  const conversationHits = useMemo(
    () =>
      active
        ? (conversations.data ?? []).filter(
            (conversation) =>
              conversation.title.toLowerCase().includes(lower) ||
              conversation.experience.toLowerCase().includes(lower),
          )
        : (conversations.data ?? []).slice(0, 6),
    [active, conversations.data, lower],
  );

  const taskHits = active
    ? (tasks.data ?? []).filter(
        (task) => task.title.toLowerCase().includes(lower) || task.goal.toLowerCase().includes(lower),
      )
    : [];
  const memoryHits = active
    ? (memory.data ?? []).filter((item) => item.content.toLowerCase().includes(lower))
    : [];
  const agentHits = active
    ? (agents.data ?? []).filter((agent) =>
        `${agent.name} ${agent.role} ${agent.description}`.toLowerCase().includes(lower),
      )
    : [];

  const pages = [...primaryNav, ...experienceNav, ...footerNav].filter((item) =>
    active ? t(item.key).toLowerCase().includes(lower) : false,
  );

  const total =
    conversationHits.length +
    taskHits.length +
    memoryHits.length +
    agentHits.length +
    (knowledge.data?.length ?? 0) +
    pages.length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="One index across the grimoire"
        title="Search"
        description="Find conversations, tasks, memories, agents, documents and pages. Conversation matching uses titles; full message-body search is not enabled in this release."
      />

      <div className="panel grimoire-corners p-4 sm:p-5">
        <label htmlFor="global-search" className="sr-only">
          Search everything
        </label>
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gold/70" />
          <input
            id="global-search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, goals, memories, agents, documents…"
            className="input !py-3 ps-11 pe-24 text-base"
          />
          <span className="absolute end-3 top-1/2 hidden -translate-y-1/2 text-[0.62rem] text-ash/50 sm:block">
            {active ? `${total} result${total === 1 ? "" : "s"}` : "type 2+ characters"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {["calculus", "weekly plan", "brand story", "battery", "preference"].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setQuery(suggestion)}
              className="rounded-full border border-line bg-white/[0.02] px-2.5 py-1 text-[0.66rem] text-ash transition-colors hover:border-gold/30 hover:text-parchment"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {!active && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm text-parchment">Recent conversations</h2>
            <Link to="/chat" className="btn-ghost !py-1.5 text-xs">
              <Sparkles size={12} /> New conversation
            </Link>
          </div>
          <div className="panel mt-2 divide-y divide-line/60 overflow-hidden">
            {conversations.isLoading &&
              [1, 2, 3].map((key) => (
                <div key={key} className="p-3">
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            {conversationHits.map((conversation) => (
              <Link
                key={conversation.id}
                to={`/chat/${conversation.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025]"
              >
                <MessageSquare size={15} className="text-ash/50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-parchment/90">{conversation.title}</p>
                  <p className="mt-0.5 text-[0.62rem] uppercase tracking-wider text-ash/50">
                    {experienceLabel(conversation.experience)} · {relativeTime(conversation.updated_at)}
                  </p>
                </div>
                <ArrowRight size={14} className="text-ash/30" />
              </Link>
            ))}
            {!conversations.isLoading && conversationHits.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-ash">No conversations yet. Begin one from the dashboard.</p>
            )}
          </div>
        </section>
      )}

      {active && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ResultGroup
            icon={<MessageSquare size={14} />}
            title="Conversations"
            count={conversationHits.length}
            empty="No conversation titles match."
          >
            {conversationHits.map((conversation) => (
              <Link
                key={conversation.id}
                to={`/chat/${conversation.id}`}
                className="block rounded-lg border border-line/60 px-3 py-2.5 transition-colors hover:border-gold/25 hover:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-parchment/90">{conversation.title}</p>
                  <Badge tone="neutral" className="!py-0 !text-[0.52rem]">
                    {conversation.experience}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[0.6rem] text-ash/50">{relativeTime(conversation.updated_at)}</p>
              </Link>
            ))}
          </ResultGroup>

          <ResultGroup
            icon={<LibraryBig size={14} />}
            title="Knowledge chunks"
            count={knowledge.data?.length ?? 0}
            empty={knowledge.isFetching ? "Searching documents…" : "No document chunks match."}
          >
            {(knowledge.data ?? []).map((hit, index) => (
              <Link
                key={`${hit.document_id}-${index}`}
                to="/knowledge"
                className="block rounded-lg border border-line/60 px-3 py-2.5 transition-colors hover:border-gold/25 hover:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium text-parchment/90">{hit.document_title}</p>
                  <Badge tone="gold" className="!py-0 !text-[0.52rem]">
                    {hit.score.toFixed(2)}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.66rem] leading-relaxed text-ash">{hit.chunk}</p>
              </Link>
            ))}
          </ResultGroup>

          <ResultGroup
            icon={<ListChecks size={14} />}
            title="Tasks"
            count={taskHits.length}
            empty="No task titles or goals match."
          >
            {taskHits.map((task) => (
              <Link
                key={task.id}
                to="/tasks"
                className="flex items-center justify-between gap-2 rounded-lg border border-line/60 px-3 py-2.5 transition-colors hover:border-gold/25"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-parchment/90">{task.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-[0.62rem] text-ash">{task.goal}</p>
                </div>
                <Badge tone={task.status === "completed" ? "success" : task.status === "failed" ? "danger" : "neutral"} className="!py-0 !text-[0.52rem]">
                  {task.status}
                </Badge>
              </Link>
            ))}
          </ResultGroup>

          <ResultGroup
            icon={<Bot size={14} />}
            title="Memory"
            count={memoryHits.length}
            empty="No approved or pending memory matches."
          >
            {memoryHits.map((item) => (
              <Link
                key={item.id}
                to="/memory"
                className="block rounded-lg border border-line/60 px-3 py-2.5 transition-colors hover:border-gold/25"
              >
                <p className="line-clamp-2 text-xs text-parchment/85">{item.content}</p>
                <p className="mt-1 text-[0.6rem] text-ash/50">
                  {item.kind} · {item.approved ? "approved" : "pending"}
                </p>
              </Link>
            ))}
          </ResultGroup>

          <ResultGroup
            icon={<BrainCircuit size={14} />}
            title="Agents"
            count={agentHits.length}
            empty="No agent contracts match."
          >
            {agentHits.map((agent) => (
              <Link
                key={agent.id}
                to="/agents"
                className="flex items-center justify-between gap-2 rounded-lg border border-line/60 px-3 py-2.5 transition-colors hover:border-gold/25"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-parchment/90">{agent.name}</p>
                  <p className="mt-0.5 truncate text-[0.62rem] text-ash">{agent.description}</p>
                </div>
                <Badge tone="neutral" className="!py-0 !text-[0.52rem]">
                  {agent.role}
                </Badge>
              </Link>
            ))}
          </ResultGroup>

          <ResultGroup
            icon={<BookOpenText size={14} />}
            title="Pages"
            count={pages.length}
            empty="No page titles match."
          >
            {pages.map((item) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-line/60 px-3 py-2.5 text-left transition-colors hover:border-gold/25"
              >
                <span className="flex items-center gap-2 text-xs text-parchment/90">
                  <item.icon size={13} className="text-ash/60" /> {t(item.key)}
                </span>
                <ArrowRight size={12} className="text-ash/40" />
              </button>
            ))}
          </ResultGroup>
        </div>
      )}

      {active && total === 0 && (
        <div className="panel flex flex-col items-center px-6 py-12 text-center">
          <Search size={24} className="text-ash/50" />
          <h2 className="mt-4 font-display text-base text-parchment">Nothing in the grimoire matches “{deferred}”</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ash">
            Try a shorter phrase, or upload a document that covers the topic. Search does not send your query to an
            external provider.
          </p>
          <Link to="/knowledge" className="btn-ghost mt-4 !py-1.5 text-xs">
            <FileText size={12} /> Open knowledge
          </Link>
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  icon,
  title,
  count,
  empty,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
          <span className="text-gold">{icon}</span> {title}
        </h2>
        <span className={cn("rounded-full border border-line px-2 py-0.5 font-mono text-[0.58rem]", count ? "text-ash" : "text-ash/40")}>
          {count}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {hasChildren ? children : <p className="px-1 py-3 text-center text-[0.7rem] text-ash/60">{empty}</p>}
      </div>
    </section>
  );
}
