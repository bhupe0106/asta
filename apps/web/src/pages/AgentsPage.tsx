import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  Boxes,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Play,
  ShieldCheck,
  Timer,
  Wrench,
} from "lucide-react";
import { api, type Agent } from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import { Badge, EmptyState, SectionHeader, Skeleton, Spinner, StatusDot } from "@/components/common/ui";
import { Emblem } from "@/components/brand/Emblem";
import { useUIStore } from "@/stores/ui";

const HUB_AGENTS = [
  "researcher",
  "scholar",
  "coder",
  "analyst",
  "creator",
  "voice",
  "operator",
  "memory",
  "guardian",
  "planner",
  "monitor",
];

export function AgentsPage() {
  const queryClient = useQueryClient();
  const toast = useUIStore((s) => s.toast);
  const [selectedId, setSelectedId] = useState("brain");
  const [testInput, setTestInput] = useState("");
  const [running, setRunning] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents, refetchInterval: 30_000 });
  const executions = useQuery({ queryKey: ["agent-executions"], queryFn: api.agentExecutions, refetchInterval: 20_000 });
  const models = useQuery({ queryKey: ["models"], queryFn: api.models, refetchInterval: 60_000 });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });

  const selected = agents.data?.find((agent) => agent.id === selectedId) ?? agents.data?.[0];
  const healthyProviders = (models.data?.providers ?? []).filter((provider) => provider.healthy);
  const failures = (executions.data ?? []).filter((execution) => execution.status === "failed");

  const assignedSteps = useMemo(() => {
    if (!selected || !tasks.data) return [];
    return tasks.data.flatMap((task) =>
      task.steps.filter((step) => step.agent_id === selected.id).map((step) => ({ ...step, taskTitle: task.title, taskStatus: task.status })),
    );
  }, [selected, tasks.data]);

  async function runTest() {
    if (!selected || !testInput.trim() || selected.id === "brain") return;
    setRunning(true);
    setTestResult(null);
    try {
      const result = await api.executeAgent(selected.id, testInput.trim());
      setTestResult(result);
      queryClient.invalidateQueries({ queryKey: ["agent-executions"] });
      toast(`${selected.name} completed`, {
        description: String(result.summary ?? "Execution recorded."),
        tone: "success",
      });
    } catch (err) {
      toast("Agent execution failed", { description: (err as Error).message, tone: "error" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Twelve specialist roles"
        title="The agent circle"
        description="One Brain coordinates eleven specialists. Every delegation is typed, timeout-bounded, Guardian-reviewed and recorded. Click an agent to inspect its contract."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Registered specialists", value: agents.data?.length ?? 12, icon: Boxes, tone: "text-gold" },
          { label: "Healthy providers", value: healthyProviders.length, icon: Activity, tone: "text-success" },
          { label: "Recent failures", value: failures.length, icon: ShieldCheck, tone: failures.length ? "text-danger" : "text-success" },
        ].map((stat) => (
          <div key={stat.label} className="panel flex items-center gap-3 p-4">
            <stat.icon size={18} className={stat.tone} />
            <div>
              <p className="font-display text-xl text-parchment">{stat.value}</p>
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-ash/60">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        {/* Circle */}
        <div className="panel relative overflow-hidden p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm text-parchment">Delegation map</h2>
            <Badge tone="gold">
              <BrainCircuit size={11} /> Brain at the centre
            </Badge>
          </div>
          <div className="relative mx-auto mt-4 hidden aspect-square w-full max-w-[460px] sm:block">
            <div aria-hidden className="absolute inset-[12%] rounded-full border border-gold/15" />
            <div aria-hidden className="absolute inset-[26%] rounded-full border border-dashed border-line" />
            <div aria-hidden className="absolute left-1/2 top-1/2 h-px w-[76%] -translate-x-1/2 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
            <div aria-hidden className="absolute left-1/2 top-1/2 h-[76%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-gold/20 to-transparent" />

            <button
              onClick={() => setSelectedId("brain")}
              className={cn(
                "absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border bg-coal transition-all",
                selectedId === "brain" ? "border-gold/60 shadow-ember" : "border-gold/25 hover:border-gold/50",
              )}
              aria-label="ASTA Brain, orchestrator"
            >
              <Emblem size={44} glow />
              <span className="mt-0.5 font-display text-[0.65rem] tracking-[0.15em] text-parchment">BRAIN</span>
            </button>

            {HUB_AGENTS.map((agentId, index) => {
              const agent = agents.data?.find((item) => item.id === agentId);
              const angle = (index / HUB_AGENTS.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 42;
              const left = 50 + Math.cos(angle) * radius;
              const top = 50 + Math.sin(angle) * radius;
              return (
                <button
                  key={agentId}
                  onClick={() => setSelectedId(agentId)}
                  className={cn(
                    "group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg border px-2 py-1.5 transition-all",
                    selectedId === agentId
                      ? "border-ember/60 bg-ember/10 text-parchment"
                      : "border-line bg-coal/90 text-ash hover:border-gold/40 hover:text-parchment",
                  )}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  aria-label={`${agent?.name ?? agentId}: ${agent?.status ?? "loading"}`}
                >
                  <StatusDot status={agent?.status ?? "available"} />
                  <span className="whitespace-nowrap text-[0.6rem] capitalize">{agentId}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-1.5 sm:hidden">
            {agents.data?.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedId(agent.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs",
                  selectedId === agent.id ? "border-ember/50 bg-ember/10 text-parchment" : "border-line text-ash",
                )}
              >
                <StatusDot status={agent.status} /> <span className="truncate">{agent.name.replace("ASTA ", "")}</span>
              </button>
            ))}
          </div>

          <p className="mt-4 flex items-start gap-2 text-[0.66rem] leading-relaxed text-ash/60">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-gold/60" />
            Specialists never delegate to each other. Only the Brain dispatches, with a depth limit of 2 and a step budget
            of 8.
          </p>
        </div>

        {/* Inspector */}
        <div className="panel flex flex-col overflow-hidden">
          {agents.isLoading || !selected ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <div className="border-b border-line/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">{selected.role}</p>
                    <h2 className="mt-1 font-display text-lg text-parchment">{selected.name}</h2>
                  </div>
                  <Badge tone={selected.status === "available" ? "success" : selected.status === "degraded" ? "warning" : "danger"}>
                    <StatusDot status={selected.status} /> {selected.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ash">{selected.description}</p>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div>
                  <p className="eyebrow mb-1.5">Responsibilities</p>
                  <ul className="space-y-1">
                    {selected.responsibilities.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-parchment/85">
                        <ChevronRight size={11} className="mt-0.5 shrink-0 text-gold/60" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-line/60 p-3">
                    <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                      <Wrench size={11} /> Tools
                    </p>
                    {selected.allowed_tools.length ? (
                      <div className="flex flex-wrap gap-1">
                        {selected.allowed_tools.map((tool) => (
                          <span key={tool} className="rounded border border-line bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.6rem] text-ash">
                            {tool}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.68rem] text-ash/60">No external tools</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-line/60 p-3">
                    <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck size={11} /> Permissions
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selected.permissions.map((permission) => (
                        <span key={permission} className="rounded border border-line bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.6rem] text-ash">
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="eyebrow mb-1.5">Safety requirements</p>
                  <ul className="space-y-1">
                    {selected.safety_requirements.map((item) => (
                      <li key={item} className="text-[0.72rem] text-ash">
                        · {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-line/60 p-2.5">
                    <p className="text-[0.58rem] uppercase tracking-wider text-ash/50">Model profile</p>
                    <p className="mt-0.5 font-mono text-[0.68rem] text-parchment/85">
                      {String(selected.model_configuration.profile ?? "none")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line/60 p-2.5">
                    <p className="text-[0.58rem] uppercase tracking-wider text-ash/50">Limits</p>
                    <p className="mt-0.5 font-mono text-[0.66rem] text-parchment/85">
                      {Object.entries(selected.limits).map(([key, value]) => `${key}=${value}`).join(" · ") || "default"}
                    </p>
                  </div>
                </div>

                {selected.last_execution && (
                  <div className="flex items-center justify-between rounded-lg border border-line/60 px-3 py-2 text-[0.7rem] text-ash">
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={12} /> Last run {relativeTime(selected.last_execution.started_at)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Timer size={12} /> {selected.last_execution.latency_ms}ms · {selected.last_execution.status}
                    </span>
                  </div>
                )}

                {assignedSteps.length > 0 && (
                  <div>
                    <p className="eyebrow mb-1.5">Assigned task steps</p>
                    <div className="space-y-1">
                      {assignedSteps.slice(0, 4).map((step) => (
                        <div key={step.id} className="flex items-center justify-between gap-2 rounded border border-line/50 px-2 py-1.5">
                          <span className="truncate text-[0.7rem] text-parchment/80">{step.taskTitle}</span>
                          <Badge tone={step.status === "completed" ? "success" : step.status === "failed" ? "danger" : "neutral"} className="!py-0 !text-[0.55rem]">
                            {step.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.id !== "brain" && (
                  <div className="rounded-lg border border-gold/20 bg-gold/[0.03] p-3">
                    <p className="eyebrow mb-2">Run a bounded test</p>
                    <textarea
                      value={testInput}
                      onChange={(event) => setTestInput(event.target.value)}
                      rows={2}
                      placeholder={`Send a request directly to ${selected.name}…`}
                      className="input !text-xs"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[0.6rem] text-ash/50">Guardian runs first. Execution is recorded.</span>
                      <button
                        onClick={runTest}
                        disabled={running || !testInput.trim()}
                        className="btn-ghost !px-2.5 !py-1 text-[0.7rem]"
                      >
                        {running ? <Spinner size={12} /> : <Play size={12} />} Execute
                      </button>
                    </div>
                    {testResult && (
                      <div className="mt-2 rounded border border-line bg-coal/80 p-2 text-[0.68rem] text-ash" aria-live="polite">
                        <p className="text-parchment/85">{String(testResult.summary)}</p>
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-ash/70">{String(testResult.details ?? "")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <section>
        <SectionHeader eyebrow="Observability" title="Execution history" description="Status, latency and summaries only — Monitor never records conversation content." />
        <div className="panel mt-3 overflow-hidden">
          {executions.isLoading && <div className="p-4"><Skeleton className="h-24 w-full" /></div>}
          {!executions.isLoading && (executions.data ?? []).length === 0 && (
            <EmptyState
              icon={<Activity size={20} />}
              title="No executions yet"
              description="Send a message or run a specialist test and the record will appear here."
            />
          )}
          <div className="divide-y divide-line/60">
            {(executions.data ?? []).map((execution) => (
              <div key={execution.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <StatusDot status={execution.status} />
                <span className="min-w-[110px] text-xs text-parchment/90">{execution.agent_id}</span>
                <span className="min-w-0 flex-1 truncate text-[0.7rem] text-ash">{execution.summary || "—"}</span>
                <span className="font-mono text-[0.6rem] text-ash/50">{execution.latency_ms}ms</span>
                <span className="text-[0.6rem] text-ash/40">{relativeTime(execution.started_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
