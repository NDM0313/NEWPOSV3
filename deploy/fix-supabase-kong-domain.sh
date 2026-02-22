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

# 2. Sync Kong anon key to ERP .env.production (avoids 401 from wrong key)
if docker ps --format '{{.Names}}' | grep -q 'supabase-kong'; then
  KONG_ANON=$(docker exec supabase-kong sh -c 'echo "$SUPABASE_ANON_KEY"' 2>/dev/null | tr -d '\n\r')
  if [ -n "$KONG_ANON" ]; then
    [ -f "$ERP_ENV" ] || touch "$ERP_ENV"
    if grep -q '^VITE_SUPABASE_ANON_KEY=' "$ERP_ENV" 2>/dev/null; then
      sed -i "s|^VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=$KONG_ANON|" "$ERP_ENV"
    else
      echo "VITE_SUPABASE_ANON_KEY=$KONG_ANON" >> "$ERP_ENV"
    fi
    if grep -q '^ANON_KEY=' "$SUPABASE_ENV" 2>/dev/null; then
      sed -i "s|^ANON_KEY=.*|ANON_KEY=$KONG_ANON|" "$SUPABASE_ENV"
    fi
    echo "[fix-supabase-kong] Synced Kong anon key to ERP .env.production"
  fi
  # Restart Kong so it picks up API_EXTERNAL_URL / host config
  SUPABASE_DIR="$(dirname "$SUPABASE_ENV")"
  if [ -f "$SUPABASE_DIR/docker-compose.yml" ] || [ -f "$SUPABASE_DIR/docker-compose.yaml" ]; then
    (cd "$SUPABASE_DIR" && docker compose restart kong 2>/dev/null) || true
    echo "[fix-supabase-kong] Kong restarted."
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
