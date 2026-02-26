#!/bin/bash
# VPS auto-deploy script. Place at /root/NEWPOSV3/deploy.sh on VPS.
# Run: bash deploy.sh
# Or from Mac: ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy.sh"

set -e
cd "${DEPLOY_DIR:-/root/NEWPOSV3}"
BRANCH="${BRANCH:-before-mobile-replace}"

echo "=== VPS Deploy $(date) ==="
echo "  Dir: $(pwd)"
echo "  Branch: $BRANCH"
echo ""

# 1. Pull latest
git fetch origin
git checkout "$BRANCH" 2>/dev/null || true
git reset --hard "origin/$BRANCH"
echo "[OK] Git synced"

# 2. Run full deploy (Docker build + up)
bash deploy/deploy.sh
echo "[OK] Deploy complete"

# 3. Verify
echo ""
echo "=== Verification ==="
curl -sI -o /dev/null -w "ERP: %{http_code}\n" --connect-timeout 5 -k https://127.0.0.1/ -H "Host: erp.dincouture.pk" 2>/dev/null || echo "ERP: (check manually)"
echo "Done. Test: https://erp.dincouture.pk"
