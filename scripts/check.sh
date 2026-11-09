#!/usr/bin/env bash
# Run the full local verification suite (macOS / Linux).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Backend tests..."
(cd "$root/services/api" && python -m pytest)

echo "Frontend typecheck..."
(cd "$root/apps/web" && npm run typecheck)

echo "Frontend production build..."
(cd "$root/apps/web" && npm run build)

echo "All checks passed."
