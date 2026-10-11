#!/usr/bin/env bash
# Rebuild erp-frontend-preview on VPS :3002 from current git ref (no migrations).
# Usage (on VPS or via SSH):
#   BRANCH=cursor/preview-3002-verify-runbook-e9d2 bash scripts/deploy-preview-frontend-vps.sh
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3-preview-qa}"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/NDM0313/NEWPOSV3.git}"

echo "[preview] target=$DEPLOY_DIR branch=$BRANCH"

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR" || git clone "$REPO_URL" "$DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
COMMIT="$(git rev-parse --short HEAD)"
echo "[preview] commit=$COMMIT"

ROLLBACK_TAG="erp-frontend-preview:rollback-before-sidebar-$(date +%Y%m%d%H%M%S)"
docker tag erp-frontend-preview:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[preview] rollback tag (if image existed): $ROLLBACK_TAG"

if [ -f deploy/write-erp-env-from-supabase-docker-env.sh ]; then
  bash deploy/write-erp-env-from-supabase-docker-env.sh
fi

export VITE_BUILD_COMMIT="$COMMIT"
export CACHEBUST
CACHEBUST="$(date +%s)"
export CACHEBUST

if [ -f .env.production ]; then
  grep -v '^CACHEBUST=' .env.production | grep -v '^VITE_BUILD_COMMIT=' > .env.production.tmp || true
  echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
  echo "VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT" >> .env.production.tmp
  mv .env.production.tmp .env.production
fi

# Isolate compose project so we never remove shared deploy_default (prod Traefik/ERP).
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-erp-preview}"
COMPOSE="docker compose -p \"$COMPOSE_PROJECT_NAME\" -f deploy/docker-compose.preview.yml --env-file .env.production"
$COMPOSE build erp-preview

# Recreate only this container; do not prune shared networks.
docker rm -f erp-frontend-preview 2>/dev/null || true
$COMPOSE up -d --no-deps --force-recreate erp-preview


echo "[preview] Health:"
curl -sI http://127.0.0.1:3002/ | head -5 || true
curl -sI http://127.0.0.1:3002/m/ | head -5 || true

# Confirm new bundle contains persistence key string
docker exec erp-frontend-preview sh -c '
  cd /usr/share/nginx/html/assets &&
  if grep -rl "erp_sidebar_open" . >/dev/null 2>&1; then echo "FOUND:erp_sidebar_open"; else echo "MISSING:erp_sidebar_open"; fi
' || true

echo "[preview] DONE — :3002 live. Tunnel: ssh -N -L 3002:127.0.0.1:3002 dincouture-vps"
