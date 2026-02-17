#!/bin/bash
# Rebuild and restart ERP on VPS (no npm on host needed – build runs inside Docker).
# Run from project root on VPS: bash deploy/vps-rebuild.sh
# Make sure .env.production exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

set -e
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

echo "[1/4] Project root: $PROJECT_ROOT"

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Create it with:"
  echo "  VITE_SUPABASE_URL=https://erp.dincouture.pk"
  echo "  VITE_SUPABASE_ANON_KEY=<your-anon-key>"
  exit 1
fi

echo "[2/4] Pulling latest code (if git repo)..."
if git rev-parse --git-dir >/dev/null 2>&1; then
  git pull --rebase || true
else
  echo "  (not a git repo, skipping pull)"
fi

echo "[3/4] Building and starting containers..."
docker compose -f deploy/docker-compose.prod.yml --project-directory "$PROJECT_ROOT" --env-file .env.production up -d --build

echo "[4/4] Done. App should be live. Hard-refresh browser (Ctrl+Shift+R) to avoid cache."
