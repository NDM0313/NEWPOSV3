#!/usr/bin/env bash
# Run Phase 1.5 validation on VPS isolated clone (never touches live `postgres` DB).
#
# Usage on VPS:
#   bash scripts/single-core-ledger/run-vps-clone-validation.sh
#
set -euo pipefail

CLONE_DB="${CLONE_DB:-ledger_stage_20260623}"
REPO_DIR="${REPO_DIR:-/root/NEWPOSV3-phase-15-validate}"
BRANCH="${BRANCH:-feature/single-core-ledger-phase-1-5-systemwide}"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"

echo "=== Single Core Ledger — VPS clone validation ==="
echo "Clone DB: $CLONE_DB"
echo "Repo:     $REPO_DIR"
echo "Branch:   $BRANCH"
echo ""

if [[ ! -f "$SUPABASE_ENV" ]]; then
  echo "ERROR: missing $SUPABASE_ENV" >&2
  exit 1
fi

# shellcheck disable=SC1090
set +u
source "$SUPABASE_ENV"
set -u
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "ERROR: POSTGRES_PASSWORD not set in $SUPABASE_ENV" >&2
  exit 1
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone --depth 1 -b "$BRANCH" https://github.com/NDM0313/NEWPOSV3.git "$REPO_DIR" || {
    mkdir -p "$(dirname "$REPO_DIR")"
    git clone https://github.com/NDM0313/NEWPOSV3.git "$REPO_DIR"
    cd "$REPO_DIR" && git checkout "$BRANCH"
  }
fi

cd "$REPO_DIR"
git fetch origin "$BRANCH" 2>/dev/null || true
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull --ff-only origin "$BRANCH" 2>/dev/null || true

bash scripts/single-core-ledger/create-vps-ledger-clone.sh

export UNIFIED_LEDGER_STAGING=1
export UNIFIED_LEDGER_VPS_CLONE=1
export UNIFIED_LEDGER_PG_ONLY=1
export UNIFIED_LEDGER_TIEOUT_STAGING=1
export DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/${CLONE_DB}"

echo ""
echo "--- Masked target ---"
echo "DB host: 127.0.0.1"
echo "Database: $CLONE_DB"
echo "NOT production database: postgres"
echo "---------------------"
echo ""

npm install --omit=dev 2>/dev/null || npm install

node scripts/apply-unified-ledger-phase-15-migrations.mjs

echo ""
echo "=== RPC verification ==="
docker cp scripts/single-core-ledger/verify-phase-15-rpcs.sql supabase-db:/tmp/verify-phase-15-rpcs.sql
docker exec supabase-db psql -U postgres -d "$CLONE_DB" -f /tmp/verify-phase-15-rpcs.sql

node scripts/run-single-core-ledger-diagnostics.mjs --write-report
node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report

echo ""
echo "Validation complete. Reports under docs/accounting/ and reports/single-core-ledger/"
