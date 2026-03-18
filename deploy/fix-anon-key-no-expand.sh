#!/bin/bash
# Write ANON_KEY to Supabase .env without shell $ expansion (JWTs contain "iss" etc).
# Usage: bash deploy/fix-anon-key-no-expand.sh [ANON_KEY_VALUE]
# If no value given, uses the standard demo anon key (must match JWT_SECRET).

set -e
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
CORRECT_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo'
ANON="${1:-$CORRECT_ANON}"

[ ! -f "$SUPABASE_ENV" ] && echo "Missing $SUPABASE_ENV" && exit 1

# Remove old ANON_KEY line; append new one using printf (no $ expansion)
grep -v '^ANON_KEY=' "$SUPABASE_ENV" > "${SUPABASE_ENV}.noanon" 2>/dev/null || true
printf 'ANON_KEY=%s\n' "$ANON" >> "${SUPABASE_ENV}.noanon"
mv "${SUPABASE_ENV}.noanon" "$SUPABASE_ENV"
echo "[fix-anon-key] Updated ANON_KEY in $SUPABASE_ENV (length ${#ANON})"

# Recreate Kong so it loads the new key
SUPABASE_DIR="$(dirname "$SUPABASE_ENV")"
if [ -f "$SUPABASE_DIR/docker-compose.yml" ] || [ -f "$SUPABASE_DIR/docker-compose.yaml" ]; then
  (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate 2>/dev/null) || true
  echo "[fix-anon-key] Kong recreated."
fi
