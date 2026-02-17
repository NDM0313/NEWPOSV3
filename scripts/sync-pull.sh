#!/usr/bin/env bash
# Sync only – pull from GitHub (no push)
# Usage: bash scripts/sync-pull.sh

set -e
BRANCH="${1:-before-mobile-replace}"
git fetch origin
git pull origin "$BRANCH"
