#!/usr/bin/env bash
# Gate A only — tie-out re-validation on VPS clone (skip inventory/apply).
set -euo pipefail
REPO_DIR="${REPO_DIR:-/root/NEWPOSV3-phase-15-validate}"
CLONE_DB="${CLONE_DB:-ledger_stage_20260623}"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
cd "$REPO_DIR"
POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' "$SUPABASE_ENV" | cut -d= -f2- | tr -d '\r"')
export UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1 UNIFIED_LEDGER_TIEOUT_STAGING=1
export CLONE_DB DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@172.19.0.15:5432/${CLONE_DB}"
node scripts/run-single-core-ledger-diagnostics.mjs --write-report || true
node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report || true
node scripts/run-unified-ledger-tieout.mjs --write-report || true
echo "Gate A tie-out complete."
