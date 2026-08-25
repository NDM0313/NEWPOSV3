#!/bin/bash
set -euo pipefail
cd /root/NEWPOSV3-phase-15-validate
POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' /root/supabase/docker/.env | cut -d= -f2- | tr -d '\r"')
export UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1 UNIFIED_LEDGER_TIEOUT_STAGING=1
export CLONE_DB=ledger_stage_20260623
export DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@172.19.0.15:5432/${CLONE_DB}"

APPROVED=$(ls -t reports/single-core-ledger/branch-manual-review-approved-*.json | head -1)
echo "Applying manifest: $APPROVED"
REMEDIATION_APPLY_CONFIRM=1 node scripts/ledger-remediation/apply-manual-branch-assignment-clone.mjs \
  --approved-manifest "$APPROVED" \
  --expected-count 6

bash scripts/ledger-remediation/run-gate-a-clone-only.sh
