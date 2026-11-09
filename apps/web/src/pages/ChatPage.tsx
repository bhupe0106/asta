import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FlaskConical,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api, streamChat, type Message as ChatMessage, type MessageMeta, type StreamEvent } from "@/lib/api";
import { cn, experienceLabel, suggestionForExperience } from "@/lib/utils";
import { usePreferences } from "@/hooks/usePreferences";
import { useSpeech } from "@/hooks/useSpeech";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { Badge, EmptyState, Modal, Spinner } from "@/components/common/ui";
import { Emblem } from "@/components/brand/Emblem";
import { AgentActivity, type LiveAgent, type LivePlanStep } from "@/components/chat/AgentActivity";
import { ChatComposer, type PendingAttachment } from "@/components/chat/ChatComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";

export function ChatPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const experienceHint = (searchParams.get("experience") ?? "companion") as string;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const toast = useUIStore((s) => s.toast);
  const prefs = usePreferences();
  const speech = useSpeech();

  const [conversationId, setConversationId] = useState<string | null>(id ?? null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [languageTouched, setLanguageTouched] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [streamMeta, setStreamMeta] = useState<MessageMeta | null>(null);
  const [showStreamed, setShowStreamed] = useState(false);
  const [pendingUser, setPendingUser] = useState<ChatMessage | null>(null);
  const [liveAgents, setLiveAgents] = useState<LiveAgent[]>([]);
  const [plan, setPlan] = useState<LivePlanStep[] | undefined>();
  const [stage, setStage] = useState("Coordinating specialists");
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState("");
  const [approval, setApproval] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const collectedRef = useRef("");

  const conversation = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api.conversation(id!),
    enabled: Boolean(id),
  });

  const messages = useQuery({
    queryKey: ["messages", id],
    queryFn: () => api.messages(id!),
    enabled: Boolean(id),
  });

  const languages = useQuery({ queryKey: ["languages"], queryFn: api.languages, staleTime: Infinity });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities, staleTime: 60_000 });

  const experience = conversation.data?.experience ?? experienceHint;

  useEffect(() => {
    setConversationId(id ?? null);
  }, [id]);

  useEffect(() => {
    const draft = sessionStorage.getItem("asta.draft");
    if (draft) {
      setInput(draft);
      sessionStorage.removeItem("asta.draft");
    }
  }, []);

  useEffect(() => {
    if (!languageTouched && prefs.data?.response_language) {
      setLanguage(prefs.data.response_language);
    }
  }, [prefs.data?.response_language, languageTouched]);

  useEffect(() => {
    if (!conversation.data) return;
    setTitleDraft(conversation.data.title);
  }, [conversation.data]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.data?.length, streamedText, streaming, scrollToBottom]);

  const deleteConversation = useMutation({
    mutationFn: () => api.deleteConversation(conversationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast("Conversation deleted", { tone: "success" });
      setConfirmDelete(false);
      navigate("/chat");
    },
    onError: (err: Error) => toast("Could not delete", { description: err.message, tone: "error" }),
  });

  const renameConversation = useMutation({
    mutationFn: (title: string) => api.updateConversation(conversationId!, { title }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["conversation", id], updated);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setRenaming(false);
    },
    onError: (err: Error) => toast("Rename failed", { description: err.message, tone: "error" }),
  });

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > 20 * 1024 * 1024) {
        toast("File is too large", { description: `${file.name} exceeds the 20 MB limit.`, tone: "error" });
        continue;
      }
      try {
        const uploaded = await api.uploadAttachment(file);
        setAttachments((current) => [...current, { id: uploaded.id, filename: uploaded.filename }]);
        toast(`${uploaded.filename} attached`, {
          description: `${uploaded.preview.slice(0, 90)}${uploaded.preview.length > 90 ? "…" : ""}`,
          tone: "success",
        });
      } catch (err) {
        toast("Could not read that file", { description: (err as Error).message, tone: "error" });
      }
    }
    setUploading(false);
  }

  function handleEvent(event: StreamEvent, data: Record<string, unknown>) {
    switch (event) {
      case "status": {
        if (data.stage === "guardian") {
          setStage(data.state === "blocked" ? "Guardian intervention" : "Guardian review passed");
        } else if (data.stage === "planning") {
          setStage(`Planning · ${String(data.intent ?? "")}`);
          if (Array.isArray(data.plan)) setPlan(data.plan as LivePlanStep[]);
        } else if (data.stage === "composing") {
          setStage("Composing the answer");
        } else if (data.stage === "agent" && data.agent_id) {
          const agentId = String(data.agent_id);
          setLiveAgents((current) => {
            const state = String(data.state ?? "running");
            const summary = data.summary ? String(data.summary) : undefined;
            const latency_ms = data.latency_ms ? Number(data.latency_ms) : undefined;
            const existing = current.find((agent) => agent.agent_id === agentId);
            if (existing) {
              return current.map((agent) =>
                agent.agent_id === agentId ? { ...agent, state, summary, latency_ms } : agent,
              );
            }
            return [...current, { agent_id: agentId, name: agentId, state, summary, latency_ms }];
          });
        }
        break;
      }
      case "agent_selected":
        setLiveAgents((current) => {
          const agentId = String(data.agent_id);
          if (current.some((agent) => agent.agent_id === agentId)) return current;
          return [...current, { agent_id: agentId, name: String(data.name ?? agentId), state: "queued" }];
        });
        break;
      case "tool_started":
      case "tool_completed":
        setStage(`${event === "tool_started" ? "Tool" : "Completed"} · ${String(data.tool ?? "tool")}`);
        break;
      case "approval_required":
        setApproval(true);
        toast("Approval required", {
          description: "A consequential action was requested. Nothing was executed.",
          tone: "info",
        });
        break;
      case "task_created":
        setTaskId(String(data.task_id));
        toast("Task plan created", { description: "Inspect the steps in Tasks.", tone: "success" });
        break;
      case "delta":
        collectedRef.current += String(data.text ?? "");
        setStreamedText(collectedRef.current);
        break;
      case "error":
        setError(String(data.message ?? "The stream failed."));
        break;
      case "done":
        setStreamMeta((data.meta ?? {}) as MessageMeta);
        setStreaming(false);
        break;
      default:
        break;
    }
  }

  async function send(raw?: string) {
    if (streaming) return;
    const content = (raw ?? input).trim();
    if (!content && attachments.length === 0) return;

    setError(null);
    setApproval(false);
    setTaskId(null);
    setStreamMeta(null);
    setStreamedText("");
    setShowStreamed(true);
    setLiveAgents([]);
    setPlan(undefined);
    setStage("Opening the channel");
    collectedRef.current = "";
    setInput("");
    setLastSent(content);

    let cid = conversationId;
    try {
      if (!cid) {
        const created = await api.createConversation({
          experience: experience as "learn" | "work" | "create" | "companion",
          language: language === "auto" ? undefined : language,
        });
        cid = created.id;
        setConversationId(cid);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        navigate(`/chat/${cid}`, { replace: true });
      }

      const optimistic: ChatMessage = {
        id: `pending-${Date.now()}`,
        conversation_id: cid,
        role: "user",
        content,
        citations: [],
        tool_runs: [],
        meta: { attachments: attachments.map((attachment) => attachment.filename) },
        created_at: new Date().toISOString(),
      };
      setPendingUser(optimistic);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const attachmentIds = attachments.map((attachment) => attachment.id);
      setAttachments([]);

      await streamChat(
        cid,
        {
          content: content || "Please analyse the attached document.",
          language: language === "auto" ? undefined : language,
          attachment_ids: attachmentIds,
        },
        handleEvent,
        controller.signal,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        toast("Generation stopped", { description: "Partial output may not have been saved." });
      } else {
        setError((err as Error).message);
        toast("ASTA could not reach the intelligence service", {
          description: (err as Error).message,
          tone: "error",
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (cid) {
        try {
          const fresh = await api.messages(cid);
          queryClient.setQueryData(["messages", cid], fresh);
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          queryClient.invalidateQueries({ queryKey: ["conversation", cid] });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        } catch {
          queryClient.invalidateQueries({ queryKey: ["messages", cid] });
        }
      }
      setPendingUser(null);
      setShowStreamed(false);
      setPendingUser(null);
      if (prefs.data?.voice_enabled && collectedRef.current) {
        setSpeakingId("auto");
        speech.speak(collectedRef.current, {
          language: language === "auto" ? "en" : language,
          voiceName: prefs.data.voice_name,
          rate: prefs.data.voice_rate,
          pitch: prefs.data.voice_pitch,
          onEnd: () => setSpeakingId(null),
        });
      }
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function speakMessage(message: ChatMessage) {
    if (speakingId === message.id) {
      speech.stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(message.id);
    speech.speak(message.content, {
      language: language === "auto" ? "en" : language,
      voiceName: prefs.data?.voice_name,
      rate: prefs.data?.voice_rate ?? 1,
      pitch: prefs.data?.voice_pitch ?? 0.95,
      onEnd: () => setSpeakingId(null),
    });
  }

  const history = messages.data ?? [];
  const displayMessages = useMemo(() => {
    const list: Array<ChatMessage & { streaming?: boolean }> = [...history];
    if (pendingUser) list.push(pendingUser);
    if (showStreamed) {
      list.push({
        id: "streaming-assistant",
        conversation_id: conversationId ?? "",
        role: "assistant",
        content: streamedText,
        citations: [],
        tool_runs: [],
        meta: streamMeta ?? {
          agents: liveAgents.map((agent) => ({ ...agent, status: agent.state, summary: agent.summary ?? "" })),
        },
        created_at: new Date().toISOString(),
        streaming,
      });
    }
    return list;
  }, [history, pendingUser, showStreamed, streamedText, streamMeta, liveAgents, streaming, conversationId]);

  const lastUserContent = useMemo(
    () => [...history].reverse().find((message) => message.role === "user")?.content,
    [history],
  );
  const lastAssistantId = useMemo(
    () => [...history].reverse().find((message) => message.role === "assistant")?.id,
    [history],
  );

  const demoOnly =
    capabilities.data?.features.model_connected === false && capabilities.data?.features.demo_composer === true;

  const isNew = !conversationId;
  const languageOptions = languages.data?.languages ?? [
    { code: "en", name: "English", rtl: false, voice: true },
  ];

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => navigate("/")} className="btn-quiet p-2 lg:hidden" aria-label="Back home">
            <ArrowLeft size={16} />
          </button>
          {renaming && conversationId ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (titleDraft.trim()) renameConversation.mutate(titleDraft.trim());
              }}
            >
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="input max-w-xs !py-1 text-sm"
                aria-label="Conversation title"
              />
              <button type="submit" className="btn-quiet p-1.5" aria-label="Save title">
                <Check size={15} />
              </button>
            </form>
          ) : (
            <div className="min-w-0">
              <p className="eyebrow">{experienceLabel(experience)}</p>
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-lg text-parchment">
                  {conversation.data?.title ?? "New conversation"}
                </h1>
                {conversationId && (
                  <button
                    onClick={() => setRenaming(true)}
                    className="text-ash/50 transition-colors hover:text-parchment"
                    aria-label="Rename conversation"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {demoOnly && (
            <Badge tone="warning">
              <FlaskConical size={11} /> Local demo
            </Badge>
          )}
          <Link to={`/chat?experience=${experience}`} className="btn-ghost !px-2.5 !py-1.5 text-xs">
            <Plus size={14} /> New
          </Link>
          {conversationId && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-quiet p-2"
              aria-label="Delete conversation"
              title="Delete conversation"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {demoOnly && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2 text-xs text-gold/90">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            {t("chat.demoNotice")}{" "}
            <Link to="/settings" className="underline underline-offset-2">
              Connect Ollama in Settings
            </Link>
            .
          </span>
        </div>
      )}

      <div className="flex-1">
        {isNew && history.length === 0 && !showStreamed ? (
          <div className="relative flex flex-col items-center justify-center px-4 py-14 text-center">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.045]">
              <Emblem size={440} />
            </div>
            <div className="relative">
              <Badge tone="gold" className="mb-5">
                <Sparkles size={11} /> {experienceLabel(experience)}
              </Badge>
              <h2 className="font-display text-3xl text-balance text-parchment sm:text-4xl">
                {t("chat.emptyTitle")}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ash">{t("chat.emptyBody")}</p>
              <div className="mx-auto mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {suggestionForExperience(experience).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="panel-interactive group flex items-center justify-between gap-3 px-4 py-3 text-left text-sm text-ash hover:text-parchment"
                  >
                    <span>{suggestion}</span>
                    <Sparkles size={14} className="shrink-0 text-gold/40 group-hover:text-gold" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {displayMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                streaming={Boolean(message.streaming)}
                speaking={speakingId === message.id}
                onSpeak={message.role === "assistant" ? () => speakMessage(message) : undefined}
                isLastAssistant={message.id === lastAssistantId}
                onRegenerate={
                  message.id === lastAssistantId && lastUserContent && !streaming
                    ? () => send(lastUserContent)
                    : undefined
                }
                onFeedback={
                  message.role === "assistant" && !message.streaming
                    ? async (rating) => {
                        try {
                          await api.feedback(message.id, rating);
                          toast(t("chat.feedbackThanks"), { tone: "success" });
                        } catch (err) {
                          toast("Feedback not saved", { description: (err as Error).message, tone: "error" });
                        }
                      }
                    : undefined
                }
              />
            ))}

            {streaming && showStreamed && (
              <div className="mx-auto max-w-3xl pb-2">
                <AgentActivity agents={liveAgents} plan={plan} stage={stage} />
              </div>
            )}

            {error && (
              <div className="my-4 flex items-start gap-2 rounded-lg border border-danger/35 bg-danger/[0.08] px-3 py-3 text-sm text-danger">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{t("chat.errorTitle")}</p>
                  <p className="mt-0.5 text-xs text-danger/85">{error}</p>
                  {lastSent && (
                    <button onClick={() => send(lastSent)} className="mt-2 text-xs underline underline-offset-2">
                      Try this turn again
                    </button>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-4 bg-gradient-to-t from-abyss via-abyss/95 to-transparent px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {approval && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/[0.07] px-3 py-2 text-xs text-gold">
              <ShieldAlert size={14} /> Approval required before any consequential action.{" "}
              <Link to="/tasks" className="underline underline-offset-2">
                Review
              </Link>
            </div>
          )}
          {taskId && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-success/25 bg-success/[0.06] px-3 py-2 text-xs text-success">
              <Info size={14} /> Task plan created.{" "}
              <Link to="/tasks" className="underline underline-offset-2">
                Open the task board
              </Link>
            </div>
          )}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => send()}
            onStop={stop}
            streaming={streaming}
            disabled={uploading}
            attachments={attachments}
            onFiles={uploadFiles}
            onRemoveAttachment={(attachmentId) =>
              setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
            }
            uploading={uploading}
            language={language}
            onLanguageChange={(value) => {
              setLanguage(value);
              setLanguageTouched(true);
            }}
            languages={languageOptions}
            placeholder={t("chat.placeholder")}
          />
          <div className="mt-2 flex items-center justify-between px-1 text-[0.6rem] text-ash/45">
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-ember" />
              ASTA is an AI. It can be wrong — verify important information.
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              {user?.is_guest ? "Guest session" : "Free plan"} · Privacy first
            </span>
          </div>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this conversation?"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button className="btn-danger" onClick={() => deleteConversation.mutate()} disabled={deleteConversation.isPending}>
              {deleteConversation.isPending ? <Spinner size={14} /> : <Trash2 size={14} />} Delete
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ash">
          The conversation is soft-deleted immediately and hidden from your workspace. Related task records remain for
          audit purposes. This cannot be undone from the interface.
        </p>
      </Modal>
    </div>
  );
}
