#!/usr/bin/env bash
# Git push + VPS deploy in one command.
# Usage: ./scripts/git-push-and-deploy.sh [commit-message]
#        ./scripts/git-push-and-deploy.sh   (auto message from changes)

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BRANCH="${BRANCH:-$(git branch --show-current)}"
MSG="${1:-ERP: updates $(date +%Y-%m-%d)}"
SSH_HOST="${SSH_HOST:-dincouture-vps}"
VPS_PROJECT="${VPS_PROJECT:-/root/NEWPOSV3}"

echo "=== 1. Git add + commit + push ==="
git add .
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$MSG"
  git push origin "$BRANCH"
  echo "[OK] Pushed to origin/$BRANCH"
fi

echo ""
echo "=== 2. VPS deploy (SSH) ==="
for attempt in 1 2 3; do
  if ssh "$SSH_HOST" "cd $VPS_PROJECT && git fetch origin main 2>/dev/null; git reset --hard origin/main 2>/dev/null; bash deploy/deploy.sh"; then
    echo "[OK] VPS deploy complete"
    exit 0
  fi
  echo "[Retry $attempt/3] VPS unreachable or deploy failed. Waiting 10s..."
  sleep 10
done
echo "[ERROR] VPS deploy failed after 3 attempts"
exit 1
