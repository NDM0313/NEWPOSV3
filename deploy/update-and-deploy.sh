#!/bin/bash
# Run once on VPS when git pull fails due to local changes. Then use deploy/deploy.sh.
# cd /root/NEWPOSV3 && bash deploy/update-and-deploy.sh
set -e
cd "$(dirname "$0")/.."
git fetch origin main 2>/dev/null || true
git reset --hard origin/main 2>/dev/null || true
bash deploy/deploy.sh
