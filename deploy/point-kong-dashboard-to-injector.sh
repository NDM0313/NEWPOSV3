#!/bin/bash
# Point Kong dashboard (Studio) to studio-injector so sidebar gets "Backups" link.
# Run on VPS after erp-studio-injector is up: bash deploy/point-kong-dashboard-to-injector.sh

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
if [ ! -f "$KONG_YML" ]; then
  echo "[kong-injector] kong.yml not found. Skip."
  exit 0
fi

if grep -q "erp-studio-injector:8080" "$KONG_YML" 2>/dev/null; then
  echo "[kong-injector] Dashboard already points to injector. No change."
  exit 0
fi

cp "$KONG_YML" "${KONG_YML}.bak"
sed -i 's|url: http://studio:3000/|url: http://erp-studio-injector:8080/|' "$KONG_YML"
echo "[kong-injector] Dashboard now points to erp-studio-injector. Recreating Kong..."
SUPABASE_DIR="$(dirname "$(dirname "$(dirname "$KONG_YML")")")"
if [ -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate 2>/dev/null) || true
  echo "[kong-injector] Done. Refresh Studio – Backup should appear under Platform."
fi
