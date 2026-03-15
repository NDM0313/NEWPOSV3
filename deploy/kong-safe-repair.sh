#!/usr/bin/env bash
#
# Kong safe repair: backup kong.yml, fix malformed CORS blocks, restart Kong, verify.
# Idempotent: safe to run multiple times; no-op if kong.yml is already valid.
#
# Standard recovery command:
#   ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/kong-safe-repair.sh"
#
# Run on VPS:  cd /root/NEWPOSV3 && bash deploy/kong-safe-repair.sh
#

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
SUPABASE_DIR="${SUPABASE_DIR:-/root/supabase/docker}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIX_PY="${SCRIPT_DIR}/fix-kong-cors-yaml.py"

echo "=== Kong Safe Repair ==="
echo ""

# 1. Pre-check: kong.yml exists
if [ ! -f "$KONG_YML" ]; then
  echo "[FAIL] kong.yml not found at: $KONG_YML"
  echo "Set KONG_YML or run on VPS where Supabase lives."
  exit 1
fi
echo "[OK] kong.yml: $KONG_YML"

# 2. Backup (always, before any change)
BAK="${KONG_YML}.bak-$(date +%Y%m%d-%H%M%S)"
cp "$KONG_YML" "$BAK"
echo "[OK] Backup: $BAK"

# 3. Check if fix is needed
if [ ! -f "$FIX_PY" ]; then
  echo "[FAIL] fix-kong-cors-yaml.py not found at: $FIX_PY"
  exit 1
fi
if python3 "$FIX_PY" --check-only "$KONG_YML" 2>/dev/null; then
  echo "[OK] No misplaced CORS blocks. kong.yml structure is already valid (idempotent)."
  NEED_FIX=false
else
  NEED_FIX=true
  echo "[INFO] Misplaced CORS config detected. Applying fix..."
fi

# 4. Apply fix if needed
if [ "$NEED_FIX" = true ]; then
  python3 "$FIX_PY" "$KONG_YML" || { echo "[FAIL] Fix script failed."; exit 1; }
  echo "[OK] Fix applied."
else
  echo "[SKIP] No fix applied."
fi

# 5. Restart Kong (so Kong reloads kong.yml; harmless if no change)
if [ ! -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  echo "[WARN] docker-compose.yml not found at $SUPABASE_DIR. Skip restart."
elif ! command -v docker &>/dev/null; then
  echo "[WARN] docker not available. Skip restart."
else
  echo "[INFO] Restarting Kong..."
  (cd "$SUPABASE_DIR" && docker compose restart kong) || { echo "[FAIL] Kong restart failed."; exit 1; }
  echo "[OK] Kong restarted. Waiting 30s for startup..."
  sleep 30
fi

# 6. Verify Kong status
echo ""
echo "--- Verification ---"
if command -v docker &>/dev/null; then
  KONG_STATUS=$(docker ps --format "{{.Names}}\t{{.Status}}" -f name=supabase-kong 2>/dev/null || true)
  echo "$KONG_STATUS"
  if echo "$KONG_STATUS" | grep -q "Restarting"; then
    echo "[WARN] Kong is still in restart loop. Check: docker logs supabase-kong --tail 50"
    exit 1
  fi
  if echo "$KONG_STATUS" | grep -q "Up"; then
    echo "[OK] Kong container is up."
  fi
fi

# 7. Health checks (auth and rest)
if command -v curl &>/dev/null; then
  # Load ANON_KEY from Supabase .env if present
  if [ -f "$SUPABASE_DIR/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$SUPABASE_DIR/.env" 2>/dev/null || true
    set +a
  fi
  if [ -n "${ANON_KEY}" ]; then
    AUTH_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -H "apikey: ${ANON_KEY}" --connect-timeout 10 "https://supabase.dincouture.pk/auth/v1/health" 2>/dev/null || echo "000")
    REST_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -H "apikey: ${ANON_KEY}" -H "Accept: application/json" --connect-timeout 10 "https://supabase.dincouture.pk/rest/v1/" 2>/dev/null || echo "000")
    echo "auth/v1/health: HTTP $AUTH_CODE"
    echo "rest/v1/:      HTTP $REST_CODE"
    if [ "$AUTH_CODE" = "200" ]; then
      echo "[OK] Auth health check passed."
    else
      echo "[WARN] Auth health returned $AUTH_CODE (expected 200)."
    fi
    if [ "$REST_CODE" = "200" ] || [ "$REST_CODE" = "406" ]; then
      echo "[OK] Rest health check passed (200 or 406)."
    else
      echo "[WARN] Rest returned $REST_CODE (expected 200 or 406)."
    fi
  else
    echo "[SKIP] ANON_KEY not set. Set it or source $SUPABASE_DIR/.env to run health checks."
  fi
else
  echo "[SKIP] curl not available for health checks."
fi

echo ""
echo "=== Kong Safe Repair finished ==="
echo "Test login at: https://erp.dincouture.pk"
echo "Rollback if needed: cp $BAK $KONG_YML && cd $SUPABASE_DIR && docker compose restart kong"
