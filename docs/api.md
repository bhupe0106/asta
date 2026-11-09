# API reference

Base URL: `http://127.0.0.1:8000/api/v1` (the web client uses the relative `/api/v1` through the dev
proxy or production reverse proxy). Interactive OpenAPI docs are available at `/docs`.

All authenticated routes expect:

```http
Authorization: Bearer <access_token>
```

Errors use FastAPI's shape:

```json
{ "detail": "Human-readable explanation" }
```

Requests are rate-limited per account/IP on sensitive routes (auth, chat, uploads, agent execution).
The `X-Trace-Id` response header identifies a request in server logs.

## Identity

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account. Password must mix letters and numbers; child accounts require `guardian_email`. |
| `POST` | `/auth/login` | Exchange email/password for a bearer token. |
| `POST` | `/auth/guest` | Create a temporary guest identity (`age_band` is `teen` or `adult`). |
| `POST` | `/auth/logout` | Revoke the current session. |
| `GET` | `/users/me` | Current user. |
| `DELETE` | `/users/me` | Soft-delete the account, revoke sessions and detach conversations. |

Registration response:

```json
{
  "access_token": "…",
  "token_type": "bearer",
  "expires_at": "2026-11-14T12:00:00Z",
  "user": {
    "id": "…",
    "email": "you@example.com",
    "display_name": "Traveler",
    "role": "member",
    "age_band": "adult",
    "is_guest": false,
    "created_at": "2026-11-07T12:00:00Z"
  }
}
```

## Preferences

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/preferences` | Read preferences (created on first access). |
| `PATCH` | `/preferences` | Partial update. |

Fields: `app_language`, `response_language` (`auto` allowed), `voice_enabled`, `voice_name`,
`voice_pitch`, `voice_rate`, `reduced_motion`, `text_scale` (`90`/`100`/`112`/`125`),
`high_contrast`, `memory_enabled`, `store_history`.

> `store_history` is stored for forward compatibility but per-message retention controls are not
> enforced in this release. The UI does not present it as an active switch.

## Conversations and streaming

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/conversations` | Create a conversation (`experience`: learn/work/create/companion). |
| `GET` | `/conversations?archived=false&limit=50` | List visible conversations, pinned first. |
| `GET` | `/conversations/{id}` | Read one conversation. |
| `PATCH` | `/conversations/{id}` | Rename, pin or archive. |
| `DELETE` | `/conversations/{id}` | Soft-delete. |
| `GET` | `/conversations/{id}/messages` | Full message history. |
| `POST` | `/conversations/{id}/messages/stream` | Run a turn and stream SSE. |
| `POST` | `/messages/{id}/feedback` | Rating `-1`/`1` with optional comment. |

Stream request:

```json
{
  "content": "Explain photosynthesis step by step",
  "language": "en",
  "attachment_ids": ["…"]
}
```

Limits: content ≤ 20,000 characters; up to 5 attachments; 40 chat turns/minute.

### SSE contract

Frames use `event: <name>` and a single JSON `data:` line, separated by a blank line. The stream ends
with `done` (or `error`).

| Event | Payload (indicative) |
| --- | --- |
| `start` | `{ "conversation_id", "message_id" }` |
| `status` | `{ "stage": "guardian"\|"planning"\|"agent"\|"composing", "state", "intent"?, "plan"?, "agent_id"?, "summary"?, "latency_ms"? }` |
| `agent_selected` | `{ "agent_id", "name" }` |
| `tool_started` | `{ "tool", "agent_id" }` |
| `tool_completed` | `{ "tool", "agent_id", "status" }` |
| `approval_required` | `{ "task_id", "reason" }` |
| `task_created` | `{ "task_id", "title" }` |
| `delta` | `{ "text": "incremental text" }` |
| `done` | `{ "message_id", "meta": { "intent", "agents", "demo_mode", "provider", "citations", "latency_ms", … } }` |
| `error` | `{ "message", "detail"? }` |

Example:

```
event: status
data: {"stage":"guardian","state":"passed","risk":"low","flags":[]}

event: delta
data: {"text":"Photosynthesis is "}

event: done
data: {"message_id":"…","meta":{"intent":"learn","demo_mode":true,"agents":[…]}}
```

When no model is reachable and the demo composer is allowed, `meta.demo_mode` is `true` and the
content is a deterministic scaffold — not model reasoning.

## Agents

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/agents` | All twelve contracts with status and last execution. |
| `GET` | `/agents/{id}` | One contract. |
| `GET` | `/agents/{id}/status` | Recent execution counts, average latency, provider status. |
| `POST` | `/agents/{id}/execute` | Bounded direct specialist execution. Guardian runs first. |
| `GET` | `/agents/executions/recent` | Recent execution summaries. |

`POST /agents/{id}/execute` body: `{ "input": "…", "conversation_id": "optional" }`.

## Tasks

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/tasks` | Plan a goal. `auto_execute` only runs low-risk plans. |
| `GET` | `/tasks?status=…` | List up to 100 tasks. |
| `GET` | `/tasks/{id}` | Task with inspectable steps. |
| `POST` | `/tasks/{id}/approve` | Approve a `waiting_approval` plan. |
| `POST` | `/tasks/{id}/execute` | Execute a planned/cancelled-safe plan. |
| `POST` | `/tasks/{id}/cancel` | Cancel a non-terminal task. |
| `GET` | `/tasks/{id}/logs` | Execution log entries. |

Statuses: `draft`, `planned`, `waiting_approval`, `queued`, `running`, `completed`, `failed`,
`cancelled`.

## Memory

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/memory` | All active entries, including pending proposals. |
| `POST` | `/memory` | Add an approved entry (requires `memory_enabled`). |
| `PATCH` | `/memory/{id}` | Edit content/kind or set `approved: true/false`. |
| `DELETE` | `/memory/{id}` | Delete one entry. |
| `DELETE` | `/memory` | Clear all entries; returns `{ "ok": true, "deleted": n }`. |
| `GET` | `/memory/export` | JSON export with timestamps. |

Assistant-proposed memories are created with `approved: false` and are not recalled until approved.

## Knowledge and attachments

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/knowledge` | Document list and retrieval mode. |
| `POST` | `/knowledge/documents` | Multipart upload; extracts and indexes text. |
| `POST` | `/knowledge/search` | `{ "query", "limit" }` → keyword-scored chunks. |
| `DELETE` | `/knowledge/{id}` | Delete document and chunks. |
| `POST` | `/attachments` | Multipart temporary attachment for a chat turn. |
| `DELETE` | `/attachments/{id}` | Remove an attachment. |

Accepted: `.txt`, `.md`, `.csv`, `.json`, `.pdf`, `.docx`, `.xlsx`, `.pptx`; 20 MB maximum.
Retrieval is keyword-based in this release; `vector_search_enabled` is reported honestly.

## Integrations

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/integrations` | Catalog, connection state, external-action flag. |
| `POST` | `/integrations/webhook/connect` | Store `{ "url", "token?" }` server-side; returns a connection record. |
| `POST` | `/integrations/webhook/test` | Queue an approval-gated test action and return its task id. |
| `POST` | `/integrations/{key}/connect` | OAuth keys return `501` until server-side credentials exist. |
| `DELETE` | `/integrations/{connection_id}` | Revoke a connection and erase its stored credentials. |

Webhook payloads are only sent after `POST /tasks/{id}/approve` and `POST /tasks/{id}/execute`, and
each attempt writes an `integration_audit_logs` row.

## Media and tools

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/media/generate` | `{ "prompt", "kind": "image" \| "video" }` → procedural SVG artifact and URL. |
| `GET` | `/media/files/{filename}` | Serve a generated SVG (opaque 32-hex filename only). |
| `GET` | `/tools` | Available tool contracts and isolation labels. |
| `POST` | `/tools/code/run` | `{ "code", "timeout_seconds?" }` → stdout/stderr, exit code and isolation mode. |

Media is deterministic vector synthesis, not diffusion. Code execution is a best-effort local
subprocess and reports that limitation in every response.

## Capabilities, models, voice

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/capabilities` | Version, environment, feature flags, limitations, languages. |
| `GET` | `/languages` | Codes, names, RTL and voice availability. |
| `GET` | `/voice/status` | Browser speech mode; confirms no server audio storage. |
| `GET` | `/models` | Provider status, mode, configured model, demo fallback flag. |
| `GET` | `/models/status` | Healthy/unhealthy split and `any_real_model`. |
| `GET` | `/health` | Outside `/api/v1`; database check and version. |

`/capabilities` is the contract the UI uses to decide what to advertise. If a feature is not genuinely
available, it is reported as `false` and described in `limitations`.
