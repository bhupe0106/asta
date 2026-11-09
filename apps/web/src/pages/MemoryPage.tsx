import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Check,
  Download,
  Info,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api, type MemoryItem } from "@/lib/api";
import { cn, downloadJson, relativeTime } from "@/lib/utils";
import { Badge, EmptyState, Modal, SectionHeader, Skeleton, Spinner, Toggle } from "@/components/common/ui";
import { useUIStore } from "@/stores/ui";

const KINDS = [
  { key: "fact", label: "Fact" },
  { key: "preference", label: "Preference" },
  { key: "goal", label: "Goal" },
  { key: "context", label: "Context" },
] as const;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Awaiting approval" },
] as const;

export function MemoryPage() {
  const queryClient = useQueryClient();
  const toast = useUIStore((s) => s.toast);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("preference");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [editing, setEditing] = useState<MemoryItem | null>(null);
  const [draft, setDraft] = useState("");
  const [draftKind, setDraftKind] = useState("fact");
  const [pendingDelete, setPendingDelete] = useState<MemoryItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const memory = useQuery({ queryKey: ["memory"], queryFn: api.memories });
  const preferences = useQuery({ queryKey: ["preferences"], queryFn: api.preferences });
  const items = memory.data ?? [];
  const memoryEnabled = preferences.data?.memory_enabled ?? true;

  const createMemory = useMutation({
    mutationFn: () => api.createMemory(content.trim(), kind),
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      toast("Memory added", { description: "The Brain can recall this in future conversations.", tone: "success" });
    },
    onError: (err: Error) => toast("Could not add memory", { description: err.message, tone: "error" }),
  });

  const updateMemory = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { content?: string; kind?: string; approved?: boolean } }) =>
      api.updateMemory(id, payload),
    onSuccess: (_updated, variables) => {
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      setEditing(null);
      toast(variables.payload.approved === true ? "Memory approved" : "Memory updated", { tone: "success" });
    },
    onError: (err: Error) => toast("Could not update memory", { description: err.message, tone: "error" }),
  });

  const deleteMemory = useMutation({
    mutationFn: (id: string) => api.deleteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      setPendingDelete(null);
      toast("Memory deleted", { tone: "success" });
    },
    onError: (err: Error) => toast("Could not delete memory", { description: err.message, tone: "error" }),
  });

  const clearMemory = useMutation({
    mutationFn: api.clearMemory,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      setConfirmClear(false);
      toast(`${result.deleted} memories cleared`, { description: "A deletion record remains in the audit log.", tone: "success" });
    },
    onError: (err: Error) => toast("Could not clear memory", { description: err.message, tone: "error" }),
  });

  const counts = useMemo(
    () => ({
      total: items.length,
      approved: items.filter((item) => item.approved).length,
      pending: items.filter((item) => !item.approved).length,
    }),
    [items],
  );

  const filtered = items.filter((item) => {
    if (filter === "approved") return item.approved;
    if (filter === "pending") return !item.approved;
    return true;
  });

  function beginEdit(item: MemoryItem) {
    setEditing(item);
    setDraft(item.content);
    setDraftKind(item.kind);
  }

  async function exportAll() {
    try {
      const data = await api.exportMemory();
      downloadJson(data, `asta-memory-${new Date().toISOString().slice(0, 10)}.json`);
      toast("Memory exported", { description: "A JSON copy was generated in your browser.", tone: "success" });
    } catch (err) {
      toast("Export failed", { description: (err as Error).message, tone: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inspectable, not implicit"
        title="Memory"
        description="ASTA only recalls memory you have approved. Everything is visible, editable and deletable — and can be exported at any time."
        action={
          <button className="btn-ghost !py-1.5 text-xs" onClick={exportAll}>
            <Download size={13} /> Export JSON
          </button>
        }
      />

      {!memoryEnabled && (
        <div className="flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-2.5 text-xs text-gold">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Memory is disabled in your preferences, so nothing will be recalled. Existing entries are preserved until you
            delete them. Re-enable it in Settings.
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Remembered", value: counts.total, icon: Brain, tone: "text-gold" },
          { label: "Approved", value: counts.approved, icon: Check, tone: "text-success" },
          { label: "Awaiting approval", value: counts.pending, icon: ShieldCheck, tone: counts.pending ? "text-danger" : "text-ash" },
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

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
            <Sparkles size={14} className="text-gold" /> Add a memory
          </h2>
          <p className="mt-1 text-xs text-ash">
            Add something stable and useful: a preference, a goal, or context you do not want to repeat.
          </p>
          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (content.trim()) createMemory.mutate();
            }}
          >
            <label htmlFor="new-memory" className="sr-only">
              Memory content
            </label>
            <textarea
              id="new-memory"
              rows={3}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="e.g. I prefer concise answers with a short summary first."
              className="input resize-none !text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {KINDS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setKind(item.key)}
                  aria-pressed={kind === item.key}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.65rem] transition-colors",
                    kind === item.key ? "border-gold/40 bg-gold/10 text-gold" : "border-line text-ash hover:text-parchment",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="submit"
                className="btn-primary ms-auto !py-1.5 text-xs"
                disabled={createMemory.isPending || content.trim().length === 0 || !memoryEnabled}
              >
                {createMemory.isPending ? <Spinner size={13} /> : <Plus size={13} />} Remember
              </button>
            </div>
          </form>

          <div className="mt-5 space-y-3 border-t border-line/60 pt-4">
            <Toggle
              checked={memoryEnabled}
              onChange={(value) => {
                if (!preferences.data) return;
                api
                  .updatePreferences({ memory_enabled: value })
                  .then(() => {
                    queryClient.invalidateQueries({ queryKey: ["preferences"] });
                    toast(value ? "Memory enabled" : "Memory disabled", {
                      description: value ? "Approved memories can now inform responses." : "ASTA will stop recalling memory.",
                      tone: "success",
                    });
                  })
                  .catch((err: Error) => toast("Could not change preference", { description: err.message, tone: "error" }));
              }}
              label="Allow approved memory in responses"
              description="Only approved entries are recalled. Disabling keeps the entries but stops retrieval."
            />
            <button className="btn-danger w-full !py-1.5 text-xs" onClick={() => setConfirmClear(true)} disabled={counts.total === 0}>
              <Trash2 size={13} /> Clear all memory
            </button>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                aria-pressed={filter === item.key}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[0.7rem] transition-colors",
                  filter === item.key ? "border-gold/40 bg-gold/10 text-gold" : "border-line text-ash hover:text-parchment",
                )}
              >
                {item.label}
                {item.key === "pending" && counts.pending > 0 && (
                  <span className="ms-1.5 rounded-full bg-danger/20 px-1.5 text-[0.6rem] text-danger">{counts.pending}</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {memory.isLoading && [1, 2, 3].map((key) => <Skeleton key={key} className="h-20 w-full" />)}
            {!memory.isLoading && filtered.length === 0 && (
              <div className="panel">
                <EmptyState
                  icon={<Brain size={20} />}
                  title={filter === "pending" ? "Nothing awaiting approval" : "Nothing remembered yet"}
                  description={
                    filter === "pending"
                      ? "When ASTA proposes a memory in conversation, it appears here until you approve or reject it."
                      : "Add a preference above, or approve a proposal when ASTA asks. Nothing is remembered silently."
                  }
                />
              </div>
            )}
            {filtered.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "panel p-4 transition-colors",
                  !item.approved && "border-gold/25 bg-gold/[0.02]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral" className="!py-0 !text-[0.55rem]">
                        {item.kind}
                      </Badge>
                      <Badge tone={item.approved ? "success" : "warning"} className="!py-0 !text-[0.55rem]">
                        {item.approved ? "approved" : "pending"}
                      </Badge>
                      <span className="text-[0.58rem] text-ash/40">
                        {item.source === "user" ? "added by you" : `proposed by ${item.source}`}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-parchment/85">{item.content}</p>
                    <p className="mt-1.5 text-[0.6rem] text-ash/50">
                      {item.scope} scope · updated {relativeTime(item.updated_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {!item.approved && (
                      <button
                        onClick={() => updateMemory.mutate({ id: item.id, payload: { approved: true } })}
                        className="rounded-md p-1.5 text-success transition-colors hover:bg-success/10"
                        aria-label="Approve memory"
                        title="Approve"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => beginEdit(item)}
                      className="rounded-md p-1.5 text-ash transition-colors hover:bg-white/5 hover:text-parchment"
                      aria-label="Edit memory"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(item)}
                      className="rounded-md p-1.5 text-ash transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label="Delete memory"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {!item.approved && (
                  <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-2.5">
                    <button
                      className="btn-ghost !px-2.5 !py-1 text-[0.68rem]"
                      onClick={() => updateMemory.mutate({ id: item.id, payload: { approved: true } })}
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      className="btn-quiet !px-2.5 !py-1 text-[0.68rem]"
                      onClick={() => deleteMemory.mutate(item.id)}
                    >
                      <X size={12} /> Reject
                    </button>
                    <span className="ms-auto text-[0.6rem] text-ash/50">Not used in responses until approved.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="panel flex items-start gap-3 p-4">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold" />
        <p className="text-[0.7rem] leading-relaxed text-ash">
          Memory is never used to infer sensitive traits. The server stores only what is listed here, recalls a small
          keyword-matched subset, and records create, update, delete and clear actions in an audit log. Memory is disabled
          automatically for child accounts until guardian consent and a safety review are complete.
        </p>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit memory"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={updateMemory.isPending || !draft.trim()}
              onClick={() =>
                editing && updateMemory.mutate({ id: editing.id, payload: { content: draft.trim(), kind: draftKind } })
              }
            >
              {updateMemory.isPending ? <Spinner size={14} /> : <Check size={14} />} Save
            </button>
          </>
        }
      >
        <label htmlFor="edit-memory" className="eyebrow">
          Memory content
        </label>
        <textarea
          id="edit-memory"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="input mt-1.5 resize-none !text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {KINDS.map((item) => (
            <button
              key={item.key}
              onClick={() => setDraftKind(item.key)}
              aria-pressed={draftKind === item.key}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[0.65rem]",
                draftKind === item.key ? "border-gold/40 bg-gold/10 text-gold" : "border-line text-ash",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this memory?"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
            <button className="btn-danger" onClick={() => pendingDelete && deleteMemory.mutate(pendingDelete.id)}>
              <Trash2 size={14} /> Delete
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ash">
          <span className="text-parchment">“{pendingDelete?.content}”</span> will no longer be recalled. The deletion is
          recorded in the audit log but the content is removed from active memory.
        </p>
      </Modal>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all memory?"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmClear(false)}>
              Keep my memory
            </button>
            <button className="btn-danger" onClick={() => clearMemory.mutate()} disabled={clearMemory.isPending}>
              {clearMemory.isPending ? <Spinner size={14} /> : <Trash2 size={14} />} Clear {counts.total} entries
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ash">
          This removes every memory entry for your account. Conversations and knowledge documents are not affected. You
          can export a copy first if you want a record.
        </p>
      </Modal>
    </div>
  );
}
