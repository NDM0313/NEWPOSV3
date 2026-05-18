#!/bin/bash
# Read-only: verify baked Supabase URL in JS + auth health through public ERP and local port.
# Run from repo root: bash scripts/vps-audit-auth-bridge.sh
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null)" || ROOT=""
if [ -z "$ROOT" ] || [ ! -f "$ROOT/.env.production" ]; then
  ROOT="${VPS_AUDIT_REPO:-/root/NEWPOSV3}"
fi
cd "$ROOT"

echo "=== .env.production (URL + anon length only) ==="
grep '^VITE_SUPABASE_URL=' .env.production || true
k="$(grep '^VITE_SUPABASE_ANON_KEY=' .env.production | cut -d= -f2- | tr -d '\r\n')"
echo "anon_key_length=${#k}"

echo "=== JS bundles mentioning erp.dincouture.pk (first 5 files) ==="
if docker exec erp-frontend sh -c 'test -d /usr/share/nginx/html/assets' 2>/dev/null; then
  docker exec erp-frontend sh -c 'grep -l "erp.dincouture.pk" /usr/share/nginx/html/assets/*.js 2>/dev/null | head -5' || true
else
  echo "(erp-frontend container not running — skip bundle grep)"
fi

echo "=== placeholder.supabase.co occurrences (should be empty) ==="
docker exec erp-frontend sh -c 'grep -l "placeholder.supabase.co" /usr/share/nginx/html/assets/*.js 2>/dev/null | head -3' || true

echo "=== Auth /health (public https://erp.dincouture.pk) ==="
curl -sS -o /tmp/erp_auth_health.body -w "public_erp_http=%{http_code}\n" \
  --header "apikey: ${k}" \
  --header "Authorization: Bearer ${k}" \
  https://erp.dincouture.pk/auth/v1/health || echo "curl_public_failed"
head -c 200 /tmp/erp_auth_health.body 2>/dev/null || true
echo

echo "=== Auth /health (http://127.0.0.1:3001 → erp-frontend nginx) ==="
curl -sS -o /tmp/erp_auth_local.body -w "local_3001_http=%{http_code}\n" \
  --header "apikey: ${k}" \
  --header "Authorization: Bearer ${k}" \
  http://127.0.0.1:3001/auth/v1/health || echo "curl_local_failed"
head -c 200 /tmp/erp_auth_local.body 2>/dev/null || true
echo
