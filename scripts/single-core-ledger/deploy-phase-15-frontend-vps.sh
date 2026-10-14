#!/bin/bash
# Isolated VPS frontend deploy for Phase 1.5 branch (no production DB migrations).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3-phase-15-deploy}"
BRANCH="${BRANCH:-feature/single-core-ledger-phase-1-5-systemwide}"
REPO_URL="${REPO_URL:-https://github.com/NDM0313/NEWPOSV3.git}"

echo "[phase-15-deploy] target=$DEPLOY_DIR branch=$BRANCH"

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

ROLLBACK_TAG="deploy-erp:rollback-before-phase15-$(date +%Y%m%d%H%M%S)"
docker tag erp-frontend:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[phase-15-deploy] rollback tag (if image existed): $ROLLBACK_TAG"

export BRANCH RUN_DEPLOY=1
bash deploy/deploy.sh

echo "[phase-15-deploy] DONE — frontend only; unified_ledger_engine remains OFF; postgres Phase 1.5 migrations NOT applied."
