/** Typed API client. Keys and provider configuration never reach the browser. */

/**
 * In local development the Vite proxy forwards `/api` to the API. On a static
 * host (Render, Netlify, GitHub Pages) there is no proxy, so the build can set
 * `VITE_API_BASE_URL` to the deployed API origin, e.g.
 * `https://asta-api.onrender.com/api/v1`.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");
const HEALTH_URL = `${BASE.replace(/\/api\/v1$/, "")}/health`;

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export function getToken(): string | null {
  return localStorage.getItem("asta.token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("asta.token", token);
  else localStorage.removeItem("asta.token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("asta:unauthorized"));
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  age_band: string;
  is_guest: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: User;
}

export interface Conversation {
  id: string;
  title: string;
  experience: "learn" | "work" | "create" | "companion";
  language: string | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  meta: Record<string, unknown>;
}

export interface Citation {
  title: string;
  url?: string | null;
  snippet?: string | null;
  verified?: boolean;
}

export interface AgentRunMeta {
  agent_id: string;
  status: string;
  summary: string;
  latency_ms?: number;
}

export interface MessageMeta {
  intent?: string;
  confidence?: number;
  agents?: AgentRunMeta[];
  plan?: Array<{ position: number; title: string; description: string; agent_id: string; status: string }>;
  provider?: string | null;
  demo_mode?: boolean;
  citations?: Citation[];
  requires_approval?: boolean;
  latency_ms?: number;
  memory_proposal?: string;
  blocked?: boolean;
  risk?: string;
  output_flags?: string[];
  [key: string]: unknown;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  agent_id?: string | null;
  citations: Citation[];
  tool_runs: Array<Record<string, unknown>>;
  meta: MessageMeta;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  responsibilities: string[];
  allowed_tools: string[];
  permissions: string[];
  status: "available" | "degraded" | "unavailable";
  safety_requirements: string[];
  model_configuration: Record<string, unknown>;
  limits: Record<string, unknown>;
  short?: string;
  last_execution?: { status: string; latency_ms: number; started_at: string } | null;
}

export interface TaskStep {
  id: string;
  position: number;
  title: string;
  description: string;
  agent_id: string;
  status: string;
  depends_on: string[];
  output?: string | null;
  error?: string | null;
}

export interface Task {
  id: string;
  title: string;
  goal: string;
  status: string;
  risk: string;
  requires_approval: boolean;
  result: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  steps: TaskStep[];
}

export interface MemoryItem {
  id: string;
  content: string;
  kind: string;
  scope: string;
  approved: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  error: string | null;
  created_at: string;
}

export interface KnowledgeHit {
  document_id: string;
  document_title: string;
  chunk: string;
  score: number;
}

export interface Preferences {
  app_language: string;
  response_language: string;
  voice_enabled: boolean;
  voice_name: string;
  voice_pitch: number;
  voice_rate: number;
  reduced_motion: boolean;
  text_scale: string;
  high_contrast: boolean;
  memory_enabled: boolean;
  store_history: boolean;
}

export interface ProviderStatus {
  key: string;
  display_name: string;
  kind: string;
  configured: boolean;
  healthy: boolean;
  model: string | null;
  detail: string;
}

export interface Capabilities {
  product: string;
  version: string;
  environment: string;
  provider_mode: string;
  features: Record<string, boolean | string>;
  languages: string[];
  limitations: string[];
}

export interface Integration {
  key: string;
  display_name: string;
  category: string;
  description: string;
  status: string;
  requires_approval: boolean;
  scopes: string[];
  connection: { id: string; status: string; connected_at: string } | null;
}

// ---------------------------------------------------------------------------
// Auth & identity
// ---------------------------------------------------------------------------
export const api = {
  guest: (display_name = "Guest Traveler", age_band = "adult") =>
    request<AuthResponse>("/auth/guest", { method: "POST", body: JSON.stringify({ display_name, age_band }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (payload: { email: string; password: string; display_name: string; age_band: string; guardian_email?: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/users/me"),
  deleteAccount: () => request<{ ok: boolean }>("/users/me", { method: "DELETE" }),

  preferences: () => request<Preferences>("/preferences"),
  updatePreferences: (payload: Partial<Preferences>) =>
    request<Preferences>("/preferences", { method: "PATCH", body: JSON.stringify(payload) }),

  capabilities: () => request<Capabilities>("/capabilities"),
  languages: () => request<{ languages: Array<{ code: string; name: string; rtl: boolean; voice: boolean }> }>("/languages"),
  health: async () => {
    const res = await fetch(HEALTH_URL);
    return (await res.json()) as { status: string; database: string; version: string };
  },
  voiceStatus: () =>
    request<{ mode: string; default_voice: string; server_audio_storage: boolean; synthesis: string; recognition: string; note: string }>(
      "/voice/status",
    ),

  // Conversations
  conversations: (archived = false) => request<Conversation[]>(`/conversations?archived=${archived}`),
  conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  createConversation: (payload: { title?: string; experience?: string; language?: string }) =>
    request<Conversation>("/conversations", { method: "POST", body: JSON.stringify(payload) }),
  updateConversation: (id: string, payload: { title?: string; pinned?: boolean; archived?: boolean }) =>
    request<Conversation>(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteConversation: (id: string) => request<{ ok: boolean }>(`/conversations/${id}`, { method: "DELETE" }),
  messages: (id: string) => request<Message[]>(`/conversations/${id}/messages`),
  feedback: (messageId: string, rating: -1 | 1, comment?: string) =>
    request<{ ok: boolean }>(`/messages/${messageId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    }),

  // Agents
  agents: () => request<Agent[]>("/agents"),
  agentStatus: (id: string) => request<Record<string, unknown>>(`/agents/${id}/status`),
  agentExecutions: () =>
    request<Array<{ id: string; agent_id: string; status: string; summary: string; latency_ms: number; started_at: string }>>(
      "/agents/executions/recent",
    ),
  executeAgent: (id: string, input: string, conversationId?: string) =>
    request<Record<string, unknown>>(`/agents/${id}/execute`, {
      method: "POST",
      body: JSON.stringify({ input, conversation_id: conversationId }),
    }),

  // Tasks
  tasks: () => request<Task[]>("/tasks"),
  task: (id: string) => request<Task>(`/tasks/${id}`),
  createTask: (goal: string, title?: string, autoExecute = false) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify({ goal, title, auto_execute: autoExecute }) }),
  executeTask: (id: string) => request<Task>(`/tasks/${id}/execute`, { method: "POST" }),
  approveTask: (id: string) => request<Task>(`/tasks/${id}/approve`, { method: "POST" }),
  cancelTask: (id: string) => request<Task>(`/tasks/${id}/cancel`, { method: "POST" }),
  taskLogs: (id: string) =>
    request<Array<{ id: string; level: string; message: string; step_id: string | null; created_at: string }>>(
      `/tasks/${id}/logs`,
    ),

  // Memory
  memories: () => request<MemoryItem[]>("/memory"),
  createMemory: (content: string, kind = "fact", scope = "personal") =>
    request<MemoryItem>("/memory", { method: "POST", body: JSON.stringify({ content, kind, scope }) }),
  updateMemory: (id: string, payload: { content?: string; kind?: string; approved?: boolean }) =>
    request<MemoryItem>(`/memory/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteMemory: (id: string) => request<void>(`/memory/${id}`, { method: "DELETE" }),
  clearMemory: () => request<{ ok: boolean; deleted: number }>("/memory", { method: "DELETE" }),
  exportMemory: () => request<Record<string, unknown>>("/memory/export"),

  // Knowledge
  knowledge: () =>
    request<{
      documents: KnowledgeDocument[];
      document_count: number;
      retrieval: string;
      vector_search_enabled: boolean;
      note: string;
    }>("/knowledge"),
  uploadKnowledge: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<KnowledgeDocument>("/knowledge/documents", { method: "POST", body: form });
  },
  searchKnowledge: (query: string, limit = 5) =>
    request<KnowledgeHit[]>("/knowledge/search", { method: "POST", body: JSON.stringify({ query, limit }) }),
  deleteKnowledge: (id: string) => request<void>(`/knowledge/${id}`, { method: "DELETE" }),

  uploadAttachment: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{
      id: string;
      filename: string;
      content_type: string;
      size_bytes: number;
      preview: string;
      meta: Record<string, unknown>;
    }>("/attachments", { method: "POST", body: form });
  },

  // Integrations
  integrations: () =>
    request<{ external_actions_enabled: boolean; integrations: Integration[]; note: string }>("/integrations"),
  connectIntegration: (key: string, payload?: { url?: string; token?: string }) =>
    request<{ ok: boolean }>(`/integrations/${key}/connect`, {
      method: "POST",
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    }),
  testWebhook: () =>
    request<{ ok: boolean; task_id: string; status: string; note: string }>("/integrations/webhook/test", {
      method: "POST",
    }),
  disconnectIntegration: (id: string) =>
    request<{ ok: boolean }>(`/integrations/${id}`, { method: "DELETE" }),

  // Models
  models: () =>
    request<{
      providers: ProviderStatus[];
      mode: string;
      demo_fallback_enabled: boolean;
      configured_model: string;
      note: string;
    }>("/models"),
};

// ---------------------------------------------------------------------------
// SSE streaming
// ---------------------------------------------------------------------------
export type StreamEvent =
  | "start"
  | "status"
  | "agent_selected"
  | "tool_started"
  | "tool_completed"
  | "approval_required"
  | "task_created"
  | "delta"
  | "done"
  | "error";

export async function streamChat(
  conversationId: string,
  payload: { content: string; language?: string; attachment_ids?: string[] },
  onEvent: (event: StreamEvent, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}/conversations/${conversationId}/messages/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent("asta:unauthorized"));
    let detail = `Stream failed (${res.status})`;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (!res.body) throw new ApiError(500, "Streaming is not supported by this browser.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    try {
      const data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
      onEvent(event as StreamEvent, data);
    } catch {
      /* ignore malformed frame */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.search(/\r?\n\r?\n/);
    while (index !== -1) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index).replace(/^\r?\n\r?\n/, "");
      if (block.trim()) flushBlock(block);
      index = buffer.search(/\r?\n\r?\n/);
    }
  }
  if (buffer.trim()) flushBlock(buffer);
}
