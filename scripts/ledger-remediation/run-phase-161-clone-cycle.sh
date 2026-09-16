#!/usr/bin/env bash
# Phase 1.6.1 full clone cycle: inventory → manifest → (optional apply) → Gate A
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/NEWPOSV3-phase-15-validate}"
CLONE_DB="${CLONE_DB:-ledger_stage_20260623}"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
SKIP_APPLY="${SKIP_APPLY:-0}"

cd "$REPO_DIR"
POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' "$SUPABASE_ENV" | cut -d= -f2- | tr -d '\r"')
export UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1 UNIFIED_LEDGER_TIEOUT_STAGING=1
export CLONE_DB DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@172.19.0.15:5432/${CLONE_DB}"

echo "=== Phase 1.6.1 — branch manual review inventory ==="
node scripts/ledger-remediation/inventory-branch-manual-review.mjs

echo "=== Phase 1.6.1 — export manifest ==="
node scripts/ledger-remediation/export-branch-manual-review-manifest.mjs

if [[ "$SKIP_APPLY" != "1" ]]; then
  echo "=== Phase 1.6.1 — prepare approved manifest (safe_recommendation only) ==="
  if [[ -f scripts/ledger-remediation/clone-operator-branch-decisions.example.json ]]; then
    node scripts/ledger-remediation/prepare-operator-branch-manifest.mjs
  else
    node scripts/ledger-remediation/prepare-approved-branch-manifest.mjs
  fi

  APPROVED=$(ls -t reports/single-core-ledger/branch-manual-review-approved-*.json 2>/dev/null | head -1)
  if [[ -n "$APPROVED" ]]; then
    APPROVED_COUNT=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log((m.rows||[]).filter(r=>r.operator_decision==='approve').length)" "$APPROVED")
    if [[ "$APPROVED_COUNT" -gt 0 ]]; then
      echo "=== Phase 1.6.1 — apply $APPROVED_COUNT approved branch assignments ==="
      REMEDIATION_APPLY_CONFIRM=1 node scripts/ledger-remediation/apply-manual-branch-assignment-clone.mjs \
        --approved-manifest "$APPROVED" \
        --expected-count "$APPROVED_COUNT"
    else
      echo "No auto-approved rows; manual finance manifest required before apply."
    fi
  fi
fi

echo "=== Phase 1.6.1 — Gate A re-validation ==="
bash scripts/ledger-remediation/run-gate-a-clone-only.sh

echo "Phase 1.6.1 cycle complete."
