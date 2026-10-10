#!/bin/bash
set -euo pipefail
export UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1 UNIFIED_LEDGER_TIEOUT_STAGING=1
POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' /root/supabase/docker/.env | cut -d= -f2- | tr -d '\r"')
export DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@172.19.0.15:5432/ledger_stage_20260623"
cd /root/NEWPOSV3-phase-15-validate
node scripts/run-unified-ledger-tieout.mjs --write-report
