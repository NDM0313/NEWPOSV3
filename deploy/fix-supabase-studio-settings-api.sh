#!/bin/bash
# Fix "Failed to update settings" / "Failed to update organization" in Supabase Studio.
# Kong's dashboard route had basic-auth which blocked Studio's API calls. This removes it.
# Run on VPS: bash deploy/fix-supabase-studio-settings-api.sh

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
if [ ! -f "$KONG_YML" ]; then
  echo "[fix-studio-api] kong.yml not found at $KONG_YML. Skip."
  exit 0
fi

if grep -A5 "Protected Dashboard" "$KONG_YML" | grep -q "basic-auth"; then
  cp "$KONG_YML" "${KONG_YML}.bak"
  python3 - "$KONG_YML" << 'PY'
import sys
p = sys.argv[1]
with open(p) as f:
  lines = f.readlines()
out = []
i = 0
while i < len(lines):
  line = lines[i]
  if (i + 3 <= len(lines) and line.strip() == "- name: basic-auth"
      and "config:" in lines[i+1] and "hide_credentials" in lines[i+2]):
    i += 4
    continue
  out.append(line)
  i += 1
with open(p, "w") as f:
  f.writelines(out)
PY
  echo "[fix-studio-api] Removed basic-auth from dashboard in kong.yml"
  SUPABASE_DIR="$(dirname "$(dirname "$(dirname "$KONG_YML")")")"
  if [ -f "$SUPABASE_DIR/docker-compose.yml" ]; then
    (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate 2>/dev/null) || true
    echo "[fix-studio-api] Recreated Kong. Studio settings/org API should work now."
  fi
else
  echo "[fix-studio-api] basic-auth already removed from dashboard. No change."
fi
