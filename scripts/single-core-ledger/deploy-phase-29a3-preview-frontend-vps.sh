#!/bin/bash
# Phase 2.9A-3 — parallel preview frontend deploy (NO migrations, NO feature_flags writes).
# Target: erp-frontend-preview on port 3002 for browser waiver closure via SSH tunnel.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3-preview-qa}"
BRANCH="${BRANCH:-feature/single-core-ledger-phase-2-9-pilot-enablement-plan}"
COMMIT="${COMMIT:-ae646222}"
REPO_URL="${REPO_URL:-https://github.com/NDM0313/NEWPOSV3.git}"

echo "[phase-29a3] target=$DEPLOY_DIR branch=$BRANCH commit=$COMMIT"

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "$COMMIT"

ROLLBACK_TAG="erp-frontend-preview:rollback-before-29a3-$(date +%Y%m%d%H%M%S)"
docker tag erp-frontend-preview:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[phase-29a3] rollback tag (if image existed): $ROLLBACK_TAG"

bash deploy/write-erp-env-from-supabase-docker-env.sh
export VITE_BUILD_COMMIT="$COMMIT"
export CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production 2>/dev/null | grep -v '^VITE_BUILD_COMMIT=' > .env.production.tmp || true
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
echo "VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT" >> .env.production.tmp
mv .env.production.tmp .env.production

COMPOSE="docker compose -f deploy/docker-compose.preview.yml --env-file .env.production"
$COMPOSE build erp-preview

docker rm -f erp-frontend-preview 2>/dev/null || true
$COMPOSE up -d --force-recreate erp-preview

echo "[phase-29a3] Health:"
curl -sI http://127.0.0.1:3002/ | head -3 || true

echo "[phase-29a3] Bundle string check (all assets/*.js):"
docker exec erp-frontend-preview sh -c '
  cd /usr/share/nginx/html/assets &&
  for s in "Unified engine preview" "Load MR JALIL" "phase2-compare-ledger-v2" "unified-ledger-tieout"; do
    if grep -rl "$s" . >/dev/null 2>&1; then echo "FOUND:$s"; else echo "MISSING:$s"; fi
  done
' || true

echo "[phase-29a3] DONE — preview on :3002. Tunnel: ssh -N -L 3002:127.0.0.1:3002 dincouture-vps"
echo "[phase-29a3] unified_ledger_engine / pilot / screen flags: NOT enabled. deploy.sh NOT run."
