#!/bin/bash
# Live platform health: supabase root, auth health, auth token, studio, erp.
# Run on VPS: cd /root/NEWPOSV3 && bash deploy/diagnose-live-platform.sh
# Option: RESTART_IF_FAIL=1 to restart Kong and auth if health fails, then re-check.
set -e
RESTART_IF_FAIL="${RESTART_IF_FAIL:-0}"
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi
ANON_KEY="${ANON_KEY:-$SUPABASE_ANON_KEY}"
if [ -z "$ANON_KEY" ] && [ -f /root/NEWPOSV3/.env.production ]; then
  ANON_KEY=$(grep -E '^VITE_SUPABASE_ANON_KEY=' /root/NEWPOSV3/.env.production 2>/dev/null | cut -d= -f2- | tr -d '\r\n "')
fi

run_checks() {
  local fail=0
  echo ""
  echo "=== 1. supabase.dincouture.pk root ==="
  code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 https://supabase.dincouture.pk/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then echo "PASS $code"; else echo "FAIL $code"; fail=1; fi

  echo "=== 2. auth/v1/health (with apikey) ==="
  code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 -H "apikey: $ANON_KEY" https://supabase.dincouture.pk/auth/v1/health 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then echo "PASS $code"; else echo "FAIL $code"; fail=1; fi

  echo "=== 3. auth/v1/token (POST, expect 400 for bad creds) ==="
  code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 -X POST "https://supabase.dincouture.pk/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"email":"x@y.z","password":"wrong"}' 2>/dev/null || echo "000")
  if [ "$code" = "400" ] || [ "$code" = "200" ]; then echo "PASS $code (auth reachable)"; else echo "FAIL $code"; fail=1; fi

  echo "=== 4. studio.dincouture.pk/project/default ==="
  code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 https://studio.dincouture.pk/project/default 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "307" ]; then echo "PASS $code"; else echo "FAIL $code"; fail=1; fi

  echo "=== 5. erp.dincouture.pk ==="
  code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 https://erp.dincouture.pk/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then echo "PASS $code"; else echo "FAIL $code"; fail=1; fi

  return $fail
}

echo "=============================================="
echo "Live platform diagnostic"
echo "=============================================="
echo "ANON_KEY set: $([ -n "$ANON_KEY" ] && echo yes || echo no)"
run_checks
RUN_RESULT=$?

if [ "$RUN_RESULT" -ne 0 ] && [ "$RESTART_IF_FAIL" = "1" ]; then
  echo ""
  echo "=== Restarting Kong and Auth (RESTART_IF_FAIL=1) ==="
  cd /root/supabase/docker 2>/dev/null && docker compose restart kong auth 2>/dev/null || docker restart supabase-kong supabase-auth 2>/dev/null || true
  echo "Waiting 25s for services..."
  sleep 25
  echo "=== Re-running checks ==="
  run_checks
  RUN_RESULT=$?
fi

echo ""
echo "=============================================="
if [ "$RUN_RESULT" -eq 0 ]; then
  echo "RESULT: All checks PASSED (from VPS)."
  echo "If browser still shows 502: hard refresh (Ctrl+Shift+R), try incognito, or different network."
else
  echo "RESULT: One or more checks FAILED."
  echo "Run: cd /root/supabase/docker && docker compose restart kong auth"
  echo "Or: RESTART_IF_FAIL=1 bash deploy/diagnose-live-platform.sh"
fi
echo "=============================================="
exit $RUN_RESULT
