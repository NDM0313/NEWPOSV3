#!/bin/bash
# Fix "Failed to retrieve buckets" / "signature verification failed" in Supabase Studio.
# The anon key must be signed with the same JWT_SECRET as the project. This script
# regenerates ANON_KEY and SERVICE_ROLE_KEY from JWT_SECRET and restarts Kong + Auth.
# Run on VPS from project root: bash deploy/fix-supabase-storage-jwt.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
SUPABASE_DIR="$(dirname "$SUPABASE_ENV")"
ERP_ENV="$ROOT/.env.production"

if [ ! -f "$SUPABASE_ENV" ]; then
  echo "[fix-jwt] Supabase .env not found at $SUPABASE_ENV. Skip."
  exit 0
fi

echo "[fix-jwt] Regenerating anon and service_role keys from JWT_SECRET..."

# shellcheck source=/dev/null
source "$SUPABASE_ENV" 2>/dev/null || true
JWT_SECRET="${JWT_SECRET:-}"
if [ -z "$JWT_SECRET" ]; then
  echo "[fix-jwt] JWT_SECRET not set in $SUPABASE_ENV. Cannot regenerate keys."
  exit 1
fi

# Generate keys (run from repo; use node or docker run node)
cd "$ROOT"
if [ ! -f deploy/gen-jwt-keys.cjs ]; then
  echo "[fix-jwt] deploy/gen-jwt-keys.cjs not found. Run from NEWPOSV3 repo root."
  exit 1
fi
if command -v node >/dev/null 2>&1; then
  OUTPUT=$(JWT_SECRET="$JWT_SECRET" node deploy/gen-jwt-keys.cjs 2>/dev/null)
else
  OUTPUT=$(docker run --rm -e JWT_SECRET="$JWT_SECRET" -v "$ROOT/deploy:/app" node:20-alpine node /app/gen-jwt-keys.cjs 2>/dev/null)
fi
if [ -z "$OUTPUT" ]; then
  echo "[fix-jwt] Failed to generate keys (node or docker run node)."
  exit 1
fi
NEW_ANON=$(echo "$OUTPUT" | grep '^ANON_KEY=' | cut -d= -f2-)
NEW_SERVICE=$(echo "$OUTPUT" | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2-)
if [ -z "$NEW_ANON" ] || [ -z "$NEW_SERVICE" ]; then
  echo "[fix-jwt] Failed to parse generated keys."
  exit 1
fi

# Update Supabase .env (avoid sed special chars: use grep -v + echo)
grep -v '^ANON_KEY=' "$SUPABASE_ENV" > "${SUPABASE_ENV}.tmp" 2>/dev/null || true
echo "ANON_KEY=$NEW_ANON" >> "${SUPABASE_ENV}.tmp"
grep -v '^SERVICE_ROLE_KEY=' "${SUPABASE_ENV}.tmp" > "${SUPABASE_ENV}.tmp2" 2>/dev/null || true
echo "SERVICE_ROLE_KEY=$NEW_SERVICE" >> "${SUPABASE_ENV}.tmp2"
mv "${SUPABASE_ENV}.tmp2" "$SUPABASE_ENV"
rm -f "${SUPABASE_ENV}.tmp"
echo "[fix-jwt] Updated ANON_KEY and SERVICE_ROLE_KEY in $SUPABASE_ENV"

# Update ERP .env.production so frontend uses the same anon key
if [ -f "$ERP_ENV" ]; then
  grep -v '^VITE_SUPABASE_ANON_KEY=' "$ERP_ENV" > "${ERP_ENV}.tmp" 2>/dev/null || true
  echo "VITE_SUPABASE_ANON_KEY=$NEW_ANON" >> "${ERP_ENV}.tmp"
  mv "${ERP_ENV}.tmp" "$ERP_ENV"
  echo "[fix-jwt] Updated VITE_SUPABASE_ANON_KEY in .env.production"
fi

# Restart Kong (reads ANON_KEY from env at start, expands kong.yml) and Auth
if [ -f "$SUPABASE_DIR/docker-compose.yml" ] || [ -f "$SUPABASE_DIR/docker-compose.yaml" ]; then
  (cd "$SUPABASE_DIR" && docker compose restart kong auth rest storage 2>/dev/null) || true
  echo "[fix-jwt] Restarted Kong, Auth, Rest, Storage. Studio Storage should work now."
else
  echo "[fix-jwt] docker-compose not found; restart Kong and Auth manually so they pick up new keys."
fi

echo "[fix-jwt] Done. Rebuild ERP so the app gets the new anon key: bash deploy/deploy.sh"
