#!/usr/bin/env bash
# Kong doctor: diagnostics only. No modifications.
# Run on VPS: cd /root/NEWPOSV3 && bash deploy/kong-doctor.sh
# From local:  ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/kong-doctor.sh"

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Kong Doctor (diagnostics only, no changes) ==="
echo ""

# 1. kong.yml exists
if [ ! -f "$KONG_YML" ]; then
  echo "[FAIL] kong.yml not found at: $KONG_YML"
  exit 1
fi
echo "[OK] kong.yml found: $KONG_YML"

# 2. Kong container status
if command -v docker &>/dev/null; then
  echo ""
  echo "--- Container status ---"
  docker ps -a --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -E "kong|auth" || echo "(no kong/auth containers)"
  KONG_STATUS=$(docker ps --format "{{.Status}}" -f name=supabase-kong 2>/dev/null | head -1 || true)
  if echo "$KONG_STATUS" | grep -q "Restarting"; then
    echo "[WARN] supabase-kong is in restart loop"
  elif echo "$KONG_STATUS" | grep -q "Up"; then
    echo "[OK] supabase-kong is up"
  fi
else
  echo "[SKIP] docker not available"
fi

# 3. Kong logs (last 20 lines)
if command -v docker &>/dev/null && docker ps -a --format "{{.Names}}" 2>/dev/null | grep -q supabase-kong; then
  echo ""
  echo "--- Kong logs (last 20 lines) ---"
  docker logs supabase-kong --tail 20 2>&1 || true
fi

# 4. Check for malformed CORS in kong.yml (config: as sibling of "- name: cors")
echo ""
echo "--- kong.yml CORS structure check ---"
if [ -f "$SCRIPT_DIR/fix-kong-cors-yaml.py" ]; then
  python3 "$SCRIPT_DIR/fix-kong-cors-yaml.py" --check-only "$KONG_YML" 2>&1 || true
else
  # Fallback: grep for the bad pattern
  if grep -n "name: cors" "$KONG_YML" | head -5; then
    echo "Checking for sibling 'config:' after '- name: cors'..."
    awk '/-\s+name:\s+cors\s*$/{cors=1; line=NR; next} cors && /^\s{2,6}config:\s*$/{print "Potential misplaced config at line " NR " (cors at " line ")"; cors=0}' "$KONG_YML" || true
  fi
fi

echo ""
echo "=== End of Kong Doctor ==="
echo "If Kong is in restart loop and logs show 'failed parsing declarative configuration', run:"
echo "  bash deploy/kong-safe-repair.sh"
