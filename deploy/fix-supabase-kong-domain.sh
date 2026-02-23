#!/bin/bash
# Fix supabase.dincouture.pk: Kong "Invalid authentication credentials" and host validation.
# Run on VPS: bash deploy/fix-supabase-kong-domain.sh
# Ensures Supabase .env has correct API URL, syncs Kong anon key to ERP, restarts Kong.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
ERP_ENV="$ROOT/.env.production"
DOMAIN_URL="https://supabase.dincouture.pk"

echo "[fix-supabase-kong] Ensuring supabase.dincouture.pk is configured..."

# 1. Supabase .env: set API_EXTERNAL_URL and SUPABASE_PUBLIC_URL so Kong accepts the host
if [ -f "$SUPABASE_ENV" ]; then
  for key in API_EXTERNAL_URL SUPABASE_PUBLIC_URL; do
    if grep -q "^${key}=" "$SUPABASE_ENV" 2>/dev/null; then
      sed -i "s|^${key}=.*|${key}=$DOMAIN_URL|" "$SUPABASE_ENV"
    else
      echo "${key}=$DOMAIN_URL" >> "$SUPABASE_ENV"
    fi
  done
  echo "[fix-supabase-kong] Updated $SUPABASE_ENV with API_EXTERNAL_URL and SUPABASE_PUBLIC_URL=$DOMAIN_URL"
else
  echo "[fix-supabase-kong] Supabase .env not found at $SUPABASE_ENV, skipping."
fi

# 2a. Ensure SITE_URL and redirect allow-list for Auth (GoTrue) before restart
if [ -f "$SUPABASE_ENV" ]; then
  SITE_URL_VAL="https://erp.dincouture.pk"
  REDIRECT_LIST="https://erp.dincouture.pk,https://erp.dincouture.pk/,https://erp.dincouture.pk/**"
  if grep -q "^SITE_URL=" "$SUPABASE_ENV" 2>/dev/null; then
    sed -i "s|^SITE_URL=.*|SITE_URL=$SITE_URL_VAL|" "$SUPABASE_ENV"
  else
    echo "SITE_URL=$SITE_URL_VAL" >> "$SUPABASE_ENV"
  fi
  if grep -q "^ADDITIONAL_REDIRECT_URLS=" "$SUPABASE_ENV" 2>/dev/null; then
    sed -i "s|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=$REDIRECT_LIST|" "$SUPABASE_ENV"
  else
    echo "ADDITIONAL_REDIRECT_URLS=$REDIRECT_LIST" >> "$SUPABASE_ENV"
  fi
  if grep -q "^GOTRUE_URI_ALLOW_LIST=" "$SUPABASE_ENV" 2>/dev/null; then
    sed -i "s|^GOTRUE_URI_ALLOW_LIST=.*|GOTRUE_URI_ALLOW_LIST=$REDIRECT_LIST|" "$SUPABASE_ENV"
  else
    echo "GOTRUE_URI_ALLOW_LIST=$REDIRECT_LIST" >> "$SUPABASE_ENV"
  fi
  echo "[fix-supabase-kong] SITE_URL and redirect allow-list set for erp.dincouture.pk"
fi

# 2. Sync Kong anon key to ERP .env.production only (do NOT write back to Supabase .env - JWT fix owns ANON_KEY there)
if docker ps --format '{{.Names}}' | grep -q 'supabase-kong'; then
  KONG_ANON=$(docker exec supabase-kong sh -c 'echo "$SUPABASE_ANON_KEY"' 2>/dev/null | tr -d '\n\r')
  if [ -n "$KONG_ANON" ]; then
    [ -f "$ERP_ENV" ] || touch "$ERP_ENV"
    if grep -q '^VITE_SUPABASE_ANON_KEY=' "$ERP_ENV" 2>/dev/null; then
      sed -i "s|^VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=$KONG_ANON|" "$ERP_ENV"
    else
      echo "VITE_SUPABASE_ANON_KEY=$KONG_ANON" >> "$ERP_ENV"
    fi
    echo "[fix-supabase-kong] Synced Kong anon key to ERP .env.production"
  fi
  # Restart Auth so it picks up SITE_URL; do NOT restart Kong (JWT fix recreates Kong to load new keys)
  SUPABASE_DIR="$(dirname "$SUPABASE_ENV")"
  if [ -f "$SUPABASE_DIR/docker-compose.yml" ] || [ -f "$SUPABASE_DIR/docker-compose.yaml" ]; then
    (cd "$SUPABASE_DIR" && docker compose restart auth 2>/dev/null) || true
    echo "[fix-supabase-kong] Auth restarted."
  fi
else
  echo "[fix-supabase-kong] Kong container not found, skip key sync and restart."
fi

# 3. Ensure ERP .env has correct Supabase URL (not erp.dincouture.pk)
if [ -f "$ERP_ENV" ]; then
  if grep -q '^VITE_SUPABASE_URL=' "$ERP_ENV"; then
    sed -i "s|^VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=$DOMAIN_URL|" "$ERP_ENV"
  else
    echo "VITE_SUPABASE_URL=$DOMAIN_URL" >> "$ERP_ENV"
  fi
  echo "[fix-supabase-kong] VITE_SUPABASE_URL=$DOMAIN_URL in .env.production"
fi

echo "[fix-supabase-kong] Done. Rebuild ERP if needed; test: curl -sI -H 'apikey: YOUR_ANON_KEY' $DOMAIN_URL/auth/v1/health"
echo "[fix-supabase-kong] Note: Opening $DOMAIN_URL in browser without apikey shows 401 – that is normal. The ERP app sends the key."
