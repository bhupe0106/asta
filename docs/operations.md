# Operations

## Configuration

Copy [`.env.example`](../.env.example) to `.env` at the repository root. The server reads `.env` from
the repo root and from `services/api/.env`. Environment variables use the `ASTA_` prefix.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ASTA_ENVIRONMENT` | `development` | `development`, `test` or `production` |
| `ASTA_SECRET_KEY` | dev-only placeholder | HMAC key for bearer tokens. **Must be replaced in production.** |
| `ASTA_ACCESS_TOKEN_MINUTES` | `10080` | Session lifetime (7 days) |
| `ASTA_DATABASE_URL` | repo `data/asta.db` | SQLAlchemy URL. PostgreSQL is the scale target. |
| `ASTA_CORS_ORIGINS` | local Vite origins | Comma-separated allowed browser origins |
| `ASTA_PROVIDER_MODE` | `auto` | `auto`, `ollama` or `demo` |
| `ASTA_OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama endpoint |
| `ASTA_OLLAMA_MODEL` | `llama3.2` | Configured model name; resolved to an installed tag, server-side only |
| `ASTA_ALLOW_DEMO_PROVIDER` | `true` | Permit deterministic fallback |
| `ASTA_SEARCH_PROVIDER` | `duckduckgo` | `duckduckgo`, `wikipedia`, `searxng` or `disabled` |
| `ASTA_SEARXNG_URL` | empty | SearXNG JSON endpoint (when that provider is selected) |
| `ASTA_SANDBOX_ENABLED` | `true` | Master switch for code execution; set `false` on public deployments |
| `ASTA_SANDBOX_TIMEOUT_SECONDS` | `10` | Best-effort code execution timeout |
| `ASTA_SANDBOX_MAX_OUTPUT_CHARS` | `8000` | Per-stream stdout/stderr cap |
| `ASTA_MEDIA_DIR` | `./data/media` | Generated procedural SVG files, resolved against the repo root |
| `ASTA_UPLOAD_DIR` | `./data/uploads` | Upload directory, resolved against the repo root |
| `ASTA_MAX_UPLOAD_MB` | `20` | Per-file size limit |
| `ASTA_ENABLE_REGISTRATION` | `true` | Disable to close public registration and guest access |

### Production checklist

1. Generate a strong secret:
   `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2. Set `ASTA_ENVIRONMENT=production`, a real database URL, and explicit CORS origins.
3. Decide whether demo fallback is acceptable. Set `ASTA_ALLOW_DEMO_PROVIDER=false` if every
   response must come from a real model.
4. Put the API behind TLS (reverse proxy) and serve the built SPA from the same origin so cookies,
   CORS and relative API paths stay simple.
5. Restrict inbound access to `/health` and the API; do not expose the database port.
6. Mount the upload directory on durable storage with backups.
7. Replace the best-effort local code runner with a disposable container or microVM before untrusted
   users can execute code. The subprocess boundary is not a hardened sandbox.
8. Constrain outbound network access: web research fetches public pages and approval-gated webhooks
   call user-supplied endpoints.
9. Review the child-account policy. This release is **not** safety-certified for children.

## Schema migrations

This build bootstraps the schema with `Base.metadata.create_all` during application startup, then runs
idempotent seed data. This is convenient for local development but is **not** a production migration
strategy.

The documented path to migrations:

1. Add Alembic to the API environment:
   `pip install alembic==1.14.0` (pin in `requirements.txt`).
2. Initialise it in `services/api` with `alembic init migrations` and point
   `sqlalchemy.url` at `ASTA_DATABASE_URL`.
3. Import `app.database.models.Base` in `migrations/env.py` and set
   `target_metadata = Base.metadata`.
4. Generate the baseline:
   `alembic revision --autogenerate -m "baseline"`.
5. Run `alembic upgrade head` as a deployment step and remove the `create_all` call (or guard it to
   `development` only).
6. Never edit an applied migration; add a new revision for every schema change.

Until then, treat schema changes as breaking and recreate the development database.

## Backups

- SQLite: stop writes (or use the SQLite backup API), copy `data/asta.db` plus `data/uploads/`.
  WAL mode means copying only the `.db` while running can miss recent commits.
- PostgreSQL: use `pg_dump`/`pg_restore`; include the upload directory separately.
- Back up the secret key separately. Losing it invalidates every session.

## Scaling notes

The API is stateless except for:

- **Rate limiting** — in-memory, per process. Move to Redis before running multiple workers.
- **Model health cache** — in-memory, 10-second TTL. Harmless across workers.
- **Uploads** — local disk. Use object storage for multi-instance deployments.
- **SQLite** — single-writer. Use PostgreSQL under real concurrency.

Streaming uses Server-Sent Events. If a reverse proxy sits in front, disable buffering for
`/api/v1/conversations/*/messages/stream` (`proxy_buffering off` in nginx; the API already sends
`X-Accel-Buffering: no`). Keep read timeouts above the model timeout (`ASTA_REQUEST_TIMEOUT_SECONDS`,
default 120 s).

## Docker

```bash
docker compose up --build
```

The compose file builds:

- `api` — Python 3.12 slim, runs Uvicorn on 8000, stores SQLite and uploads in `/data`.
- `web` — multi-stage Node build served by nginx on port 80 (mapped to 8080), proxying `/api` and
  `/health` to `api:8000`.

Set `ASTA_SECRET_KEY` in the environment before exposing the stack. Ollama is not bundled; point
`ASTA_OLLAMA_BASE_URL` at a reachable instance.

## Render

The API image is at `services/api/Dockerfile`; the frontend is a static Vite build.

**API — Web Service (Docker)**

- Dockerfile path `services/api/Dockerfile`, context `services/api`.
- Health check path `/health`. The container honours Render's `PORT`.
- Attach a persistent disk at `/data` (disks require a paid instance type). Without it, SQLite,
  uploads and generated media are lost on every deploy or restart.
- Environment: `ASTA_ENVIRONMENT=production`, a generated `ASTA_SECRET_KEY`,
  `ASTA_DATABASE_URL=sqlite:////data/asta.db`, `ASTA_UPLOAD_DIR=/data/uploads`,
  `ASTA_MEDIA_DIR=/data/media`, `ASTA_PROVIDER_MODE=demo` (or `ollama` with a reachable HTTPS
  endpoint), `ASTA_SEARCH_PROVIDER=duckduckgo`,
  `ASTA_CORS_ORIGINS=https://<frontend-host>`, and `ASTA_SANDBOX_ENABLED=false` for a public
  deployment.
- Render cannot reach Ollama on your machine. Either use the labelled demo composer or expose an
  authenticated Ollama instance elsewhere and set `ASTA_OLLAMA_BASE_URL`.

**Frontend — Static Site**

- Root directory `apps/web`, build `npm ci && npm run build`, publish `dist`.
- Set `VITE_API_BASE_URL=https://<api-host>/api/v1` before building; it is baked into the bundle.
- Add a rewrite `/*` → `/index.html` so client-side routes survive a refresh.
- After the site is live, add its exact origin to the API's `ASTA_CORS_ORIGINS` and redeploy the API.

SQLite on one instance is appropriate for a single-user or small-team deployment. For concurrent
traffic, add `psycopg[binary]` to `requirements.txt` and point `ASTA_DATABASE_URL` at Render
PostgreSQL instead of attaching a disk.

## Health and observability

- `GET /health` returns database status and version. Use it for liveness/readiness.
- Structured request logs include method, path, status and duration; errors include a trace ID that
  matches `X-Trace-Id`.
- Agent executions, task logs and audit tables provide product-level observability.
- Monitor intentionally records status/latency, not conversation content.

## Troubleshooting

**`uvicorn[standard]` fails to install on Python 3.15** — use plain `uvicorn` (already pinned). Python
3.12/3.13 is the recommended runtime.

**UI says “Demo composer”** — no healthy real provider was found. Start `ollama serve`, pull a model,
and set `ASTA_OLLAMA_MODEL`. Check `GET /api/v1/models` for provider details.

**CORS errors in development** — add the exact origin (including port) to `ASTA_CORS_ORIGINS`, or use
the Vite proxy and relative `/api` requests.

**Database seems stale** — confirm which `ASTA_DATABASE_URL` is active; a relative SQLite URL resolves
from the process working directory. The default resolves to `<repo>/data/asta.db`.

**Streaming stops after a proxy** — disable response buffering and raise read timeouts for the SSE
route.

**Integration connect returns 501** — this is intentional. OAuth credentials are not configured; the
UI and API refuse to pretend otherwise.
