import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleDashed, ShieldCheck, Workflow } from "lucide-react";
import { StatusDot } from "@/components/common/ui";
import { cn } from "@/lib/utils";

export interface LiveAgent {
  agent_id: string;
  name: string;
  state: string;
  summary?: string;
  latency_ms?: number;
}

export interface LivePlanStep {
  position: number;
  title: string;
  description: string;
  agent_id: string;
  status: string;
}

export function AgentActivity({
  agents,
  plan,
  stage,
}: {
  agents: LiveAgent[];
  plan?: LivePlanStep[];
  stage?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!agents.length && !plan?.length) return null;
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-line/80 bg-panel/60">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left focus-ring"
        aria-expanded={open}
      >
        <Workflow size={14} className="text-gold" aria-hidden />
        <span className="text-[0.7rem] uppercase tracking-[0.16em] text-ash">
          {stage ?? "Coordinating specialists"}
        </span>
        <span className="ms-auto flex items-center gap-1.5 overflow-hidden">
          {agents.slice(0, 5).map((agent) => (
            <span
              key={agent.agent_id}
              title={`${agent.name}: ${agent.state}`}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.62rem]",
                agent.state === "ok" || agent.state === "completed"
                  ? "border-success/30 text-success"
                  : agent.state === "failed" || agent.state === "blocked"
                    ? "border-danger/30 text-danger"
                    : "border-line text-ash",
              )}
            >
              <StatusDot status={agent.state === "ok" ? "available" : agent.state} />
              {agent.name.replace("ASTA ", "")}
            </span>
          ))}
          <ChevronDown size={13} className={cn("ms-1 text-ash transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-line/70 px-3 py-2.5">
              {agents.length > 0 && (
                <div className="space-y-1.5">
                  {agents.map((agent) => (
                    <div key={agent.agent_id} className="flex items-start gap-2 text-xs">
                      <StatusDot status={agent.state === "ok" ? "available" : agent.state} className="mt-1.5" />
                      <div className="min-w-0">
                        <span className="text-parchment">{agent.name}</span>{" "}
                        <span className="text-ash/70">— {agent.state}</span>
                        {agent.summary && <p className="text-[0.7rem] leading-relaxed text-ash/70">{agent.summary}</p>}
                      </div>
                      {agent.latency_ms ? (
                        <span className="ms-auto shrink-0 font-mono text-[0.6rem] text-ash/50">{agent.latency_ms}ms</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {plan && plan.length > 0 && (
                <div className="mt-2.5 border-t border-line/50 pt-2">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.18em] text-ash/70">
                    <CircleDashed size={12} /> Inspectable plan
                  </p>
                  <ol className="space-y-1">
                    {plan.map((step) => (
                      <li key={step.position} className="flex items-baseline gap-2 text-[0.72rem] text-ash">
                        <span className="font-mono text-[0.6rem] text-gold/70">{String(step.position + 1).padStart(2, "0")}</span>
                        <span className="text-parchment/80">{step.title}</span>
                        <span className="text-[0.6rem] uppercase tracking-wider text-ash/40">· {step.agent_id}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="mt-2 flex items-center gap-1 text-[0.6rem] text-ash/50">
                <ShieldCheck size={11} /> Guardian reviewed this turn before specialists ran.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
