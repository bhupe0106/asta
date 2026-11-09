import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  FileClock,
  ListChecks,
  Play,
  Plus,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { api, type Task } from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import { Badge, EmptyState, Modal, SectionHeader, Skeleton, Spinner, StatusDot, Toggle } from "@/components/common/ui";
import { useUIStore } from "@/stores/ui";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "waiting_approval", label: "Awaiting approval" },
  { key: "completed", label: "Completed" },
];

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function TasksPage() {
  const queryClient = useQueryClient();
  const toast = useUIStore((s) => s.toast);
  const [goal, setGoal] = useState("");
  const [title, setTitle] = useState("");
  const [autoRun, setAutoRun] = useState(false);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<Task | null>(null);

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks, refetchInterval: 20_000 });
  const logs = useQuery({
    queryKey: ["task-logs", logsFor?.id],
    queryFn: () => api.taskLogs(logsFor!.id),
    enabled: Boolean(logsFor),
  });

  const createTask = useMutation({
    mutationFn: () => api.createTask(goal.trim(), title.trim() || undefined, autoRun),
    onSuccess: (task) => {
      setGoal("");
      setTitle("");
      setAutoRun(false);
      setExpanded(task.id);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast("Task planned", {
        description: task.requires_approval
          ? "This task needs your approval before execution."
          : `${task.steps.length} inspectable steps created.`,
        tone: "success",
      });
    },
    onError: (err: Error) => toast("Could not create task", { description: err.message, tone: "error" }),
  });

  function action(task: Task, kind: "execute" | "approve" | "cancel") {
    const call = kind === "execute" ? api.executeTask : kind === "approve" ? api.approveTask : api.cancelTask;
    return call(task.id)
      .then((updated) => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["agent-executions"] });
        setExpanded(updated.id);
        toast(`Task ${kind === "approve" ? "approved" : updated.status}`, { tone: "success" });
      })
      .catch((err: Error) => toast("Task action failed", { description: err.message, tone: "error" }));
  }

  const filtered = (tasks.data ?? []).filter((task) => {
    if (filter === "all") return true;
    if (filter === "active") return ["planned", "running", "draft"].includes(task.status);
    return task.status === filter;
  });

  const counts = {
    total: tasks.data?.length ?? 0,
    active: (tasks.data ?? []).filter((task) => ["planned", "running"].includes(task.status)).length,
    approval: (tasks.data ?? []).filter((task) => task.status === "waiting_approval").length,
    completed: (tasks.data ?? []).filter((task) => task.status === "completed").length,
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Execution engine"
        title="Task ledger"
        description="Complex goals become inspectable, dependency-aware steps. High-impact actions wait for your explicit approval."
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_repeat(3,0.6fr)]">
        <form
          className="panel p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (goal.trim().length >= 3) createTask.mutate();
          }}
        >
          <label htmlFor="task-goal" className="eyebrow">
            New task
          </label>
          <textarea
            id="task-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={2}
            placeholder="Describe a goal ASTA should plan, e.g. prepare a research brief on battery recycling"
            className="input mt-2 resize-none !text-sm"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional title"
              className="input !py-1.5 text-xs"
              aria-label="Optional task title"
            />
            <button type="submit" className="btn-primary shrink-0 !py-1.5 text-xs" disabled={createTask.isPending || goal.trim().length < 3}>
              {createTask.isPending ? <Spinner size={13} /> : <Plus size={13} />} Plan
            </button>
          </div>
          <div className="mt-2">
            <Toggle
              checked={autoRun}
              onChange={setAutoRun}
              label="Plan and run immediately"
              description="Low-risk plans execute at once. Action tasks always wait for approval."
              disabled={createTask.isPending}
            />
          </div>
        </form>

        {[
          { label: "Total", value: counts.total, tone: "text-parchment" },
          { label: "Active", value: counts.active, tone: "text-gold" },
          { label: "Awaiting", value: counts.approval, tone: "text-danger" },
        ].map((stat) => (
          <div key={stat.label} className="panel flex flex-col justify-center p-4">
            <p className={cn("font-display text-2xl", stat.tone)}>{stat.value}</p>
            <p className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-ash/60">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[0.7rem] transition-colors",
              filter === item.key ? "border-gold/40 bg-gold/10 text-gold" : "border-line text-ash hover:text-parchment",
            )}
            aria-pressed={filter === item.key}
          >
            {item.label}
            {item.key === "waiting_approval" && counts.approval > 0 && (
              <span className="ms-1.5 rounded-full bg-danger/20 px-1.5 text-[0.6rem] text-danger">{counts.approval}</span>
            )}
          </button>
        ))}
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })} className="ms-auto btn-quiet !py-1 text-[0.65rem]">
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {tasks.isLoading && [1, 2, 3].map((key) => <Skeleton key={key} className="h-24 w-full" />)}
        {!tasks.isLoading && filtered.length === 0 && (
          <div className="panel">
            <EmptyState
              icon={<ListChecks size={20} />}
              title={filter === "all" ? "The ledger is empty" : "Nothing in this state"}
              description={
                filter === "all"
                  ? "Create a plan above, or ask the Brain for a complex goal in chat. Research, learning and planning turns create plans automatically."
                  : "Choose another filter to see the rest of your task ledger."
              }
            />
          </div>
        )}
        {filtered.map((task) => {
          const open = expanded === task.id;
          const completedSteps = task.steps.filter((step) => step.status === "completed").length;
          return (
            <div key={task.id} className="panel overflow-hidden">
              <button
                onClick={() => setExpanded(open ? null : task.id)}
                className="flex w-full items-start gap-3 p-4 text-left focus-ring"
                aria-expanded={open}
              >
                <span className="mt-0.5">
                  {task.status === "completed" ? (
                    <CheckCircle2 size={17} className="text-success" />
                  ) : task.status === "failed" ? (
                    <XCircle size={17} className="text-danger" />
                  ) : task.status === "waiting_approval" ? (
                    <ShieldAlert size={17} className="text-gold" />
                  ) : task.status === "running" ? (
                    <CircleDot size={17} className="animate-pulse text-gold" />
                  ) : (
                    <Clock3 size={17} className="text-ash" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-sm text-parchment">{task.title}</h3>
                    <Badge
                      tone={
                        task.status === "completed"
                          ? "success"
                          : task.status === "failed"
                            ? "danger"
                            : task.status === "waiting_approval"
                              ? "warning"
                              : "neutral"
                      }
                      className="!py-0.5 !text-[0.58rem]"
                    >
                      <StatusDot status={task.status} /> {task.status.replace("_", " ")}
                    </Badge>
                    {task.risk !== "low" && <Badge tone="warning" className="!py-0.5 !text-[0.58rem]">risk: {task.risk}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-ash">{task.goal}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.62rem] text-ash/50">
                    <span>
                      {completedSteps}/{task.steps.length} steps
                    </span>
                    <span>·</span>
                    <span>{relativeTime(task.updated_at)}</span>
                    <span>·</span>
                    <span className="font-mono">{task.steps.map((step) => step.agent_id).filter((v, i, a) => a.indexOf(v) === i).join(" → ")}</span>
                  </div>
                </div>
                <ChevronDown size={15} className={cn("mt-1 shrink-0 text-ash transition-transform", open && "rotate-180")} />
              </button>

              {open && (
                <div className="border-t border-line/70 bg-coal/30 p-4">
                  {task.requires_approval && task.status === "waiting_approval" && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/[0.06] p-3">
                      <div className="flex items-start gap-2 text-xs text-gold">
                        <ShieldAlert size={15} className="mt-0.5" />
                        <div>
                          <p className="font-medium">This task changes something consequential.</p>
                          <p className="mt-0.5 text-gold/70">Approve only if the plan matches your intent. No external action has run.</p>
                        </div>
                      </div>
                      <button className="btn-primary !py-1.5 text-xs" onClick={() => action(task, "approve")}>
                        <CheckCircle2 size={13} /> Approve plan
                      </button>
                    </div>
                  )}

                  {!TERMINAL.has(task.status) && task.status !== "waiting_approval" && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button className="btn-primary !py-1.5 text-xs" onClick={() => action(task, "execute")} disabled={task.status === "running"}>
                        <Play size={13} /> Execute plan
                      </button>
                      <button className="btn-ghost !py-1.5 text-xs" onClick={() => action(task, "cancel")}>
                        <Ban size={13} /> Cancel
                      </button>
                    </div>
                  )}

                  <ol className="relative ms-2 space-y-3 border-s border-line/70 ps-4">
                    {task.steps.map((step) => (
                      <li key={step.id} className="relative">
                        <span className="absolute -left-[1.32rem] top-1.5">
                          <StatusDot status={step.status} />
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[0.6rem] text-gold/60">{String(step.position + 1).padStart(2, "0")}</span>
                          <span className="text-xs text-parchment/90">{step.title}</span>
                          <Badge tone="neutral" className="!py-0 !text-[0.55rem]">{step.agent_id}</Badge>
                          <Badge
                            tone={step.status === "completed" ? "success" : step.status === "failed" ? "danger" : "neutral"}
                            className="!py-0 !text-[0.55rem]"
                          >
                            {step.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[0.68rem] text-ash/70">{step.description}</p>
                        {step.output && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[0.62rem] text-gold/70 hover:text-gold">View output</summary>
                            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-line bg-coal p-2 font-mono text-[0.62rem] text-ash">
                              {step.output}
                            </pre>
                          </details>
                        )}
                        {step.error && <p className="mt-1 text-[0.65rem] text-danger">{step.error}</p>}
                      </li>
                    ))}
                  </ol>

                  <div className="mt-3 flex items-center justify-between">
                    <button onClick={() => setLogsFor(task)} className="inline-flex items-center gap-1.5 text-[0.65rem] text-ash hover:text-parchment">
                      <FileClock size={12} /> Execution log
                    </button>
                    {task.result && "completed" in task.result && (
                      <span className="flex items-center gap-1 text-[0.62rem] text-success">
                        <Sparkles size={11} /> Result recorded
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={Boolean(logsFor)} onClose={() => setLogsFor(null)} title={`Execution log · ${logsFor?.title ?? ""}`} wide>
        {logs.isLoading && <Spinner />}
        <div className="max-h-[55vh] space-y-1 overflow-y-auto">
          {(logs.data ?? []).map((log) => (
            <div key={log.id} className="flex gap-3 rounded border border-line/50 px-2.5 py-1.5 text-[0.7rem]">
              <span className="shrink-0 font-mono text-ash/40">{new Date(log.created_at + "Z").toLocaleTimeString()}</span>
              <span className={cn("min-w-0 flex-1", log.level === "error" ? "text-danger" : "text-ash")}>{log.message}</span>
            </div>
          ))}
          {!logs.isLoading && (logs.data ?? []).length === 0 && <p className="text-sm text-ash">No log entries yet.</p>}
        </div>
      </Modal>
    </div>
  );
}
