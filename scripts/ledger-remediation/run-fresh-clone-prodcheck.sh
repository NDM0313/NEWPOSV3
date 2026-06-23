#!/usr/bin/env bash
# Phase 1.6.2 — fresh clone prodcheck: clone → Phase 1.5 → 1.6 → 1.6.1 → Gate A → approval manifest
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/NEWPOSV3-phase-15-validate}"
BRANCH="${BRANCH:-feature/single-core-ledger-phase-1-6-2-production-approval}"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
CLONE_DB="${CLONE_DB:-ledger_stage_$(date +%Y%m%d)_prodcheck}"
BASELINE_INVENTORY="${BASELINE_INVENTORY:-}"

echo "=== Phase 1.6.2 — Fresh clone prodcheck ==="
echo "Clone DB: $CLONE_DB"
echo "Repo:     $REPO_DIR"
echo ""

cd "$REPO_DIR"
git fetch origin "$BRANCH" 2>/dev/null || true
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull --ff-only origin "$BRANCH" 2>/dev/null || true

POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' "$SUPABASE_ENV" | cut -d= -f2- | tr -d '\r"')
export UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 UNIFIED_LEDGER_PG_ONLY=1 UNIFIED_LEDGER_TIEOUT_STAGING=1
export CLONE_DB DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@172.19.0.15:5432/${CLONE_DB}"

echo "--- Step 1: Fresh clone from production postgres ---"
RECREATE=1 CLONE_DB="$CLONE_DB" bash scripts/single-core-ledger/create-vps-ledger-clone.sh

echo "--- Step 2: Phase 1.5 migrations on fresh clone ---"
CLONE_DB="$CLONE_DB" bash scripts/single-core-ledger/apply-phase-15-docker-exec.sh

echo "--- Step 3: Pre-apply inventory (read-only) ---"
node scripts/ledger-remediation/inventory-diagnostic-failures.mjs
PRE_INVENTORY=$(ls -t reports/single-core-ledger/remediation-inventory-*.json | head -1)
node scripts/ledger-remediation/inventory-branch-manual-review.mjs
node scripts/ledger-remediation/dry-run-single-core-remediation-summary.mjs
PRE_DRY_RUN=$(ls -t reports/single-core-ledger/remediation-dry-run-*.json | head -1)

echo "--- Step 4: Compare with baseline ---"
BASELINE="${BASELINE_INVENTORY:-$(ls -t reports/single-core-ledger/remediation-inventory-2026-06-23*.json 2>/dev/null | head -1 || echo "")}"
if [[ -n "$BASELINE" && -f "$BASELINE" ]]; then
  node scripts/ledger-remediation/compare-fresh-clone-baseline.mjs \
    --baseline-inventory "$BASELINE" \
    --fresh-inventory "$PRE_INVENTORY" || true
else
  echo "No baseline inventory found — skip comparison (set BASELINE_INVENTORY)"
fi

echo "--- Step 5: Phase 1.6 clone remediation ---"
CLONE_DB="$CLONE_DB" bash scripts/ledger-remediation/run-vps-clone-remediation.sh || {
  PAY_SAFE=$(node -e "const j=JSON.parse(require('fs').readFileSync('$PRE_DRY_RUN','utf8')); const r=j.sections?.payment_contact?.rows??[]; console.log(r.filter(x=>x.safe_apply).length)")
  if [[ "$PAY_SAFE" -gt 0 ]]; then
    export REMEDIATION_APPLY_CONFIRM=1
    node scripts/ledger-remediation/apply-payment-contact-backfill-clone.mjs \
      --dry-run-file "$PRE_DRY_RUN" --expected-safe-count "$PAY_SAFE"
  fi
}

echo "--- Step 6: Phase 1.6.1 branch cycle ---"
CLONE_DB="$CLONE_DB" SKIP_APPLY=0 bash scripts/ledger-remediation/run-phase-161-clone-cycle.sh

echo "--- Step 7: Gate A ---"
bash scripts/ledger-remediation/run-gate-a-clone-only.sh

echo "--- Step 8: Production approval manifest (proposal only) ---"
COMPARISON=$(ls -t reports/single-core-ledger/fresh-clone-comparison-*.json 2>/dev/null | head -1 || echo "")
BRANCH_MANIFEST=$(ls -t reports/single-core-ledger/branch-manual-review-approved-*.json | head -1)
node scripts/ledger-remediation/export-production-remediation-approval-manifest.mjs \
  --dry-run-file "$PRE_DRY_RUN" \
  ${BRANCH_MANIFEST:+--branch-manifest "$BRANCH_MANIFEST"} \
  ${COMPARISON:+--comparison-file "$COMPARISON"}

echo ""
echo "Phase 1.6.2 prodcheck complete. Production postgres NOT mutated."
