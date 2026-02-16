#!/usr/bin/env bash
# Run from repo root when scripts/deploy-erp-vps.sh is missing (branch not synced).
# Syncs to origin/before-mobile-replace then runs deploy script.
set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"
git fetch origin
git checkout before-mobile-replace 2>/dev/null || true
git reset --hard origin/before-mobile-replace
exec bash scripts/deploy-erp-vps.sh
