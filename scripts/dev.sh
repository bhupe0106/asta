#!/usr/bin/env bash
# Development helper for macOS / Linux.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$root/.env" ]]; then
  cp "$root/.env.example" "$root/.env"
  echo "Created .env from .env.example. Replace ASTA_SECRET_KEY before production."
fi

if [[ ! -d "$root/apps/web/node_modules" ]]; then
  echo "Installing web dependencies..."
  (cd "$root/apps/web" && npm install)
fi

echo "Starting ASTA API on http://127.0.0.1:8000"
(cd "$root/services/api" && python -m uvicorn app.main:app --reload --port 8000) &
api_pid=$!

echo "Starting ASTA web on http://localhost:5173"
(cd "$root/apps/web" && npm run dev) &
web_pid=$!

cleanup() {
  kill "$api_pid" "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
