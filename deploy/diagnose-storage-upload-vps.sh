#!/usr/bin/env bash
# Read-only VPS diagnosis: storage upload path (erp nginx proxy vs direct Supabase),
# nginx /storage/ config, GoTrue reuse interval, recent storage/auth logs.
# Usage: ssh dincouture-vps "bash -s" < deploy/diagnose-storage-upload-vps.sh
#    or: cd /root/NEWPOSV3 && bash deploy/diagnose-storage-upload-vps.sh

set -euo pipefail

ERP_HOST="${ERP_HOST:-https://erp.dincouture.pk}"
SUPABASE_HOST="${SUPABASE_HOST:-https://supabase.dincouture.pk}"
ENV_FILE="${GOTRUE_ENV_FILE:-/root/supabase/docker/.env}"

echo "=== Storage upload VPS diagnosis ==="
echo "ERP:      $ERP_HOST"
echo "Supabase: $SUPABASE_HOST"
echo ""

echo "--- PWA bundle (latest /m/index.html) ---"
curl -sS -o /dev/null -w "erp/m/index.html HTTP %{http_code} time=%{time_total}s\n" "${ERP_HOST}/m/index.html" || true
curl -sS "${ERP_HOST}/m/index.html" 2>/dev/null | grep -oE 'assets/index-[^"]+\.js' | head -1 | sed 's/^/pwa_js_bundle: /' || echo "pwa_js_bundle: (not found)"

echo ""
echo "--- Storage health (unauthenticated OPTIONS) ---"
curl -sS -o /dev/null -w "erp /storage/v1/ OPTIONS %{http_code}\n" -X OPTIONS "${ERP_HOST}/storage/v1/" || true
curl -sS -o /dev/null -w "direct /storage/v1/ OPTIONS %{http_code}\n" -X OPTIONS "${SUPABASE_HOST}/storage/v1/" || true

echo ""
echo "--- erp-frontend nginx /storage/ block ---"
ERP_CID="$(docker ps --filter 'name=erp-frontend' --format '{{.Names}}' 2>/dev/null | head -1 || true)"
if [[ -n "$ERP_CID" ]]; then
  docker exec "$ERP_CID" grep -A20 'location /storage/' /etc/nginx/conf.d/default.conf 2>/dev/null \
    || docker exec "$ERP_CID" grep -A20 'location /storage/' /etc/nginx/nginx.conf 2>/dev/null \
    || echo "(could not read nginx config in $ERP_CID)"
else
  echo "WARN: erp-frontend container not running"
fi

echo ""
echo "--- GoTrue refresh token reuse interval ---"
if [[ -f "$ENV_FILE" ]]; then
  grep -E '^GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=' "$ENV_FILE" 2>/dev/null | tail -1 || echo "WARN: not in $ENV_FILE"
else
  echo "WARN: $ENV_FILE missing"
fi
AUTH_CID="$(docker ps --filter 'name=auth' --format '{{.Names}}' 2>/dev/null | head -1 || true)"
if [[ -n "$AUTH_CID" ]]; then
  docker exec "$AUTH_CID" printenv GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL 2>/dev/null \
    | sed 's/^/auth_container GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=/' \
    || echo "WARN: reuse interval not in auth container env"
fi

echo ""
echo "--- Storage RLS quick check (payment-attachments policies) ---"
DB_CID="$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1 || true)"
if [[ -n "$DB_CID" ]]; then
  docker exec "$DB_CID" psql -U postgres -d postgres -t -A -c \
    "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE 'payment_attachments%';" \
    2>/dev/null | sed 's/^/payment_attachments_policies: /' || true
  docker exec "$DB_CID" psql -U postgres -d postgres -t -A -c \
    "SELECT COUNT(*) FROM storage.buckets WHERE name = 'payment-attachments';" \
    2>/dev/null | sed 's/^/payment_attachments_bucket: /' || true
  docker exec "$DB_CID" psql -U postgres -d postgres -t -A -c \
    "SELECT COUNT(*) FROM storage.buckets WHERE name = 'expense-receipts';" \
    2>/dev/null | sed 's/^/expense_receipts_bucket: /' || true
  docker exec "$DB_CID" psql -U postgres -d postgres -t -A -c \
    "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE 'expense_receipts%';" \
    2>/dev/null | sed 's/^/expense_receipts_policies: /' || true
else
  echo "WARN: postgres container not found"
fi

echo ""
echo "--- Recent Kong / storage logs (last 30 lines, errors) ---"
KONG_CID="$(docker ps --filter 'name=kong' --format '{{.Names}}' 2>/dev/null | head -1 || true)"
if [[ -n "$KONG_CID" ]]; then
  docker logs "$KONG_CID" --tail 30 2>&1 | grep -iE 'storage|error|502|504|403|timeout' | tail -15 || echo "(no matching kong log lines)"
else
  echo "WARN: kong container not found"
fi

STORAGE_CID="$(docker ps --filter 'name=storage' --format '{{.Names}}' 2>/dev/null | head -1 || true)"
if [[ -n "$STORAGE_CID" ]]; then
  docker logs "$STORAGE_CID" --tail 20 2>&1 | grep -iE 'error|403|401|timeout' | tail -10 || echo "(no matching storage log lines)"
fi

echo ""
echo "--- Attachment localhost rows (should be 0) ---"
if [[ -n "$DB_CID" ]]; then
  docker exec "$DB_CID" psql -U postgres -d postgres -t -A -c "
    SELECT
      (SELECT COUNT(*) FROM payments WHERE attachments::text LIKE '%localhost%' OR attachments::text LIKE '%127.0.0.1%')
      + (SELECT COUNT(*) FROM sales WHERE attachments::text LIKE '%localhost%' OR attachments::text LIKE '%127.0.0.1%')
      + (SELECT COUNT(*) FROM purchases WHERE attachments::text LIKE '%localhost%' OR attachments::text LIKE '%127.0.0.1%');
  " 2>/dev/null | sed 's/^/localhost_attachment_rows: /' || true
fi

echo ""
echo "=== Diagnosis complete ==="
echo "If uploads fail on PWA but work locally: local Vite proxies /storage directly to supabase.dincouture.pk;"
echo "PWA uses ${ERP_HOST}/storage/ via erp-frontend nginx — verify proxy_buffering off and 300s timeouts."
