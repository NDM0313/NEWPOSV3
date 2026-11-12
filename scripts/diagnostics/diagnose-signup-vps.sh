#!/bin/bash
# One-shot Create Business signup diagnosis on VPS.
# Usage (on VPS): bash scripts/diagnostics/diagnose-signup-vps.sh
# Usage (from dev machine): Get-Content scripts/diagnostics/diagnose-signup-vps.sh -Raw | ssh dincouture-vps "sed 's/\r$//' | bash -s"
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/root/NEWPOSV3}"
ENV_FILE="${SUPABASE_ENV:-/root/supabase/docker/.env}"
BASE="${BASE_URL:-https://supabase.dincouture.pk}"
PROBE_EMAIL="${PROBE_EMAIL:-}"

echo "========== Signup diagnosis ($(date -u +%Y-%m-%dT%H:%M:%SZ)) =========="

if [ -f "$REPO_ROOT/scripts/diagnostics/signup_diagnose.sql" ]; then
  echo ""
  echo "=== SQL: auth state, orphans, triggers, RPC ==="
  docker exec -i supabase-db psql -U postgres -d postgres < "$REPO_ROOT/scripts/diagnostics/signup_diagnose.sql"
else
  echo "WARN: $REPO_ROOT/scripts/diagnostics/signup_diagnose.sql not found — skipping SQL block"
fi

if [ -f "$REPO_ROOT/scripts/diagnostics/diagnose-signup-curl.sh" ]; then
  echo ""
  bash "$REPO_ROOT/scripts/diagnostics/diagnose-signup-curl.sh"
else
  echo "WARN: diagnose-signup-curl.sh not found — run curl probe manually"
fi

echo ""
echo "=== Optional: check specific email (PROBE_EMAIL=you@mail.com) ==="
if [ -n "$PROBE_EMAIL" ]; then
  docker exec supabase-db psql -U postgres -d postgres -c \
    "SELECT id, email, created_at FROM auth.users WHERE LOWER(email) = LOWER('$PROBE_EMAIL');"
fi

echo ""
echo "Done. If fresh probe signup returns HTTP 200 but the app fails, check local VITE_SUPABASE_ANON_KEY (bash scripts/sync-local-env-from-vps.sh)."
