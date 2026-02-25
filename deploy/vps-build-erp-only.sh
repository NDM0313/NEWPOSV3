#!/bin/bash
# Build and restart ONLY the ERP container (web + mobile at /m/). Skip studio-injector.
# Use when full deploy fails (e.g. TLS timeout on python image) or you only need frontend update.
# Run on VPS: cd ~/NEWPOSV3 && bash deploy/vps-build-erp-only.sh
set -e
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO_ROOT"

echo "[erp-only] Pulling latest..."
git fetch origin main 2>/dev/null || true
git pull origin main 2>/dev/null || true

[ -f .env.production ] || { echo "Missing .env.production. Run full deploy once: bash deploy/deploy.sh"; exit 1; }
source .env.production 2>/dev/null || true
export CACHEBUST="${CACHEBUST:-$(date +%s)}"

echo "[erp-only] Building only ERP image (CACHEBUST=$CACHEBUST)..."
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production build --no-cache erp

echo "[erp-only] Restarting erp-frontend (force-recreate)..."
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --force-recreate erp

echo "[erp-only] Done. Hard refresh https://erp.dincouture.pk/m/ (Ctrl+Shift+R) to see new login page."
