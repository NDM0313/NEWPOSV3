#!/bin/bash
# VPS cron: auto-pull and deploy every N minutes.
# Run: crontab -e  then add:
#   */5 * * * * /root/NEWPOSV3/deploy/vps-auto-pull-cron.sh
# Or: 0 * * * * for hourly.
# Requires: git, deploy/deploy.sh

set -e
cd /root/NEWPOSV3
BRANCH="${BRANCH:-main}"

# Fetch and check if remote changed
git fetch origin "$BRANCH" 2>/dev/null || exit 0
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

# Pull and deploy
echo "[$(date)] Auto-pull: $BRANCH changed ($LOCAL -> $REMOTE)"
git reset --hard "origin/$BRANCH"
export BRANCH
bash deploy/deploy.sh
echo "[$(date)] Auto-deploy complete"
