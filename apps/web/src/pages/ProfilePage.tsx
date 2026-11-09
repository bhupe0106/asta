import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Brain,
  CalendarDays,
  Check,
  Download,
  Fingerprint,
  Info,
  KeyRound,
  LibraryBig,
  ListChecks,
  LogOut,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { downloadJson, initials, relativeTime } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { Badge, Modal, SectionHeader, Spinner, StatusDot } from "@/components/common/ui";

const AGE_LABEL: Record<string, string> = { child: "Child (guardian consent required)", teen: "Teen", adult: "Adult" };

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const toast = useUIStore((s) => s.toast);
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const conversations = useQuery({ queryKey: ["conversations"], queryFn: () => api.conversations() });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const memory = useQuery({ queryKey: ["memory"], queryFn: api.memories });
  const knowledge = useQuery({ queryKey: ["knowledge"], queryFn: api.knowledge });

  const stats = [
    { label: "Conversations", value: conversations.data?.length ?? 0, icon: MessageSquare, to: "/search" },
    { label: "Tasks", value: tasks.data?.length ?? 0, icon: ListChecks, to: "/tasks" },
    { label: "Memories", value: memory.data?.length ?? 0, icon: Brain, to: "/memory" },
    { label: "Documents", value: knowledge.data?.document_count ?? 0, icon: LibraryBig, to: "/knowledge" },
  ];

  async function exportEverything() {
    if (!user) return;
    setExporting(true);
    try {
      const list = await api.conversations();
      const withMessages = await Promise.all(
        list.map(async (conversation) => ({
          ...conversation,
          messages: await api.messages(conversation.id).catch(() => []),
        })),
      );
      const memoryData = await api.exportMemory().catch(() => null);
      downloadJson(
        {
          exported_at: new Date().toISOString(),
          account: {
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            age_band: user.age_band,
            is_guest: user.is_guest,
            created_at: user.created_at,
          },
          conversations: withMessages,
          memory: memoryData,
        },
        `asta-account-${new Date().toISOString().slice(0, 10)}.json`,
      );
      toast("Account data exported", {
        description: `${withMessages.length} conversations and your memory were written to a local JSON file.`,
        tone: "success",
      });
    } catch (err) {
      toast("Export failed", { description: (err as Error).message, tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      clear();
      toast("Account deleted", { description: "Sessions were revoked and private content detached.", tone: "success" });
      navigate("/auth", { replace: true });
    } catch (err) {
      toast("Could not delete account", { description: (err as Error).message, tone: "error" });
      setDeleting(false);
    }
  }

  async function signOut() {
    try {
      await api.logout();
    } catch {
      /* the session may already be revoked */
    }
    clear();
    navigate("/auth", { replace: true });
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Identity"
        title="Profile"
        description="Who you are in ASTA, what is stored, and how to take it with you or remove it."
        action={
          <button className="btn-ghost !py-1.5 text-xs" onClick={signOut}>
            <LogOut size={13} /> Sign out
          </button>
        }
      />

      <section className="panel grimoire-corners relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-crimson/15 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/25 bg-gradient-to-br from-crimson/80 to-arcane/70 font-display text-xl text-parchment shadow-grimoire">
            {initials(user.display_name) || <UserRound size={22} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl text-parchment">{user.display_name}</h1>
              <Badge tone={user.is_guest ? "warning" : "success"}>
                <StatusDot status="available" /> {user.is_guest ? "Guest session" : "Permanent account"}
              </Badge>
              <Badge tone="neutral">{user.role}</Badge>
            </div>
            <p className="mt-1 text-sm text-ash">{user.email}</p>
            <p className="mt-1 text-[0.65rem] text-ash/60">
              {AGE_LABEL[user.age_band] ?? user.age_band} · joined {relativeTime(user.created_at)}
            </p>
          </div>
          <Link to="/settings" className="btn-ghost !py-1.5 text-xs">
            <Sparkles size={12} /> Preferences
          </Link>
        </div>

        <div className="relative mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.to}
              className="rounded-lg border border-line/70 bg-white/[0.015] px-3 py-3 transition-colors hover:border-gold/25"
            >
              <div className="flex items-center justify-between">
                <stat.icon size={14} className="text-ash/60" />
                <span className="font-display text-lg text-parchment">{stat.value}</span>
              </div>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-ash/60">{stat.label}</p>
            </Link>
          ))}
        </div>
      </section>

      {user.is_guest && (
        <div className="flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/[0.05] px-3 py-2.5 text-xs text-gold">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            You are in a guest session. This data lives on this server and can disappear if the deployment is reset. Guest
            accounts cannot yet be upgraded in place — sign out and register with an email to create a permanent account,
            though existing guest conversations are not transferred automatically.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
            <Fingerprint size={14} className="text-gold" /> Account details
          </h2>
          <dl className="mt-3 divide-y divide-line/60 text-xs">
            {[
              ["Account ID", user.id],
              ["Display name", user.display_name],
              ["Email", user.email],
              ["Role", user.role],
              ["Age band", AGE_LABEL[user.age_band] ?? user.age_band],
              ["Account type", user.is_guest ? "Guest (temporary)" : "Registered"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <dt className="text-ash">{label}</dt>
                <dd className="max-w-[65%] truncate font-mono text-[0.68rem] text-parchment/85" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-line/60 bg-white/[0.015] p-3 text-[0.66rem] leading-relaxed text-ash">
            <KeyRound size={12} className="mt-0.5 shrink-0 text-gold" />
            <span>
              Display-name editing, password changes and account upgrade are not enabled in this release. The API
              deliberately exposes no endpoint rather than showing a form that cannot save.
            </span>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
            <Download size={14} className="text-gold" /> Your data
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ash">
            Generate a complete local copy of your account data. The file is written by your browser; ASTA does not email
            it anywhere.
          </p>
          <div className="mt-3 rounded-lg border border-line/60 p-3">
            <p className="text-xs text-parchment">Export includes</p>
            <ul className="mt-1.5 space-y-1 text-[0.68rem] text-ash">
              <li className="flex items-center gap-1.5">
                <Check size={11} className="text-success" /> Account identity and preferences
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={11} className="text-success" /> All visible conversations and messages
              </li>
              <li className="flex items-center gap-1.5">
                <Check size={11} className="text-success" /> Approved and pending memory entries
              </li>
            </ul>
          </div>
          <button className="btn-ghost mt-3 !py-1.5 text-xs" onClick={exportEverything} disabled={exporting}>
            {exporting ? <Spinner size={12} /> : <Download size={12} />} {exporting ? "Gathering…" : "Export account data"}
          </button>
          <p className="mt-2 text-[0.62rem] leading-relaxed text-ash/60">
            Knowledge documents themselves are not bundled; the export lists their metadata. Re-download source files
            separately if you need them.
          </p>
        </section>

        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-display text-sm text-parchment">
            <ShieldCheck size={14} className="text-gold" /> Security posture
          </h2>
          <div className="mt-3 space-y-2.5 text-[0.68rem] leading-relaxed text-ash">
            <p className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-success" />
              Passwords are hashed with PBKDF2 and never stored or logged in plain text.
            </p>
            <p className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-success" />
              Sessions are server-side records and can be revoked; signing out revokes this session immediately.
            </p>
            <p className="flex items-start gap-2">
              <Check size={12} className="mt-0.5 shrink-0 text-success" />
              Every conversation, document and memory query is filtered by your user ID at the database layer.
            </p>
            <p className="flex items-start gap-2">
              <Info size={12} className="mt-0.5 shrink-0 text-gold" />
              Single-session management and device lists are not exposed in this release. Tokens expire automatically.
            </p>
          </div>
        </section>

        <section className="panel border-danger/25 p-5">
          <h2 className="flex items-center gap-2 font-display text-sm text-danger">
            <ShieldAlert size={14} /> Danger zone
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ash">
            Deleting your account revokes every session and detaches conversations from your identity. The operation is
            soft-deleted for audit and backup retention, so it cannot be undone from this interface.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <CalendarDays size={12} className="text-ash/60" />
            <span className="text-[0.65rem] text-ash/60">Created {new Date(user.created_at + "Z").toLocaleDateString()}</span>
          </div>
          <button className="btn-danger mt-3 !py-1.5 text-xs" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={12} /> Delete my account
          </button>
        </section>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setConfirmText("");
        }}
        title="Delete your account?"
        footer={
          <>
            <button
              className="btn-ghost"
              onClick={() => {
                setConfirmDelete(false);
                setConfirmText("");
              }}
            >
              Keep my account
            </button>
            <button
              className="btn-danger"
              onClick={deleteAccount}
              disabled={confirmText !== "DELETE" || deleting}
            >
              {deleting ? <Spinner size={14} /> : <Trash2 size={14} />} Delete permanently
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-ash">
          <p>
            This signs you out everywhere and marks your account, conversations and private content as deleted. There is no
            undo button.
          </p>
          <div className="rounded-lg border border-danger/30 bg-danger/[0.06] p-3 text-xs text-danger">
            Export your data first if you may want a copy. Knowledge files and memory cannot be recovered after deletion.
          </div>
          <label htmlFor="confirm-delete" className="block text-xs text-parchment">
            Type <span className="font-mono text-danger">DELETE</span> to confirm
          </label>
          <input
            id="confirm-delete"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className="input font-mono"
            autoComplete="off"
            placeholder="DELETE"
          />
        </div>
      </Modal>
    </div>
  );
}
