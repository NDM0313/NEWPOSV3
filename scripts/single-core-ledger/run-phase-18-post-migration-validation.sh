#!/usr/bin/env bash
# Phase 1.8 — Formal post-migration Gate A revalidation (clone only; production read-only dump).
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/NEWPOSV3}"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
CLONE_DB="${CLONE_DB:-ledger_stage_$(date +%Y%m%d)_prodcheck}"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"

echo "=== Phase 1.8 post-migration validation ==="
echo "Clone DB: $CLONE_DB"
echo "Repo:     $REPO_DIR"
echo ""

cd "$REPO_DIR"

POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' "$SUPABASE_ENV" | cut -d= -f2- | tr -d '\r"')
export UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1 UNIFIED_LEDGER_TIEOUT_STAGING=1
export CLONE_DB DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@172.19.0.15:5432/${CLONE_DB}"

echo "--- Step 1: Fresh clone from production postgres (read-only source) ---"
RECREATE=1 CLONE_DB="$CLONE_DB" bash scripts/single-core-ledger/create-vps-ledger-clone.sh

echo "--- Step 2: Read-only remediation inventory ---"
node scripts/ledger-remediation/inventory-diagnostic-failures.mjs

echo "--- Step 3: Gate A diagnostics + tie-out ---"
REPO_DIR="$REPO_DIR" CLONE_DB="$CLONE_DB" bash scripts/ledger-remediation/run-gate-a-clone-only.sh

echo ""
echo "Phase 1.8 clone validation complete. Production postgres NOT mutated."
echo "CLONE_DB=$CLONE_DB"
