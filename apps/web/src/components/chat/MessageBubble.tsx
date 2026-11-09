import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BrainCircuit,
  ExternalLink,
  MessageSquareQuote,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import type { Message } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge, CopyButton, StatusDot } from "@/components/common/ui";
import { Emblem } from "@/components/brand/Emblem";
import { Markdown } from "./Markdown";

export function MessageBubble({
  message,
  streaming = false,
  onFeedback,
  onSpeak,
  speaking,
  onRegenerate,
  isLastAssistant,
}: {
  message: Message;
  streaming?: boolean;
  onFeedback?: (rating: -1 | 1) => void;
  onSpeak?: () => void;
  speaking?: boolean;
  onRegenerate?: () => void;
  isLastAssistant?: boolean;
}) {
  const [feedback, setFeedback] = useState<-1 | 1 | null>(null);
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex gap-3 py-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-[0.65rem] font-semibold text-parchment">
          You
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-xl rounded-ss-sm border border-line bg-elevated/45 px-4 py-3">
            <p className="whitespace-pre-wrap text-[0.92rem] leading-relaxed text-parchment/95">{message.content}</p>
          </div>
          {Array.isArray((message.meta as Record<string, unknown>)?.attachments) &&
            ((message.meta as Record<string, unknown>).attachments as string[]).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {((message.meta as Record<string, unknown>).attachments as string[]).map((name) => (
                  <Badge key={name} tone="neutral">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
        </div>
      </div>
    );
  }

  const meta = message.meta ?? {};
  const citations = message.citations ?? [];
  const agents = meta.agents ?? [];
  const isBlocked = Boolean(meta.blocked);
  const demo = Boolean(meta.demo_mode);

  return (
    <div className="flex gap-3 py-5">
      <div className="mt-0.5 shrink-0">
        <div className={cn("rounded-full border border-gold/20 bg-coal p-1", isBlocked && "border-danger/30")}>
          {isBlocked ? <ShieldAlert size={22} className="text-danger" /> : <Emblem size={24} />}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-parchment">ASTA</span>
          {isBlocked ? (
            <Badge tone="danger">Guardian</Badge>
          ) : (
            <Badge tone="gold">Brain</Badge>
          )}
          {meta.intent && <Badge tone="neutral">{String(meta.intent)}</Badge>}
          {demo && (
            <span title="No language model is connected. This is a deterministic scaffold.">
              <Badge tone="warning">Demo composer</Badge>
            </span>
          )}
          {streaming && (
            <span className="flex items-center gap-1.5 text-[0.65rem] text-ash">
              <StatusDot status="running" /> composing
            </span>
          )}
        </div>

        {isBlocked && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Guardian stopped this request before any specialist or model processed it. Risk:{" "}
              {String(meta.risk ?? "critical")}.
            </span>
          </div>
        )}

        {!streaming && agents.length > 0 && (
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <BrainCircuit size={13} className="text-gold/70" aria-hidden />
            {agents.map((agent) => (
              <span
                key={agent.agent_id}
                title={agent.summary}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-white/[0.02] px-2 py-0.5 text-[0.62rem] text-ash"
              >
                <StatusDot status={agent.status === "ok" ? "available" : agent.status} />
                {agent.agent_id}
              </span>
            ))}
            {meta.latency_ms ? (
              <span className="font-mono text-[0.6rem] text-ash/40">{(Number(meta.latency_ms) / 1000).toFixed(1)}s</span>
            ) : null}
          </div>
        )}

        {message.content ? (
          <Markdown content={message.content} />
        ) : streaming ? (
          <div className="flex items-center gap-2 py-1 text-sm text-ash">
            <Sparkles size={14} className="animate-pulse text-gold" /> Gathering the threads…
          </div>
        ) : null}

        {streaming && message.content && (
          <span className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-ember align-middle" aria-hidden />
        )}

        {citations.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.18em] text-ash/70">
              <MessageSquareQuote size={12} /> Sources
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {citations.map((citation, index) => (
                <div key={`${citation.title}-${index}`} className="rounded-lg border border-line bg-panel/50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.75rem] leading-snug text-parchment">{citation.title}</p>
                    {citation.url ? (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="shrink-0 text-gold hover:text-parchment"
                        aria-label={`Open source: ${citation.title}`}
                      >
                        <ExternalLink size={12} />
                      </a>
                    ) : null}
                  </div>
                  {citation.snippet && <p className="mt-1 line-clamp-2 text-[0.68rem] text-ash">{citation.snippet}</p>}
                  <div className="mt-1.5">
                    <Badge tone={citation.verified ? "success" : "warning"} className="!py-0.5 !text-[0.58rem]">
                      {citation.verified ? "Scoped source" : "Not independently verified"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {Boolean(meta.requires_approval) && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/[0.07] px-3 py-2.5 text-xs text-gold">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Approval required — nothing was executed.</p>
              <p className="mt-0.5 text-gold/80">
                Consequential actions need explicit confirmation.{" "}
                <Link to="/tasks" className="underline underline-offset-2">
                  Review the task
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {Boolean(meta.memory_proposal) && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-arcane/30 bg-arcane/[0.08] px-3 py-2 text-xs text-[#b7a4ec]">
            <Wand2 size={14} className="mt-0.5 shrink-0" />
            <span>
              A memory was proposed but not saved: “{String(meta.memory_proposal)}”.{" "}
              <Link to="/memory" className="underline underline-offset-2">
                Review it
              </Link>
            </span>
          </div>
        )}

        {message.tool_runs?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.tool_runs.map((run, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded border border-line bg-white/[0.02] px-2 py-0.5 font-mono text-[0.6rem] text-ash/70"
              >
                <StatusDot status={String(run.status)} />
                {String(run.tool)}
              </span>
            ))}
          </div>
        )}

        {!streaming && (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <CopyButton text={message.content} />
            {onSpeak && (
              <button
                onClick={onSpeak}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.7rem] text-ash transition-colors hover:bg-white/5 hover:text-parchment focus-ring"
                aria-label={speaking ? "Stop speaking" : "Speak this message"}
              >
                {speaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {speaking ? "Stop" : "Listen"}
              </button>
            )}
            {isLastAssistant && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.7rem] text-ash transition-colors hover:bg-white/5 hover:text-parchment focus-ring"
              >
                <Wand2 size={13} /> Regenerate
              </button>
            )}
            {onFeedback && (
              <span className="ms-1 flex items-center gap-0.5">
                <button
                  onClick={() => {
                    onFeedback(1);
                    setFeedback(1);
                  }}
                  className={cn("rounded-md p-1.5 transition-colors hover:bg-white/5 focus-ring", feedback === 1 ? "text-success" : "text-ash")}
                  aria-label="Good response"
                  aria-pressed={feedback === 1}
                >
                  <ThumbsUp size={13} />
                </button>
                <button
                  onClick={() => {
                    onFeedback(-1);
                    setFeedback(-1);
                  }}
                  className={cn("rounded-md p-1.5 transition-colors hover:bg-white/5 focus-ring", feedback === -1 ? "text-danger" : "text-ash")}
                  aria-label="Bad response"
                  aria-pressed={feedback === -1}
                >
                  <ThumbsDown size={13} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
