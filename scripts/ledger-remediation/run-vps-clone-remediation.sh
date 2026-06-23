#!/usr/bin/env bash
# Phase 1.6 — full remediation cycle on VPS clone (never touches live postgres).
#
# Usage on VPS:
#   bash scripts/ledger-remediation/run-vps-clone-remediation.sh
#
set -euo pipefail

CLONE_DB="${CLONE_DB:-ledger_stage_20260623}"
REPO_DIR="${REPO_DIR:-/root/NEWPOSV3-phase-15-validate}"
BRANCH="${BRANCH:-feature/single-core-ledger-phase-1-6-remediation}"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"

echo "=== Phase 1.6 — VPS clone remediation ==="
echo "Clone DB: $CLONE_DB"
echo "Repo:     $REPO_DIR"
echo "Branch:   $BRANCH"
echo ""

if [[ ! -f "$SUPABASE_ENV" ]]; then
  echo "ERROR: missing $SUPABASE_ENV" >&2
  exit 1
fi

set +u
POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' "$SUPABASE_ENV" | cut -d= -f2- | tr -d '\r"')
set -u
if [[ -z "$POSTGRES_PASSWORD" ]]; then
  echo "ERROR: POSTGRES_PASSWORD not set" >&2
  exit 1
fi

cd "$REPO_DIR"
git fetch origin "$BRANCH" 2>/dev/null || true
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull --ff-only origin "$BRANCH" 2>/dev/null || true

export UNIFIED_LEDGER_STAGING=1
export UNIFIED_LEDGER_VPS_CLONE=1
export UNIFIED_LEDGER_PG_ONLY=1
export UNIFIED_LEDGER_TIEOUT_STAGING=1
export CLONE_DB="$CLONE_DB"
export DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@172.19.0.15:5432/${CLONE_DB}"

echo ""
echo "--- Bundle 1: inventory ---"
node scripts/ledger-remediation/inventory-diagnostic-failures.mjs

echo ""
echo "--- Bundle 2: dry-run summary ---"
node scripts/ledger-remediation/dry-run-single-core-remediation-summary.mjs
DRY_RUN=$(ls -t "$REPO_DIR/reports/single-core-ledger/remediation-dry-run-"*.json | head -1)
echo "Dry-run file: $DRY_RUN"

PAY_SAFE=$(node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const rows=j.sections?.payment_contact?.rows??j.payment_contact?.rows??[]; console.log(rows.filter(r=>r.safe_apply).length);" "$DRY_RUN")
BR_SAFE=$(node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const rows=j.sections?.branch_attribution?.rows??j.branch_attribution?.rows??[]; console.log(rows.filter(r=>r.safe_apply).length);" "$DRY_RUN")
echo "Payment safe_apply: $PAY_SAFE"
echo "Branch safe_apply: $BR_SAFE"

echo ""
echo "--- Bundle 3: clone apply ---"
export REMEDIATION_APPLY_CONFIRM=1
if [[ "$PAY_SAFE" -gt 0 ]]; then
  node scripts/ledger-remediation/apply-payment-contact-backfill-clone.mjs \
    --dry-run-file "$DRY_RUN" \
    --expected-safe-count "$PAY_SAFE"
else
  echo "Skipping payment apply (0 safe_apply rows — already backfilled or none)"
fi

if [[ "$BR_SAFE" -gt 0 ]]; then
  node scripts/ledger-remediation/apply-branch-attribution-clone.mjs \
    --dry-run-file "$DRY_RUN" \
    --expected-safe-count "$BR_SAFE"
else
  echo "Skipping branch apply (0 safe_apply rows)"
fi

echo ""
echo "--- Bundle 4: Gate A re-validation ---"
node scripts/run-single-core-ledger-diagnostics.mjs --write-report
node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report
node scripts/run-unified-ledger-tieout.mjs --write-report

echo ""
echo "Phase 1.6 clone remediation complete."
