#!/bin/bash
# VPS cron: conditional auto-pull + deploy once daily (recommended 8:00 PM PKT = 15:00 UTC).
# Run: crontab -e  then add:
#   0 15 * * * /root/NEWPOSV3/deploy/vps-auto-pull-cron.sh >> /var/log/newposv3-auto-deploy.log 2>&1
# Manual full rebuild: DEPLOY_NO_CACHE=1 bash deploy/deploy.sh
# Requires: git, deploy/deploy.sh
#
# Exits 0 immediately when origin/main matches local HEAD (no Docker build).

set -e
LOCK_FILE="/var/lock/newposv3-deploy.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date)] Auto-pull skipped: deploy already running (lock $LOCK_FILE)"
  exit 0
fi

cd /root/NEWPOSV3
BRANCH="${BRANCH:-main}"

# Fetch and check if remote changed
git fetch origin "$BRANCH" 2>/dev/null || exit 0
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

# Pull and deploy (cached Docker build unless DEPLOY_NO_CACHE=1)
echo "[$(date)] Auto-pull: $BRANCH changed ($LOCAL -> $REMOTE)"
git reset --hard "origin/$BRANCH"
export BRANCH
export DEPLOY_NO_CACHE="${DEPLOY_NO_CACHE:-0}"
bash deploy/deploy.sh
echo "[$(date)] Auto-deploy complete"
