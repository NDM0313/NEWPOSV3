#!/usr/bin/env bash
# Fix "Failed to fetch" on Sign In: set Supabase Auth SITE_URL and redirect list for erp.dincouture.pk, then restart auth.
# Run on VPS where Supabase is running: bash scripts/vps-supabase-fix-fetch.sh

set -e
SITE="https://erp.dincouture.pk"
ENV_FILE="${SUPABASE_ENV:-/root/supabase/docker/.env}"

echo "=== Fix Supabase Auth for $SITE ==="
echo "Env file: $ENV_FILE"
echo ""

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Env file not found: $ENV_FILE"
  echo "Set SUPABASE_ENV=/path/to/your/supabase/.env and re-run."
  exit 1
fi

# Backup
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
echo "[OK] Backed up env file"

# Ensure GOTRUE_SITE_URL or SITE_URL
if grep -qE '^GOTRUE_SITE_URL=' "$ENV_FILE"; then
  sed -i "s|^GOTRUE_SITE_URL=.*|GOTRUE_SITE_URL=$SITE|" "$ENV_FILE"
  echo "[OK] Updated GOTRUE_SITE_URL"
elif grep -qE '^SITE_URL=' "$ENV_FILE"; then
  sed -i "s|^SITE_URL=.*|SITE_URL=$SITE|" "$ENV_FILE"
  echo "[OK] Updated SITE_URL"
else
  echo "GOTRUE_SITE_URL=$SITE" >> "$ENV_FILE"
  echo "[OK] Added GOTRUE_SITE_URL"
fi

# Ensure redirect allow list (GOTRUE_URI_ALLOW_LIST or ADDITIONAL_REDIRECT_URLS)
ALLOW_LIST="$SITE,$SITE/"
if grep -qE '^GOTRUE_URI_ALLOW_LIST=' "$ENV_FILE"; then
  # Append our site if not already present
  CURRENT=$(grep '^GOTRUE_URI_ALLOW_LIST=' "$ENV_FILE" | cut -d= -f2-)
  if echo "$CURRENT" | grep -q "erp.dincouture.pk"; then
    echo "[OK] GOTRUE_URI_ALLOW_LIST already includes erp.dincouture.pk"
  else
    sed -i "s|^GOTRUE_URI_ALLOW_LIST=.*|GOTRUE_URI_ALLOW_LIST=${CURRENT},${SITE},${SITE}/|" "$ENV_FILE"
    echo "[OK] Appended erp.dincouture.pk to GOTRUE_URI_ALLOW_LIST"
  fi
else
  echo "GOTRUE_URI_ALLOW_LIST=$ALLOW_LIST" >> "$ENV_FILE"
  echo "[OK] Added GOTRUE_URI_ALLOW_LIST"
fi

# Restart auth container
AUTH_CONTAINER=$(docker ps -q -f name=supabase-auth 2>/dev/null | head -1)
if [ -n "$AUTH_CONTAINER" ]; then
  echo ""
  echo "Restarting Supabase Auth..."
  docker restart "$AUTH_CONTAINER"
  echo "[OK] Auth restarted"
else
  echo ""
  echo "[??] No container named supabase-auth found. Restart your Supabase stack so Auth picks up the new env."
fi

# Optional: restart Kong so CORS/headers are fresh
KONG_CONTAINER=$(docker ps -q -f name=kong 2>/dev/null | head -1)
if [ -n "$KONG_CONTAINER" ]; then
  echo "Restarting Kong..."
  docker restart "$KONG_CONTAINER"
  echo "[OK] Kong restarted"
fi

echo ""
echo "Done. Try Sign In again at $SITE"
echo "If still Failed to fetch: check firewall (port 8443), Kong CORS, and browser F12 -> Network tab."
