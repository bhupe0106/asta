# ASTA — Your intelligence. Your possibilities.

ASTA (Autonomous System for Task Automation) is a unified, local-first AI ecosystem built as a
single platform with four experiences — **Learn, Work, Create, Companion** — twelve specialist
agents coordinated by a **Brain**, and a **Guardian** that holds consequential actions behind
explicit approval.

This repository contains a complete vertical slice: a FastAPI + SQLAlchemy backend, a React +
TypeScript + Vite frontend, streaming chat over Server-Sent Events, approved memory, document
knowledge retrieval, task planning, voice in the browser, multilingual UI (including RTL), and a
dark grimoire-inspired design system.

> ASTA is an AI system. It is not human or sentient, and its output can be wrong. The demo composer
> is deterministic and always labelled. Nothing in the interface invents a capability the server
> does not actually provide.

---

## What is real in this build

| Capability | Status | Notes |
| --- | --- | --- |
| Streaming chat (SSE) | ✅ | Structured events: `start`, `status`, `agent_selected`, `tool_started`, `tool_completed`, `approval_required`, `task_created`, `delta`, `done`, `error` |
| Twelve agents + orchestration | ✅ | Registry, typed delegation, timeouts, execution logs, Guardian rules |
| Conversations & persistence | ✅ | SQLite by default; soft-delete; per-user scoping at the query layer |
| Memory | ✅ | Opt-in, approval-gated, editable, exportable, auditable |
| Knowledge base | ✅ | Local text extraction (PDF/DOCX/XLSX/PPTX/CSV/TXT/MD/JSON) and keyword retrieval |
| Tasks | ✅ | Inspectable plans, dependency-aware steps, approval gates, cancellation, logs |
| Voice | ✅ | Browser speech synthesis/recognition only; no server audio storage |
| Multilingual UI | ✅ | English, Tamil, Hindi, Spanish, Arabic, French resources; 11 response languages; RTL support |
| Provider routing | ✅ | Ollama local-first; resolves the configured model to an installed tag; deterministic labelled demo fallback; no model names in the browser |
| Integrations | ✅ Webhook, ⚠️ OAuth 501 | Connect a custom HTTP(S) endpoint; every outbound payload needs explicit approval and is audited. Email/calendar/storage OAuth still return `501` until credentials exist |
| Image/video generation | ✅ Procedural | Original vector sigils (SVG) and animated SVG motion graphics generated locally; not a diffusion or video model |
| Sandboxed code execution | ✅ Best-effort | Local isolated-mode Python subprocess with timeout and capped output; not a hardened sandbox |
| Web research | ✅ | DuckDuckGo HTML search with Wikipedia fallback (or a configured SearXNG endpoint); public pages are fetched behind an SSRF guard and citations are marked verified/unverified |

---

## Quick start

### Prerequisites

- **Python 3.11–3.13** recommended (the project is tested on recent CPython; 3.15 can install the
  pinned dependencies, but `uvicorn[standard]` may fail to build `pyyaml`).
- **Node.js 20+** and npm.
- Optional: **Ollama** for genuine local model reasoning.

### 1. Backend

```bash
cp .env.example .env
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r services/api/requirements.txt
cd services/api
python -m uvicorn app.main:app --reload --port 8000
```

The API creates `data/asta.db`, the upload directory and seed data on first startup. Check:

- <http://127.0.0.1:8000/health>
- <http://127.0.0.1:8000/docs> (OpenAPI)

### 2. Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` and `/health` to `127.0.0.1:8000`.

### 3. One-command development (optional)

```powershell
# Windows PowerShell — opens the API and web dev servers in separate windows
.\scripts\dev.ps1
```

```bash
# macOS / Linux
./scripts/dev.sh
```

---

## Demo mode and Ollama

The default `ASTA_PROVIDER_MODE=auto` prefers Ollama and falls back to the **demo composer** only when
no model is reachable or the configured model is not installed. The demo composer is not an LLM: it
produces deterministic, clearly disclosed scaffolds so the entire interface can be exercised offline.
Every response carries `meta.demo_mode = true` and a visible banner. Each message also records the
provider that actually composed it (`meta.provider`, `meta.provider_requested`,
`meta.provider_fallback`), so a fallback is never mislabelled.

The configured model name is resolved against the tags Ollama reports. For example,
`ASTA_OLLAMA_MODEL=llama3.2` uses an installed `llama3.2:3b` tag instead of failing on the missing
`llama3.2:latest`. If nothing matches, health reports the model as unavailable and names the tags
that are installed.

To use a real local model:

```bash
ollama serve
ollama pull llama3.2
```

Set the model **on the server only**:

```env
ASTA_PROVIDER_MODE=auto        # or "ollama" to forbid demo fallback
ASTA_OLLAMA_BASE_URL=http://127.0.0.1:11434
ASTA_OLLAMA_MODEL=your-model
ASTA_ALLOW_DEMO_PROVIDER=true
```

Model names and provider secrets never reach the browser.

---

## Tests

Backend (uses an isolated temporary SQLite database and forces the demo provider):

```bash
cd services/api
python -m pytest
```

Frontend:

```bash
cd apps/web
npm run typecheck
npm run build
```

The test suite covers authentication, the twelve-agent registry, capability honesty, SSE streaming
and persistence, knowledge upload/search/delete, memory approval, task planning, preferences,
procedural media generation, the code-execution endpoint, and the webhook approval flow (OAuth
connection attempts still assert the explicit `501` behaviour).

---

## Docker

```bash
docker compose up --build
```

- Web UI: <http://localhost:8080>
- API: <http://localhost:8000>
- Persistent SQLite/uploads: named volume `asta-data`
- Ollama is **not** bundled. Point the API at a host or sidecar instance with
  `ASTA_OLLAMA_BASE_URL`; containers on Linux may need `http://host.docker.internal:11434`.

Provide a real `ASTA_SECRET_KEY` in the environment before exposing the stack.

---

## Repository layout

```
.
├─ apps/web/                 React + TypeScript + Vite + Tailwind + Framer Motion
│  ├─ src/components/        brand, chat, common, grimoire, layout
│  ├─ src/pages/             dashboard, chat, agents, tasks, knowledge, memory, settings…
│  ├─ src/lib/               typed API client, SSE parser, nav, utilities
│  └─ src/styles/            design system and markdown prose
├─ services/api/             FastAPI application
│  ├─ app/agents/            specialist implementations
│  ├─ app/ai/                provider contract, Ollama, demo composer, router
│  ├─ app/api/v1/            REST routers
│  ├─ app/orchestration/     Brain, registry, dispatcher
│  ├─ app/database/          SQLAlchemy models, session, seed
│  └─ tests/                 end-to-end API tests
├─ docs/                     architecture, API, operations and design system
├─ scripts/                  development helpers
├─ data/                     runtime SQLite database and uploads (git-ignored)
├─ .env.example
└─ docker-compose.yml
```

---

## Security and privacy posture

- Passwords are hashed with PBKDF2; tokens are HMAC-signed and backed by revocable
  `user_sessions` rows.
- Every conversation, task, document and memory query is filtered by user ID in the database query,
  not by prompt instructions.
- Uploaded documents are parsed locally by the API.
- Consequential actions require explicit approval and produce audit records.
- Rate limits are enforced per account/IP. This single-instance build uses in-memory counters;
  Redis is the documented upgrade path.
- Child accounts require a guardian email at registration and are **not** safety-certified in this
  release.
- This build does not claim end-to-end encryption, third-party security certification, or
  organisation-grade SSO.

---

## Known limitations

- Schema bootstrap uses `Base.metadata.create_all` on startup. Alembic is not configured yet; see
  [`docs/operations.md`](docs/operations.md#schema-migrations) for the explicit migration path.
- Email, calendar, cloud-storage and project/developer OAuth connectors remain catalogued but
  unavailable; connect attempts return `501` until server-side OAuth apps and secrets exist. Custom
  webhooks are live and approval-gated.
- Image and motion generation are original procedural SVG synthesis. They are not diffusion or
  generative-video models and do not claim to be.
- Sandboxed code uses a short-lived local Python subprocess with a timeout, stripped environment and
  capped output. It is **not** a hardened security sandbox; replace it with a disposable container or
  microVM before exposing the API publicly.
- Web research uses DuckDuckGo's public HTML endpoint with a Wikipedia fallback (or SearXNG when
  configured). Fetched external text is treated as untrusted data; verify sources before relying on
  them. Webhook destinations are user-configured, so restrict outbound network access in production.
- Conversation search matches titles, tasks, memories and document chunks; full message-body search
  is not enabled.
- Guest accounts cannot be upgraded in place; register a permanent account instead.
- Interface translations are partial; missing strings fall back to English.
- Rate limiting is per process, not distributed.

---

## Design

The visual language is original and Black Clover–inspired without using copyrighted assets: obsidian
and ash surfaces, crimson/ember accents, antique gold rules, an original five-leaf emblem, Cinzel
display type, Inter body text and JetBrains Mono for code. Motion is purposeful and fully reducible;
the palette and components are documented in [`docs/design-system.md`](docs/design-system.md).

---

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Operations and deployment](docs/operations.md)
- [Design system](docs/design-system.md)

ASTA · Your intelligence. Your possibilities. The magic is in the experience; the engineering is real.
