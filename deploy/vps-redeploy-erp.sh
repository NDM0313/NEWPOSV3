#!/bin/bash
# Redeploy ERP on VPS (pull latest code + rebuild + restart).
# Run on VPS from project root, or with REPO_ROOT set:
#   cd /root/NEWPOSV3 && bash deploy/vps-redeploy-erp.sh
# Or: REPO_ROOT=/root/NEWPOSV3 bash deploy/vps-redeploy-erp.sh
#
# Ensures: latest git (including mobile /m/ 404 fix), fresh Docker build, erp-frontend restarted.

set -e
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO_ROOT"

echo "[vps-redeploy] Pulling latest..."
git fetch origin main 2>/dev/null || true
git pull origin main 2>/dev/null || true

echo "[vps-redeploy] Full deploy (build + up)..."
bash deploy/deploy.sh

echo "[vps-redeploy] Done. Check https://erp.dincouture.pk and https://erp.dincouture.pk/m/"
