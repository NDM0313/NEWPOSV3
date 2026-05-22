#!/usr/bin/env bash
# Read-only audit: GoTrue session settings relevant to counter-tablet PIN longevity.
# Does not modify any files. See docs/infra/COUNTER_SESSION_VPS_AUDIT.md

set -euo pipefail

ENV_FILE="${GOTRUE_ENV_FILE:-/root/supabase/docker/.env}"
PASS=0
WARN=0
FAIL=0

pass() { echo "[PASS] $*"; PASS=$((PASS + 1)); }
warn() { echo "[WARN] $*"; WARN=$((WARN + 1)); }
fail() { echo "[FAIL] $*"; FAIL=$((FAIL + 1)); }

echo "=== Counter session GoTrue audit ==="
echo "Env file: $ENV_FILE"
echo ""

read_env() {
  local key="$1"
  if [[ -f "$ENV_FILE" ]]; then
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
  fi
}

JWT_EXP="$(read_env GOTRUE_JWT_EXP)"
JWT_EXP="${JWT_EXP:-$(read_env JWT_EXPIRY)}"
TIMEBOX="$(read_env GOTRUE_SESSION_TIME_BOX)"
INACTIVITY="$(read_env GOTRUE_SESSION_INACTIVITY_TIMEOUT)"
ROTATION="$(read_env GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED)"

echo "--- Access token (JWT) ---"
if [[ -z "$JWT_EXP" ]]; then
  warn "GOTRUE_JWT_EXP / JWT_EXPIRY not set in $ENV_FILE (GoTrue default ~3600s)"
else
  echo "GOTRUE_JWT_EXP (or JWT_EXPIRY) = $JWT_EXP"
  if [[ "$JWT_EXP" =~ ^[0-9]+$ ]]; then
    if (( JWT_EXP >= 3600 )); then
      pass "Access JWT expiry >= 1 hour ($JWT_EXP s)"
    else
      warn "Access JWT expiry < 1 hour ($JWT_EXP s) — more refresh churn on counter tablets"
    fi
  fi
fi

echo ""
echo "--- Session lifetime caps ---"
if [[ -z "$TIMEBOX" ]]; then
  pass "GOTRUE_SESSION_TIME_BOX unset (no hard session timebox)"
else
  echo "GOTRUE_SESSION_TIME_BOX = $TIMEBOX"
  warn "Session timebox is set — verify duration is >= 7 days for counter tablets"
fi

if [[ -z "$INACTIVITY" ]]; then
  pass "GOTRUE_SESSION_INACTIVITY_TIMEOUT unset"
else
  echo "GOTRUE_SESSION_INACTIVITY_TIMEOUT = $INACTIVITY"
  warn "Inactivity timeout is set — idle tablets may lose refresh tokens"
fi

echo ""
echo "--- Refresh token rotation ---"
if [[ -z "$ROTATION" || "$ROTATION" == "true" ]]; then
  pass "Refresh token rotation enabled (expected) — keep mobile app updated so vault sync runs"
else
  warn "Refresh token rotation disabled or unusual: $ROTATION"
fi

echo ""
echo "--- Auth container (optional) ---"
if command -v docker >/dev/null 2>&1; then
  AUTH_CID="$(docker ps --filter 'name=auth' --format '{{.Names}}' 2>/dev/null | head -1 || true)"
  if [[ -n "$AUTH_CID" ]]; then
    echo "Container: $AUTH_CID"
    docker exec "$AUTH_CID" printenv GOTRUE_JWT_EXP 2>/dev/null | sed 's/^/  GOTRUE_JWT_EXP=/' || true
    docker exec "$AUTH_CID" printenv GOTRUE_SESSION_TIME_BOX 2>/dev/null | sed 's/^/  GOTRUE_SESSION_TIME_BOX=/' || true
    docker exec "$AUTH_CID" printenv GOTRUE_SESSION_INACTIVITY_TIMEOUT 2>/dev/null | sed 's/^/  GOTRUE_SESSION_INACTIVITY_TIMEOUT=/' || true
  else
    warn "No running auth container found via docker ps"
  fi
else
  warn "docker not available — skipped live container env"
fi

echo ""
echo "=== Summary: PASS=$PASS WARN=$WARN FAIL=$FAIL ==="
echo ""
echo "Suggested counter-tablet-friendly values (apply only after approval):"
echo "  # GOTRUE_JWT_EXP=3600          # keep 1h, or 86400 for 24h access tokens"
echo "  # unset GOTRUE_SESSION_TIME_BOX"
echo "  # unset GOTRUE_SESSION_INACTIVITY_TIMEOUT"
echo ""
echo "After changes: docker compose restart auth (in /root/supabase/docker)"

if (( FAIL > 0 )); then
  exit 1
fi
exit 0
