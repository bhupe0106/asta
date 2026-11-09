# Architecture

ASTA is a monorepo with a browser client and a single API service. The design goal is a unified
intelligence with inspectable orchestration, honest capability reporting, and strict user scoping at
the data layer.

## Runtime topology

```
Browser (React + Vite)
  │  relative /api requests, SSE for chat
  ▼
FastAPI (services/api)
  ├─ API v1 routers ────────────── auth, conversations, agents, tasks, memory,
  │                                knowledge, attachments, preferences,
  │                                integrations, capabilities, models
  ├─ Orchestration ─────────────── Brain · registry · dispatcher · Guardian
  ├─ Agents ────────────────────── 11 specialists (Brain lives in orchestration)
  ├─ AI layer ──────────────────── ModelProvider · Ollama · demo composer · router
  ├─ Knowledge / memory ────────── extraction, keyword retrieval, approved recall
  └─ SQLAlchemy ────────────────── SQLite (dev) / PostgreSQL (target)
```

The browser never receives provider API keys or model identifiers chosen at runtime. It talks to the
API through relative URLs; in development Vite proxies `/api` and `/health` to `127.0.0.1:8000`.

## Twelve roles

One **Brain** orchestrator and eleven specialists:

`researcher`, `scholar`, `coder`, `analyst`, `creator`, `voice`, `operator`, `memory`, `guardian`,
`planner`, `monitor` — plus the Brain itself.

The registry (`app/orchestration/registry.py`) is the single source of truth for each agent's
description, responsibilities, allowed tools, permissions, safety requirements, model profile and
limits. The API exposes this contract to the UI so the agent workspace describes what actually runs.

Rules:

- Specialists never delegate to each other. Only the Brain dispatches.
- Delegation depth is capped at 2 and steps at 8.
- Every dispatch has a timeout and is written to an execution log.
- Guardian reviews the user turn before planning and checks proposed external actions.
- Monitor observes status/latency only; it does not record conversation content.

## A chat turn

1. The client creates a conversation (if needed) and posts to
   `POST /api/v1/conversations/{id}/messages/stream`.
2. The API authenticates the user and verifies ownership of the conversation.
3. The Brain runs Guardian pre-checks and emits `status` events.
4. Intent classification and planning select specialists and emit `status`/`agent_selected`.
5. The dispatcher runs bounded specialist work. Local specialists can compute real results
   (CSV statistics, plans, static review, rules) without a model.
6. The Brain composes the answer through the model router, streaming `delta` events.
7. The assistant message, citations, tool runs and metadata are persisted.
8. A memory proposal, if any, is stored **unapproved** and surfaced for explicit approval.
9. A `done` event carries the message ID and metadata (intent, agents, demo flag, latency, citations).

Structured SSE event names are a public contract and are listed in [api.md](api.md#sse-contract).

## Provider routing

`ModelProvider` is a small contract (`health_check`, `generate`, `generate_stream`). The router
prefers Ollama, caches health briefly, retries transient failures, and falls back to the deterministic
demo composer only when `ASTA_ALLOW_DEMO_PROVIDER` permits it. The router never accepts a model name
from the browser.

The demo composer is not a language model. It returns a disclosed scaffold and marks
`meta.demo_mode = true`. Capability discovery reports `model_connected: false` when only demo is
healthy, so the UI can keep the disclosure visible.

## Data model (high level)

- **Identity**: `users`, `user_profiles`, `user_preferences`, `user_sessions`, `roles`, `audit_logs`
- **Workspace**: `workspaces`, `workspace_members`
- **Conversation**: `conversations`, `messages`, `message_feedback`, `model_usage_logs`
- **Agents/tasks**: `agent_records`, `agent_executions`, `tasks`, `task_steps`, `task_approvals`,
  `task_execution_logs`
- **Memory**: `memory_items`, `memory_audit_logs`
- **Knowledge**: `knowledge_documents`, `knowledge_chunks`, `attachments`
- **Integrations**: `integrations`, `integration_connections`, `integration_audit_logs`
- **Platform**: `feature_flags`, plus metadata tables for future billing/telemetry

IDs are UUID strings. Soft deletes (`deleted_at`) preserve auditability for conversations, memory and
accounts. Ownership is enforced in queries (`WHERE user_id = :current_user`) — not by trusting prompt
content.

## Safety model

- Guardian rules classify risk and can block a turn before any model call.
- External actions are feature-flagged. Custom webhooks are live but every outbound payload requires a
  recorded approval; OAuth connectors deliberately return `501` until credentials exist.
- Tasks whose intent is consequential are created in `waiting_approval`; approval is a recorded act.
- Memory is approval-gated: assistant proposals start unapproved and are only recalled when approved
  and when the user's preference enables memory.
- Code execution is a best-effort local subprocess with a timeout, stripped environment and capped
  output; it is explicitly not a hardened security sandbox.
- Child accounts require a guardian email, but the release is explicitly **not** safety-certified for
  children.

## Frontend architecture

- React Router with a protected shell and lazy-loaded pages.
- TanStack Query for server state; Zustand for auth, UI and toasts.
- Typed API client plus a hand-written SSE frame parser (no proprietary streaming dependency).
- i18next resources for six locales; document direction is applied for RTL languages.
- A single design-token layer in Tailwind + CSS variables; reduced motion and high contrast are
  first-class preferences.

## Deliberate boundaries

- No fake agent-to-agent conversations, no invented integrations, no fabricated citations.
- No hidden telemetry or advertising loops.
- No model provider configured by default beyond local Ollama and the labelled demo composer.
- Vector search, hardened sandboxing and OAuth connectors remain documented as future work; the
  current webhook, procedural media and best-effort code paths are labelled for what they are.
